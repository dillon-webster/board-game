import { ITEM_TEMPLATES } from "../data/items";
import { SLOT_RESULTS } from "../data/slotResults";
import { GAME_CONFIG, type GameConfig } from "./config";
import { pick, shuffle, type Random } from "./randomizer";
import { calculateItemValue, calculateNetWorth, inspectionCost, missingClueSlots, money, withPenalty } from "./valuation";
import { configSchema, SLOTS, type GameItem, type GameState, type Player, type Slot } from "../types/game";

export type Command =
  | { type: "BUY_CLUE"; playerId: string; slot: Slot }
  | { type: "HOLD"; playerId: string }
  | { type: "CONSIGN"; playerId: string; itemId: string; reserve: number }
  | { type: "RESOLVE_CONSIGN"; buyerId: string | null; price: number }
  | { type: "LEVERAGE"; playerId: string; itemId: string; amount: number }
  | { type: "START_NEGOTIATION" }
  | { type: "START_AUCTION" }
  | { type: "RECORD_AUCTION"; playerId: string; bid: number }
  | { type: "PASS_AUCTION" }
  | { type: "INSPECT"; playerId: string; itemId: string }
  | { type: "PASS_INSPECTION"; playerId: string }
  | { type: "REPAY"; playerId: string; amount: number; loanId?: string }
  | { type: "TRADE"; sellerId: string; buyerId: string; itemId: string; price: number }
  | { type: "TRANSFER_CASH"; sellerId: string; buyerId: string; amount: number }
  | { type: "ADVANCE" };

function requireRule(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function amount(value: number, label: string, allowZero = false) {
  requireRule(Number.isSafeInteger(value) && value >= (allowZero ? 0 : 1) && value <= 1_000_000_000, `${label} must be ${allowZero ? "a nonnegative" : "a positive"} whole-dollar amount, up to $1 billion.`);
}

function playerIn(game: GameState, id: string): Player {
  const player = game.players.find(player => player.id === id);
  requireRule(player, "Player not found.");
  return player;
}

function itemIn(game: GameState, id: string): GameItem {
  const item = game.items.find(item => item.id === id);
  requireRule(item, "Item not found.");
  return item;
}

function note(game: GameState, text: string) {
  game.log.push({ id: `event-${game.log.length + 1}`, round: game.round, text });
}

function knowledgeFor(player: Player, item: GameItem) {
  return player.knowledge[item.id] ??= {
    clues: { Authenticity: [], Condition: [], History: [], Discovery: [] },
  };
}

function requirePhase(game: GameState, phase: GameState["phase"]) {
  requireRule(game.phase === phase, `This action is only available during ${phase}.`);
}

function phaseOnePlayer(game: GameState, id: string) {
  requirePhase(game, "actions");
  requireRule(!game.consignment, "Resolve the pending consignment first.");
  const player = playerIn(game, id);
  requireRule(!game.actions[id], `${player.name} has already used their Phase 1 action.`);
  return player;
}

function spendCash(player: Player, cost: number) {
  requireRule(player.cash >= cost, `${player.name} needs ${money(cost)} in cash.`);
  player.cash -= cost;
}

// Only a new shortfall is penalized. Existing debt never compounds.
function chargeWithDebt(game: GameState, player: Player, cost: number) {
  const paid = Math.min(player.cash, cost);
  player.cash -= paid;
  const debt = withPenalty(cost - paid, game.config.auctionDebtPenalty);
  player.auctionDebt += debt;
  return debt;
}

function transferItem(item: GameItem, buyer: Player, price: number) {
  item.ownerId = buyer.id;
  item.purchasePrice = price;
}

/** Chance the auction house closes after this round. The maximum round always ends the game. */
export function endChanceAfter(config: GameConfig, round: number): number {
  if (round >= config.rounds) return 1;
  if (round < config.guaranteedRounds) return 0;
  return Math.min(1, config.endChanceStep * (round - config.guaranteedRounds + 1));
}

/** Expected number of rounds still to be played, counting the current one. */
export function expectedRoundsLeft(config: GameConfig, round: number): number {
  let expected = 0;
  let reached = 1;
  for (let next = round; next <= config.rounds && reached > 0; next++) {
    expected += reached;
    reached *= 1 - endChanceAfter(config, next);
  }
  return expected;
}

export function currentItem(game: GameState) {
  return game.items[game.round - 1];
}

export function ownedItems(game: GameState, playerId: string) {
  return game.items.filter(item => item.ownerId === playerId);
}

export function activeLoan(game: GameState, itemId: string) {
  return game.loans.find(loan => loan.itemId === itemId && loan.status === "active");
}

export function generateGame(names: string[], config: GameConfig = GAME_CONFIG, random: Random = Math.random, mode: GameState["mode"] = "shared"): GameState {
  requireRule(names.length === 4, "Enter exactly four player names.");
  const cleanNames = names.map(name => name.trim());
  requireRule(cleanNames.every(name => name.length > 0 && name.length <= 32), "Player names must be 1–32 characters.");
  requireRule(new Set(cleanNames.map(name => name.toLowerCase())).size === 4, "Give each player a different name.");
  const rules = configSchema.parse(config);
  const items: GameItem[] = [];
  // Each group contains the five templates once, with a fresh mystery per lot.
  while (items.length < rules.rounds) {
    for (const template of shuffle(ITEM_TEMPLATES, random)) {
      if (items.length === rules.rounds) break;
      const hidden = Object.fromEntries(SLOTS.map(slot => [slot,
        structuredClone(pick(SLOT_RESULTS[slot].filter(result => result.compatibleCategories.includes(template.category)), random)),
      ])) as GameItem["hidden"];
      const lot = items.length + 1;
      items.push({ ...template, id: `lot-${lot}`, templateId: template.id, lot, hidden,
        ownerId: null, purchasePrice: null, forfeited: false });
    }
  }
  const game: GameState = {
    version: 2, mode, id: crypto.randomUUID(), config: rules, round: 1, phase: "actions",
    players: cleanNames.map((name, index) => ({ id: `player-${index + 1}`, name, cash: rules.startingCash, auctionDebt: 0, knowledge: {} })),
    items, actions: {}, inspectionDone: [], loans: [], consignment: null, bidding: null, log: [],
    negotiation: { offers: [], proposals: {} }, chat: [], scores: [],
  };
  note(game, `The auction house is open. Four collectors, ${rules.rounds} mysteries.`);
  return game;
}

function buyClue(game: GameState, playerId: string, slot: Slot, random: Random) {
  const player = phaseOnePlayer(game, playerId);
  requireRule(SLOTS.includes(slot), "Choose a valid clue category.");
  requireRule(player.auctionDebt === 0, "Repay auction debt before buying a clue.");
  spendCash(player, game.config.clueCost);
  const item = currentItem(game);
  knowledgeFor(player, item).clues[slot].push(pick(item.hidden[slot].clues, random));
  game.actions[playerId] = "clue";
  note(game, `${player.name} bought a private clue for ${money(game.config.clueCost)}.`);
}

function recordAuctionResult(game: GameState, playerId: string, bid: number) {
  requirePhase(game, "auction");
  amount(bid, "Winning bid");
  const player = playerIn(game, playerId);
  const item = currentItem(game);
  requireRule(!item.ownerId, "This lot has already been sold.");
  const debt = chargeWithDebt(game, player, bid);
  transferItem(item, player, bid);
  openInspectionWindow(game);
  note(game, `${player.name} won lot ${item.lot} for ${money(bid)}.${debt ? ` New auction debt: ${money(debt)}.` : ""}`);
}

function openInspectionWindow(game: GameState) {
  game.phase = "inspection";
  game.bidding = null;
  game.inspectionDone = game.players.filter(player => !ownedItems(game, player.id).length).map(player => player.id);
}

/** Reveals one clue in each category this player has not investigated yet.
 * Clues already bought or remembered are never charged again. */
function inspect(game: GameState, playerId: string, itemId: string, random: Random) {
  requirePhase(game, "inspection");
  const player = playerIn(game, playerId);
  const item = itemIn(game, itemId);
  requireRule(item.ownerId === playerId, "You can only inspect your own items.");
  requireRule(!game.inspectionDone.includes(playerId), "You have already used or passed this inspection window.");
  requireRule(player.auctionDebt === 0, "Repay auction debt before purchasing an inspection.");
  const missing = missingClueSlots(player, item);
  requireRule(missing.length, "You already have a clue in every category for this item.");
  const cost = inspectionCost(game, player, item);
  spendCash(player, cost);
  const knowledge = knowledgeFor(player, item);
  for (const slot of missing) knowledge.clues[slot].push(pick(item.hidden[slot].clues, random));
  game.inspectionDone.push(playerId);
  note(game, `${player.name} purchased a full inspection of lot ${item.lot} for ${money(cost)}.`);
}

function consignItem(game: GameState, playerId: string, itemId: string, reserve: number) {
  const player = phaseOnePlayer(game, playerId);
  const item = itemIn(game, itemId);
  amount(reserve, "Reserve", true);
  requireRule(item.ownerId === player.id, "You can only consign your own items.");
  requireRule(!activeLoan(game, itemId), "Repay this item’s leverage loan before selling it.");
  game.consignment = { sellerId: playerId, itemId, reserve };
  game.actions[playerId] = "consign";
  note(game, `${player.name} consigned lot ${item.lot}. The reserve is private.`);
}

function cashSale(game: GameState, sellerId: string, buyerId: string, itemId: string, price: number) {
  amount(price, "Sale price", true);
  requireRule(sellerId !== buyerId, "Choose a different buyer and seller.");
  const seller = playerIn(game, sellerId);
  const buyer = playerIn(game, buyerId);
  const item = itemIn(game, itemId);
  requireRule(item.ownerId === seller.id, "The seller no longer owns this item.");
  requireRule(!activeLoan(game, itemId), "Repay this item’s leverage loan before selling it.");
  spendCash(buyer, price);
  seller.cash += price;
  transferItem(item, buyer, price);
  note(game, `${seller.name} sold lot ${item.lot} to ${buyer.name} for ${money(price)}.`);
}

function leverageItem(game: GameState, playerId: string, itemId: string, principal: number) {
  const player = phaseOnePlayer(game, playerId);
  const item = itemIn(game, itemId);
  amount(principal, "Loan amount");
  requireRule(item.ownerId === playerId, "You can only leverage your own items.");
  requireRule(!activeLoan(game, itemId), "This item already secures an active loan.");
  const max = Math.floor(item.baseValue * game.config.leverageLoanPercent);
  requireRule(principal <= max, `This item can secure at most ${money(max)}.`);
  const remaining = withPenalty(principal, game.config.leveragePenalty);
  game.loans.push({ id: `loan-${game.loans.length + 1}`, playerId, itemId, principal, remaining, status: "active" });
  player.cash += principal;
  game.actions[playerId] = "leverage";
  note(game, `${player.name} borrowed ${money(principal)} against lot ${item.lot}; ${money(remaining)} is owed.`);
}

function repayDebt(game: GameState, playerId: string, payment: number, loanId?: string) {
  const player = playerIn(game, playerId);
  amount(payment, "Repayment");
  if (loanId) {
    const loan = game.loans.find(loan => loan.id === loanId && loan.playerId === playerId && loan.status === "active");
    requireRule(loan, "Active leverage loan not found.");
    requireRule(payment <= loan.remaining, "Payment exceeds the remaining loan.");
    spendCash(player, payment);
    loan.remaining -= payment;
    if (loan.remaining === 0) loan.status = "repaid";
  } else {
    requireRule(payment <= player.auctionDebt, "Payment exceeds the outstanding auction debt.");
    spendCash(player, payment);
    player.auctionDebt -= payment;
  }
  note(game, `${player.name} repaid ${money(payment)} of ${loanId ? "leverage" : "auction"} debt.`);
}

function finishGame(game: GameState) {
  const forfeitures: Record<string, string[]> = Object.fromEntries(game.players.map(player => [player.id, []]));
  // Collateral is forfeited before scoring; the secured debt is cleared.
  for (const loan of game.loans.filter(loan => loan.status === "active")) {
    const item = itemIn(game, loan.itemId);
    item.ownerId = null;
    item.forfeited = true;
    forfeitures[loan.playerId].push(item.id);
    loan.remaining = 0;
    loan.status = "forfeited";
    note(game, `${playerIn(game, loan.playerId).name} forfeited lot ${item.lot}; its leverage debt was cleared.`);
  }
  // Every retained item is revealed at no cost.
  game.scores = game.players.map(player => ({
    playerId: player.id, cash: player.cash,
    itemValue: ownedItems(game, player.id).reduce((sum, item) => sum + calculateItemValue(item), 0),
    auctionDebt: player.auctionDebt, leverageDebt: 0,
    netWorth: calculateNetWorth(game, player),
    forfeitedItemIds: forfeitures[player.id],
  })).sort((a, b) => b.netWorth - a.netWorth);
  game.phase = "finished";
  note(game, "All mysteries are revealed. Final settlement is complete.");
}

/** Every command is a transaction: failures leave the original state untouched. */
export function executeCommand(state: GameState, command: Command, random: Random = Math.random): GameState {
  requireRule(state.phase !== "finished", "This game has finished.");
  const game = structuredClone(state);
  switch (command.type) {
    case "BUY_CLUE": buyClue(game, command.playerId, command.slot, random); break;
    case "HOLD": {
      const player = phaseOnePlayer(game, command.playerId);
      game.actions[player.id] = "hold";
      note(game, `${player.name} chose to hold.`);
      break;
    }
    case "CONSIGN": consignItem(game, command.playerId, command.itemId, command.reserve); break;
    case "RESOLVE_CONSIGN": {
      requirePhase(game, "actions");
      const listing = game.consignment;
      requireRule(listing, "There is no pending consignment.");
      amount(command.price, "Sale price", true);
      if (command.buyerId && command.price >= listing.reserve) {
        cashSale(game, listing.sellerId, command.buyerId, listing.itemId, command.price);
      } else {
        note(game, `Lot ${itemIn(game, listing.itemId).lot} did not sell. Its owner keeps the item.`);
      }
      game.consignment = null;
      game.bidding = null;
      break;
    }
    case "LEVERAGE": leverageItem(game, command.playerId, command.itemId, command.amount); break;
    case "START_NEGOTIATION":
      requirePhase(game, "actions");
      requireRule(!game.consignment, "Resolve the consignment before continuing.");
      requireRule(game.players.every(player => game.actions[player.id]), "Each player must take one Phase 1 action.");
      game.phase = "negotiation";
      note(game, "Negotiation is open.");
      break;
    case "START_AUCTION":
      requirePhase(game, "negotiation");
      game.phase = "auction";
      note(game, `Bidding is open for lot ${currentItem(game).lot}.`);
      break;
    case "RECORD_AUCTION": recordAuctionResult(game, command.playerId, command.bid); break;
    case "PASS_AUCTION":
      requirePhase(game, "auction");
      requireRule(game.mode === "solo", "Only a solo auction can close without a bid.");
      openInspectionWindow(game);
      note(game, `No bids for lot ${currentItem(game).lot}. The lot remains unsold.`);
      break;
    case "INSPECT": inspect(game, command.playerId, command.itemId, random); break;
    case "PASS_INSPECTION": {
      requirePhase(game, "inspection");
      const player = playerIn(game, command.playerId);
      requireRule(!game.inspectionDone.includes(player.id), "This player has already finished their inspection window.");
      game.inspectionDone.push(player.id);
      note(game, `${player.name} passed the inspection window.`);
      break;
    }
    case "REPAY": repayDebt(game, command.playerId, command.amount, command.loanId); break;
    case "TRADE":
      requirePhase(game, "negotiation");
      cashSale(game, command.sellerId, command.buyerId, command.itemId, command.price);
      break;
    case "TRANSFER_CASH": {
      requirePhase(game, "negotiation");
      requireRule(command.sellerId !== command.buyerId, "Choose two different players.");
      amount(command.amount, "Payment");
      const payer = playerIn(game, command.sellerId);
      const payee = playerIn(game, command.buyerId);
      spendCash(payer, command.amount);
      payee.cash += command.amount;
      note(game, `${payer.name} paid ${payee.name} ${money(command.amount)} for a table deal.`);
      break;
    }
    case "ADVANCE":
      requirePhase(game, "inspection");
      requireRule(game.players.every(player => game.inspectionDone.includes(player.id)), "Finish each player’s inspection decision first.");
      const chance = endChanceAfter(game.config, game.round);
      if (chance >= 1 || (chance > 0 && random() < chance)) {
        if (game.round < game.config.rounds) note(game, `The auction house closes after round ${game.round} (${Math.round(chance * 100)}% chance).`);
        finishGame(game);
      } else {
        if (chance > 0) note(game, `The auction house stays open (${Math.round(chance * 100)}% chance it would close).`);
        game.round++;
        game.phase = "actions";
        game.actions = {};
        game.inspectionDone = [];
        note(game, `Lot ${game.round} is now on the block.`);
      }
      break;
  }
  return game;
}
