export const GAME_CONFIG = {
  startingCash: 500_000,
  // Maximum rounds. After the guaranteed rounds, each round may be the last:
  // the chance the auction house closes rises by endChanceStep per round.
  rounds: 10,
  guaranteedRounds: 7,
  endChanceStep: 0.25,
  clueCost: 5_000,
  // Charged per category the inspecting player has no clue for yet.
  inspectionCost: 5_000,
  auctionDebtPenalty: 0.20,
  leverageLoanPercent: 0.50,
  leveragePenalty: 0.10,
};

export type GameConfig = typeof GAME_CONFIG;
