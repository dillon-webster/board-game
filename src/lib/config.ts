export const GAME_CONFIG = {
  startingCash: 500_000,
  rounds: 10,
  clueCost: 5_000,
  partialAppraisalCost: 10_000,
  fullAppraisalCost: 25_000,
  endgameFullAppraisalCost: 50_000,
  endgameCompletionCost: 30_000,
  auctionDebtPenalty: 0.20,
  leverageLoanPercent: 0.50,
  leveragePenalty: 0.10,
};

export type GameConfig = typeof GAME_CONFIG;
