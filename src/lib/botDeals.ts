import { BID_INCREMENT, botProfile, estimateValue, isBot, observeItem, spendableCash } from "./bots";
import { activeLoan, executeCommand, ownedItems } from "./gameEngine";
import { money } from "./valuation";
import type { Random } from "./randomizer";
import { CHAT_MAX_LENGTH, type GameItem, type GameState, type Player, type TableOffer } from "../types/game";

/** Proposals each bot will hear per negotiation, so its private limit cannot be probed endlessly. */
export const MAX_PROPOSALS = 3;
// A bot buys below and sells above its own estimate, so it never trades against itself.
const BUY_MARGIN = 0.9;
const SELL_MARGIN = 1.1;
const OPENING_BUY_DISCOUNT = 0.85;
const OPENING_SELL_PREMIUM = 1.1;
const BUY_OFFER_CHANCE = 0.5;
const SELL_OFFER_CHANCE = 0.35;

export type DealCommand =
  // From the human's side: buy one of the bot's items, or sell one of their own to the bot.
  | { type: "PROPOSE_DEAL"; botId: string; kind: "buy" | "sell"; itemId: string; price: number }
  | { type: "RESPOND_OFFER"; offerId: string; accept: boolean }
  | { type: "SAY"; speakerId: string; text: string };

export type DealDecision = { accepted: boolean; counter: number | null };

const roundDown = (value: number) => Math.max(0, Math.floor(value / BID_INCREMENT) * BID_INCREMENT);
const roundUp = (value: number) => Math.ceil(value / BID_INCREMENT) * BID_INCREMENT;

function requireRule(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function botIn(game: GameState, botId: string): Player {
  const bot = game.players.find(player => player.id === botId);
  requireRule(bot && isBot(game, botId), "Choose a computer opponent.");
  return bot;
}

// Both limits use only what this bot has learned about the item.
export function botBuyLimit(game: GameState, bot: Player, item: GameItem): number {
  const estimate = estimateValue(observeItem(item, bot));
  return Math.min(roundDown(estimate * botProfile(game, bot.id).confidence * BUY_MARGIN), roundDown(spendableCash(game, bot)));
}

export function botSellFloor(game: GameState, bot: Player, item: GameItem): number {
  const estimate = estimateValue(observeItem(item, bot));
  return Math.max(BID_INCREMENT, roundUp(estimate * botProfile(game, bot.id).confidence * SELL_MARGIN));
}

export function decideProposal(game: GameState, bot: Player, kind: "buy" | "sell", item: GameItem, price: number): DealDecision {
  if (kind === "buy") {
    const floor = botSellFloor(game, bot, item);
    return price >= floor ? { accepted: true, counter: null } : { accepted: false, counter: floor };
  }
  const limit = botBuyLimit(game, bot, item);
  if (price <= limit) return { accepted: true, counter: null };
  return { accepted: false, counter: limit >= BID_INCREMENT ? limit : null };
}

/** Each bot may open negotiation with one offer, priced to leave room to haggle. */
export function makeOpeningOffers(game: GameState, random: Random): TableOffer[] {
  const human = game.players[0];
  const offers: TableOffer[] = [];
  for (const bot of game.players.filter(player => isBot(game, player.id))) {
    const wanted = ownedItems(game, human.id).filter(item => !activeLoan(game, item.id))
      .map(item => ({ item, limit: botBuyLimit(game, bot, item) }))
      .filter(entry => entry.limit >= BID_INCREMENT)
      .sort((a, b) => b.limit - a.limit)[0];
    if (wanted && random() < BUY_OFFER_CHANCE) {
      offers.push({ id: `offer-${game.round}-${offers.length + 1}`, botId: bot.id, kind: "bot-buys", itemId: wanted.item.id,
        price: Math.max(BID_INCREMENT, roundDown(wanted.limit * OPENING_BUY_DISCOUNT)) });
      continue;
    }
    const spare = ownedItems(game, bot.id)
      .map(item => ({ item, price: roundUp(botSellFloor(game, bot, item) * OPENING_SELL_PREMIUM) }))
      .filter(entry => entry.price <= human.cash)[0];
    if (spare && random() < SELL_OFFER_CHANCE) {
      offers.push({ id: `offer-${game.round}-${offers.length + 1}`, botId: bot.id, kind: "bot-sells", itemId: spare.item.id, price: spare.price });
    }
  }
  return offers;
}

function note(game: GameState, text: string) {
  game.log.push({ id: `event-${game.log.length + 1}`, round: game.round, text });
}

function trade(game: GameState, offer: Pick<TableOffer, "botId" | "kind" | "itemId" | "price">, random: Random): GameState {
  const humanId = game.players[0].id;
  const [sellerId, buyerId] = offer.kind === "bot-buys" ? [humanId, offer.botId] : [offer.botId, humanId];
  const next = executeCommand(game, { type: "TRADE", sellerId, buyerId, itemId: offer.itemId, price: offer.price }, random);
  // Drop offers that no longer match ownership after the sale.
  next.negotiation.offers = next.negotiation.offers.filter(other => {
    const owner = next.items.find(item => item.id === other.itemId)?.ownerId;
    return owner === (other.kind === "bot-buys" ? humanId : other.botId);
  });
  return next;
}

export function executeDealCommand(state: GameState, command: DealCommand, random: Random = Math.random): GameState {
  requireRule(state.mode === "solo", "Bots only negotiate in solo games.");
  requireRule(state.phase !== "finished", "This game has finished.");
  let game = structuredClone(state);
  const human = game.players[0];
  if (command.type === "SAY") {
    const text = command.text.trim().slice(0, CHAT_MAX_LENGTH);
    requireRule(text, "Say something first.");
    requireRule(game.players.some(player => player.id === command.speakerId), "Player not found.");
    game.chat.push({ id: `chat-${game.chat.length + 1}`, round: game.round, speakerId: command.speakerId, text });
    return game;
  }
  requireRule(game.phase === "negotiation", "Deals with bots happen during negotiation.");
  if (command.type === "RESPOND_OFFER") {
    const offer = game.negotiation.offers.find(offer => offer.id === command.offerId);
    requireRule(offer, "That offer is no longer on the table.");
    const bot = botIn(game, offer.botId);
    const lot = game.items.find(item => item.id === offer.itemId)!.lot;
    if (!command.accept) {
      game.negotiation.offers = game.negotiation.offers.filter(other => other.id !== offer.id);
      note(game, `${human.name} declined ${bot.name}’s ${money(offer.price)} offer for lot ${lot}.`);
      return game;
    }
    game.negotiation.offers = game.negotiation.offers.filter(other => other.id !== offer.id);
    return trade(game, offer, random);
  }
  const bot = botIn(game, command.botId);
  const item = game.items.find(item => item.id === command.itemId);
  requireRule(item, "Item not found.");
  requireRule(Number.isSafeInteger(command.price) && command.price >= 0 && command.price <= 1_000_000_000, "Offer a whole-dollar amount, up to $1 billion.");
  requireRule(item.ownerId === (command.kind === "buy" ? bot.id : human.id), command.kind === "buy" ? `${bot.name} does not own that item.` : "You can only sell your own items.");
  requireRule(!activeLoan(game, item.id), "Repay this item’s leverage loan before selling it.");
  if (command.kind === "buy") requireRule(human.cash >= command.price, `You need ${money(command.price)} in cash.`);
  const heard = game.negotiation.proposals[bot.id] ?? 0;
  requireRule(heard < MAX_PROPOSALS, `${bot.name} has heard enough offers this round.`);
  game.negotiation.proposals[bot.id] = heard + 1;
  const decision = decideProposal(game, bot, command.kind, item, command.price);
  const verb = command.kind === "buy" ? "to buy" : "to sell";
  note(game, `${human.name} offered ${money(command.price)} ${verb} lot ${item.lot} ${command.kind === "buy" ? "from" : "to"} ${bot.name}.`);
  // Replace this bot's earlier offers with its latest position.
  game.negotiation.offers = game.negotiation.offers.filter(offer => offer.botId !== bot.id);
  const kind = command.kind === "buy" ? "bot-sells" : "bot-buys";
  if (decision.accepted) {
    note(game, `${bot.name} accepted.`);
    game = trade(game, { botId: bot.id, kind, itemId: item.id, price: command.price }, random);
  } else if (decision.counter !== null) {
    note(game, `${bot.name} declined and countered at ${money(decision.counter)}.`);
    game.negotiation.offers.push({ id: `offer-${game.round}-${game.log.length}`, botId: bot.id, kind, itemId: item.id, price: decision.counter });
  } else {
    note(game, `${bot.name} declined.`);
  }
  return game;
}
