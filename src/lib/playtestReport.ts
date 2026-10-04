import { type GameState } from "../types/game";
import { calculateItemValue } from "./valuation";

/** Preserve the complete finished save, with context for automated playtest review. */
export function createPlaytestReport(game: GameState, exportedAt = new Date()) {
  if (game.phase !== "finished" || game.scores.length !== game.players.length) {
    throw new Error("Finish the game before downloading its playtest report.");
  }
  const nameOf = (id: string) => game.players.find(player => player.id === id)?.name ?? id;
  const scores = [...game.scores].sort((a, b) => b.netWorth - a.netWorth);
  const report = {
    format: "mystery-auction-playtest",
    reportVersion: 2,
    exportedAt: exportedAt.toISOString(),
    summary: {
      mode: game.mode,
      roundsCompleted: game.round,
      eventCount: game.log.length,
      winners: scores.filter(score => score.netWorth === scores[0].netWorth).map(score => ({ playerId: score.playerId, name: nameOf(score.playerId) })),
      finalAccounts: scores.map(score => ({
        ...score,
        name: nameOf(score.playerId),
        rank: scores.filter(other => other.netWorth > score.netWorth).length + 1,
        controller: game.mode === "solo" && score.playerId !== game.players[0].id ? "computer" : "human",
      })),
      // Only lots that reached the block; later lots go unplayed after an early close.
      lots: game.items.filter(item => item.lot <= game.round).map(item => ({
        itemId: item.id, lot: item.lot, name: item.name,
        baseValue: item.baseValue, trueValue: calculateItemValue(item),
        finalOwnerId: item.ownerId,
        finalOwnerName: item.ownerId ? nameOf(item.ownerId) : null,
        forfeited: item.forfeited,
        lastPurchasePrice: item.purchasePrice,
      })),
    },
    analysisContext: {
      currency: "USD; monetary values are whole dollars",
      netWorthFormula: "cash + retained item true values - auction debt - leverage debt, after settlement",
      reviewTopics: [
        "Compare winning bids and resale prices with true item values, accounting for clue and inspection costs.",
        "Review bidding competition, passes, turn order, and potential bot strategy weaknesses.",
        "Evaluate clue and inspection costs, debt penalties, leverage, and collateral forfeitures.",
        "Look for runaway leads, opportunities with little competition, and confusing or repetitive play patterns.",
        "Suggest specific rule or bot changes to test, and identify additional data needed to evaluate them.",
      ],
      limitations: [
        "This file contains one completed playtest. Proposed balance changes should be tested across more games.",
        "exportedAt is the download time. Game start time, event timestamps, and duration were not recorded.",
        "game.log is the complete recorded ledger in play order. Events have round numbers and public descriptions, not structured commands or per-turn balance snapshots.",
        "Bot bid limits, decision reasons, and the code version running at each turn were not recorded.",
        "Players only ever learn clues; exact truths and modifiers are revealed to everyone at final settlement. Clue purchase timing is in the ledger; which clue text was seen when is not recorded.",
        "game.chat is solo table talk. Bot lines may be AI-generated bluffs and never affected deals; bot deal decisions are rule-based and appear in game.log.",
        "lastPurchasePrice is the most recent sale, which may be a resale. Original auction prices and earlier transfers are in the ledger.",
        "Earlier game versions may record only auction outcomes. Missing individual bids or passes cannot be reconstructed reliably.",
      ],
    },
    // Keep all original records, including learned clues, hidden results, loans,
    // saved rule settings, and every ledger entry, without changing the save.
    game,
  };
  const safeId = game.id.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 40) || "game";
  return {
    filename: `mystery-auction-playtest-${exportedAt.toISOString().slice(0, 10)}-${safeId}.json`,
    content: JSON.stringify(report, null, 2) + "\n",
  };
}
