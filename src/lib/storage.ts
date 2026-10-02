import { gameSchema, SLOTS, type GameState } from "../types/game";
import { calculateNetWorth } from "./valuation";
import { BID_INCREMENT } from "./bots";

export const STORAGE_KEY = "mystery-auction.game.v1";

function validBidding(game: GameState): boolean {
  const bidding = game.bidding;
  if (!bidding) return true; // Older solo saves open a fresh bidding session on resume.
  if (game.mode !== "solo" || (game.consignment ? game.phase !== "actions" : game.phase !== "auction")) return false;
  if (bidding.itemId !== (game.consignment?.itemId ?? game.items[game.round - 1]?.id)) return false;
  const seats = game.players.map(player => player.id);
  const bidders = seats.filter(id => id !== game.consignment?.sellerId);
  let turn = bidders[0], high: string | null = null, price = 0, cycle = 1;
  const passed: string[] = [];
  for (const entry of bidding.history) {
    if (entry.playerId !== turn) return false;
    if (entry.bid === null) passed.push(turn);
    else {
      if (entry.bid < price + BID_INCREMENT) return false;
      price = entry.bid;
      high = turn;
    }
    const challengers = bidders.filter(id => id !== high && !passed.includes(id));
    if (!challengers.length) return false; // A completed auction must already have settled.
    const seat = seats.indexOf(turn);
    for (let offset = 1; offset <= seats.length; offset++) {
      const next = (seat + offset) % seats.length;
      if (!challengers.includes(seats[next])) continue;
      if (next <= seat) cycle++;
      turn = seats[next];
      break;
    }
  }
  return bidding.turnPlayerId === turn && bidding.highBidderId === high && bidding.currentBid === price &&
    bidding.cycle === cycle && bidding.passedPlayerIds.length === passed.length &&
    bidding.passedPlayerIds.every((id, index) => id === passed[index]);
}

export function parseSavedGame(raw: string): GameState {
  const game = gameSchema.parse(JSON.parse(raw));
  const players = new Set(game.players.map(player => player.id));
  const items = new Set(game.items.map(item => item.id));
  const valid =
    players.size === 4 && items.size === game.config.rounds && validBidding(game) &&
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
