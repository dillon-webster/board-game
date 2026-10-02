import { SLOT_RESULTS } from "../data/slotResults";
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
  knownModifiers: Partial<Record<Slot, number>>;
};

export function observeItem(item: GameItem, player: Player): BotObservation {
  const knowledge = player.knowledge[item.id];
  return {
    baseValue: item.baseValue,
    category: item.category,
    clues: Object.fromEntries(SLOTS.map(slot => [slot, [...(knowledge?.clues[slot] ?? [])]])) as Record<Slot, string[]>,
    knownModifiers: Object.fromEntries((knowledge?.appraisedSlots ?? []).map(slot => [slot, item.hidden[slot].valueModifier])),
  };
}

export function estimateValue(observation: BotObservation): number {
  const modifier = SLOTS.reduce((total, slot) => {
    const known = observation.knownModifiers[slot];
    if (known !== undefined) return total + known;
    const pool = SLOT_RESULTS[slot].filter(result => result.compatibleCategories.includes(observation.category));
    const candidates = pool.filter(result => observation.clues[slot].every(clue => result.clues.includes(clue)));
    const mean = (results: typeof pool) => results.reduce((sum, result) => sum + result.valueModifier, 0) / results.length;
    const prior = mean(pool);
    // Treat clue evidence as a hint, reserving exact knowledge for appraisals.
    return total + (candidates.length ? prior * 0.35 + mean(candidates) * 0.65 : prior);
  }, 0);
  return Math.max(0, Math.round(observation.baseValue + modifier));
}

export function botBidLimit(game: GameState, player: Player, item: GameItem): number {
  const index = game.players.findIndex(person => person.id === player.id) - 1;
  const profile = BOT_PROFILES[index];
  if (!profile || !isBot(game, player.id)) throw new Error("Choose a computer opponent.");
  const estimate = estimateValue(observeItem(item, player));
  const roundsLeft = game.config.rounds - game.round + 1;
  const appraisalBudget = Math.min(game.config.fullAppraisalCost, game.config.endgameFullAppraisalCost);
  const available = Math.max(0, player.cash - player.auctionDebt - appraisalBudget - (roundsLeft - 1) * game.config.clueCost);
  const budgetPerLot = available / Math.max(1, roundsLeft / 4);
  const limit = Math.min(available, budgetPerLot * profile.confidence, estimate * profile.confidence - appraisalBudget, 1_000_000_000);
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
