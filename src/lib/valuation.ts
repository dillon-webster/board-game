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

/** Account estimates use public base values and this owner's learned modifiers.
 * Unknown results and clues never expose an item's hidden valuation. */
export function accountItemValue(item: GameItem, player: Player) {
  const knownSlots = player.knowledge[item.id]?.appraisedSlots ?? [];
  return {
    value: Math.max(0, item.baseValue + SLOTS.reduce((sum, slot) =>
      sum + (knownSlots.includes(slot) ? item.hidden[slot].valueModifier : 0), 0)),
    estimated: !SLOTS.every(slot => knownSlots.includes(slot)),
  };
}

export function accountNetWorth(game: GameState, player: Player) {
  const values = game.items.filter(item => item.ownerId === player.id).map(item => accountItemValue(item, player));
  const collectionValue = values.reduce((sum, item) => sum + item.value, 0);
  const leverageDebt = game.loans.filter(loan => loan.playerId === player.id && loan.status === "active")
    .reduce((sum, loan) => sum + loan.remaining, 0);
  return {
    cash: player.cash,
    collectionValue,
    auctionDebt: player.auctionDebt,
    leverageDebt,
    netWorth: player.cash + collectionValue - player.auctionDebt - leverageDebt,
    estimated: values.some(item => item.estimated),
  };
}

export function endgameAppraisalCost(game: GameState, item: GameItem): number {
  const count = new Set(item.ownerAppraisedSlots).size;
  if (count === SLOTS.length) return 0;
  return count ? game.config.endgameCompletionCost : game.config.endgameFullAppraisalCost;
}

export function money(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}
