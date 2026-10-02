import { SLOTS, type GameItem, type GameState, type Player } from "../types/game";

// Round fractional penalties up to a dollar, without floating-point extra dollars.
export function withPenalty(principal: number, rate: number): number {
  return principal + Math.ceil(Number((principal * rate).toFixed(6)));
}

export function calculateItemValue(item: GameItem): number {
  return Math.max(0, item.baseValue + SLOTS.reduce((sum, slot) => sum + item.hidden[slot].valueModifier, 0));
}

export function calculateNetWorth(game: GameState, player: Player): number {
  const assets = game.items.filter(item => item.ownerId === player.id).reduce((sum, item) => sum + calculateItemValue(item), 0);
  const loans = game.loans.filter(loan => loan.playerId === player.id && loan.status === "active").reduce((sum, loan) => sum + loan.remaining, 0);
  return player.cash + assets - player.auctionDebt - loans;
}

export function endgameAppraisalCost(game: GameState, item: GameItem): number {
  const count = new Set(item.ownerAppraisedSlots).size;
  if (count === SLOTS.length) return 0;
  return count ? game.config.endgameCompletionCost : game.config.endgameFullAppraisalCost;
}

export function money(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}
