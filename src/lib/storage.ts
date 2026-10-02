import { gameSchema, SLOTS, type GameState } from "../types/game";
import { calculateNetWorth } from "./valuation";

export const STORAGE_KEY = "mystery-auction.game.v1";

export function parseSavedGame(raw: string): GameState {
  const game = gameSchema.parse(JSON.parse(raw));
  const players = new Set(game.players.map(player => player.id));
  const items = new Set(game.items.map(item => item.id));
  const valid =
    players.size === 4 && items.size === game.config.rounds &&
    game.items.length === game.config.rounds && game.round <= game.config.rounds &&
    game.items.every((item, index) => item.lot === index + 1 &&
      (!item.ownerId || players.has(item.ownerId)) &&
      new Set(item.ownerAppraisedSlots).size === item.ownerAppraisedSlots.length &&
      (!item.forfeited || !item.ownerId) &&
      SLOTS.every(slot => item.hidden[slot].compatibleCategories.includes(item.category))) &&
    Object.keys(game.actions).every(id => players.has(id)) &&
    game.appraisalDone.every(id => players.has(id)) &&
    game.loans.every(loan => players.has(loan.playerId) && items.has(loan.itemId) &&
      (loan.status !== "active" || (loan.remaining > 0 && game.items.find(item => item.id === loan.itemId)?.ownerId === loan.playerId))) &&
    new Set(game.loans.filter(loan => loan.status === "active").map(loan => loan.itemId)).size === game.loans.filter(loan => loan.status === "active").length &&
    (!game.consignment || (game.phase === "actions" && game.items.find(item => item.id === game.consignment?.itemId)?.ownerId === game.consignment.sellerId)) &&
    (game.phase !== "finished" || (game.scores.length === 4 && game.round === game.config.rounds && game.players.every(player => game.scores.find(score => score.playerId === player.id)?.netWorth === calculateNetWorth(game, player))));
  if (!valid) throw new Error("The saved game has inconsistent state.");
  return game;
}
