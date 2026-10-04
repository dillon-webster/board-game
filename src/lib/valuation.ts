import { SLOTS, type GameItem, type GameState, type Player, type Slot } from "../types/game";

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

/** Account estimates use public base values only. Clues never expose an exact modifier,
 * so true values stay hidden until final settlement. */
export function accountItemValue(item: GameItem) {
  return { value: item.baseValue, estimated: true };
}

export function accountNetWorth(game: GameState, player: Player) {
  const owned = game.items.filter(item => item.ownerId === player.id);
  const collectionValue = owned.reduce((sum, item) => sum + accountItemValue(item).value, 0);
  const leverageDebt = game.loans.filter(loan => loan.playerId === player.id && loan.status === "active")
    .reduce((sum, loan) => sum + loan.remaining, 0);
  return {
    cash: player.cash,
    collectionValue,
    auctionDebt: player.auctionDebt,
    leverageDebt,
    netWorth: player.cash + collectionValue - player.auctionDebt - leverageDebt,
    estimated: owned.length > 0,
  };
}

/** Categories this player has no clue for yet, including clues remembered from earlier ownership. */
export function missingClueSlots(player: Player, item: GameItem): Slot[] {
  const clues = player.knowledge[item.id]?.clues;
  return SLOTS.filter(slot => !clues?.[slot].length);
}

export function inspectionCost(game: GameState, player: Player, item: GameItem): number {
  return missingClueSlots(player, item).length * game.config.inspectionCost;
}

export function money(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}
