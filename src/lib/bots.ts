import { SLOT_RESULTS } from "../data/slotResults";
import { expectedRoundsLeft } from "./gameEngine";
import { SLOTS, type GameItem, type GameState, type Player, type Slot } from "../types/game";

export const BID_INCREMENT = 1_000;
export const BOT_PROFILES = [
  { name: "Clara", style: "Cautious", confidence: 0.85 },
  { name: "Jules", style: "Balanced", confidence: 1 },
  { name: "Remy", style: "Bold", confidence: 1.15 },
] as const;

export function isBot(game: GameState, playerId: string) {
  return game.mode === "solo" && playerId !== game.players[0].id;
}

// The strategy receives only public facts and this player's learned information.
// In particular, it cannot inspect an unknown result, another notebook, or future lots.
export type BotObservation = {
  baseValue: number;
  category: GameItem["category"];
  clues: Record<Slot, string[]>;
};

export function observeItem(item: GameItem, player: Player): BotObservation {
  const knowledge = player.knowledge[item.id];
  return {
    baseValue: item.baseValue,
    category: item.category,
    clues: Object.fromEntries(SLOTS.map(slot => [slot, [...(knowledge?.clues[slot] ?? [])]])) as Record<Slot, string[]>,
  };
}

export function estimateValue(observation: BotObservation): number {
  const modifier = SLOTS.reduce((total, slot) => {
    const pool = SLOT_RESULTS[slot].filter(result => result.compatibleCategories.includes(observation.category));
    const candidates = pool.filter(result => observation.clues[slot].every(clue => result.clues.includes(clue)));
    const mean = (results: typeof pool) => results.reduce((sum, result) => sum + result.valueModifier, 0) / results.length;
    const prior = mean(pool);
    // Treat clue evidence as a hint; exact values are only revealed at final settlement.
    return total + (candidates.length ? prior * 0.35 + mean(candidates) * 0.65 : prior);
  }, 0);
  return Math.max(0, Math.round(observation.baseValue + modifier));
}

export function botProfile(game: GameState, playerId: string) {
  const profile = BOT_PROFILES[game.players.findIndex(person => person.id === playerId) - 1];
  if (!profile || !isBot(game, playerId)) throw new Error("Choose a computer opponent.");
  return profile;
}

/** Cash a bot may commit now, keeping enough for a clue in each remaining round. */
export function spendableCash(game: GameState, player: Player): number {
  const roundsLeft = expectedRoundsLeft(game.config, game.round);
  return Math.max(0, Math.floor(player.cash - player.auctionDebt - (roundsLeft - 1) * game.config.clueCost));
}

export function botBidLimit(game: GameState, player: Player, item: GameItem): number {
  const profile = botProfile(game, player.id);
  const estimate = estimateValue(observeItem(item, player));
  // Plans for the expected length, so a possible early close discourages hoarding cash.
  const roundsLeft = expectedRoundsLeft(game.config, game.round);
  const available = spendableCash(game, player);
  const budgetPerLot = available / Math.max(1, roundsLeft / 4);
  const limit = Math.min(available, budgetPerLot * profile.confidence, estimate * profile.confidence, 1_000_000_000);
  return Math.max(0, Math.floor(limit / BID_INCREMENT) * BID_INCREMENT);
}

export function botNextBid(game: GameState): number | null {
  const bidding = game.bidding!;
  const player = game.players.find(player => player.id === bidding.turnPlayerId)!;
  const item = game.items.find(item => item.id === bidding.itemId)!;
  const limit = botBidLimit(game, player, item);
  const minimum = bidding.currentBid + BID_INCREMENT;
  if (limit < minimum) return null;
  // Small visible raises keep the table moving; a bot never exceeds its own estimate.
  return Math.min(limit, bidding.currentBid ? bidding.currentBid + 5_000 : BID_INCREMENT);
}
