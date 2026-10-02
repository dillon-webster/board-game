import { BID_INCREMENT, botNextBid, isBot } from "./bots";
import { currentItem, executeCommand, ownedItems, type Command } from "./gameEngine";
import { endgameAppraisalCost, money } from "./valuation";
import type { Random } from "./randomizer";
import { SLOTS, type GameState } from "../types/game";

export type PlayCommand = Command
  | { type: "PLACE_BID"; amount: number }
  | { type: "PASS_BID" }
  | { type: "BOT_BID_TURN" };

function openBidding(state: GameState): GameState {
  if (state.bidding) return state;
  const game = structuredClone(state);
  const first = game.players.find(player => player.id !== game.consignment?.sellerId)!;
  game.bidding = {
    itemId: game.consignment?.itemId ?? currentItem(game).id,
    currentBid: 0, highBidderId: null, turnPlayerId: first.id,
    cycle: 1, passedPlayerIds: [], history: [],
  };
  return game;
}

function takeBidTurn(state: GameState, bid: number | null, random: Random): GameState {
  const game = structuredClone(state);
  const bidding = game.bidding!;
  const playerId = bidding.turnPlayerId;
  const player = game.players.find(player => player.id === playerId)!;
  const minimum = bidding.currentBid + BID_INCREMENT;
  if (bid !== null) {
    if (!Number.isSafeInteger(bid) || bid < minimum || bid > 1_000_000_000) {
      throw new Error(`Bid at least ${money(minimum)} in whole dollars, up to $1 billion.`);
    }
    if (game.consignment && bid > player.cash) throw new Error("Resale bids must be covered by cash.");
    bidding.currentBid = bid;
    bidding.highBidderId = playerId;
  } else {
    bidding.passedPlayerIds.push(playerId);
  }
  bidding.history.push({ playerId, bid });
  game.log.push({
    id: `event-${game.log.length + 1}`, round: game.round,
    text: `${player.name} ${bid === null ? "passed" : `bid ${money(bid)}`} on ${game.consignment ? "resale " : ""}lot ${game.items.find(item => item.id === bidding.itemId)!.lot}.`,
  });
  const challengers = game.players.filter(person => person.id !== game.consignment?.sellerId &&
    !bidding.passedPlayerIds.includes(person.id) && person.id !== bidding.highBidderId);
  if (!challengers.length) {
    const command: Command = game.consignment
      ? { type: "RESOLVE_CONSIGN", buyerId: bidding.highBidderId, price: bidding.currentBid }
      : bidding.highBidderId
        ? { type: "RECORD_AUCTION", playerId: bidding.highBidderId, bid: bidding.currentBid }
        : { type: "PASS_AUCTION" };
    return runBotTurns(executeCommand(game, command, random), random);
  }
  const seat = game.players.findIndex(person => person.id === playerId);
  for (let offset = 1; offset <= game.players.length; offset++) {
    const nextSeat = (seat + offset) % game.players.length;
    const next = game.players[nextSeat];
    if (!challengers.some(person => person.id === next.id)) continue;
    if (nextSeat <= seat) bidding.cycle++;
    bidding.turnPlayerId = next.id;
    break;
  }
  return game;
}

/** Runs pending computer decisions in the same transaction as the human move.
 * Completed actions survive reloads and never run twice. Auction bids advance one turn at a time. */
export function runBotTurns(state: GameState, random: Random = Math.random): GameState {
  if (state.mode !== "solo" || state.phase === "finished") return state;
  let game = state;
  if (game.consignment || game.phase === "auction") return openBidding(game);
  for (let index = 1; index < game.players.length; index++) {
    let player = game.players[index];
    if (game.phase !== "actions" && game.phase !== "appraisal") continue;
    if (player.auctionDebt > 0 && player.cash > 0) {
      game = executeCommand(game, { type: "REPAY", playerId: player.id, amount: Math.min(player.cash, player.auctionDebt) }, random);
      player = game.players[index];
    }
    if (game.phase === "actions" && !game.actions[player.id]) {
      const canResearch = !player.auctionDebt && player.cash >= game.config.clueCost + game.config.fullAppraisalCost + BID_INCREMENT;
      game = executeCommand(game, canResearch
        ? { type: "BUY_CLUE", playerId: player.id, slot: SLOTS[(game.round + index - 2) % SLOTS.length] }
        : { type: "HOLD", playerId: player.id }, random);
    }
    if (game.phase === "appraisal" && !game.appraisalDone.includes(player.id)) {
      const item = ownedItems(game, player.id).filter(item => item.ownerAppraisedSlots.length < SLOTS.length)
        .sort((a, b) => endgameAppraisalCost(game, b) - endgameAppraisalCost(game, a))[0];
      let command: Command = { type: "PASS_APPRAISAL", playerId: player.id };
      if (item && !player.auctionDebt) {
        if (player.cash >= game.config.fullAppraisalCost && game.config.fullAppraisalCost <= endgameAppraisalCost(game, item)) {
          command = { type: "APPRAISE", playerId: player.id, itemId: item.id, scope: "full" };
        } else if (!item.ownerAppraisedSlots.length && player.cash >= game.config.partialAppraisalCost &&
          game.config.partialAppraisalCost + game.config.endgameCompletionCost < game.config.endgameFullAppraisalCost) {
          command = { type: "APPRAISE", playerId: player.id, itemId: item.id, scope: "Authenticity" };
        }
      }
      game = executeCommand(game, command, random);
    }
  }
  return game;
}

export function executePlayCommand(game: GameState, command: PlayCommand, random: Random = Math.random): GameState {
  if (command.type === "PLACE_BID" || command.type === "PASS_BID" || command.type === "BOT_BID_TURN") {
    if (game.mode !== "solo" || (!game.consignment && game.phase !== "auction")) {
      throw new Error("Turn-by-turn bidding is only available during a solo auction.");
    }
    game = openBidding(game);
    const botTurn = isBot(game, game.bidding!.turnPlayerId);
    if (command.type === "BOT_BID_TURN") {
      if (!botTurn) throw new Error("It is your turn to bid or pass.");
      return takeBidTurn(game, botNextBid(game), random);
    }
    if (botTurn) throw new Error("Wait for the computer opponents to finish their turns.");
    return takeBidTurn(game, command.type === "PLACE_BID" ? command.amount : null, random);
  }
  if (game.mode === "solo") {
    if ("playerId" in command && isBot(game, command.playerId)) throw new Error("Computer opponents take their own turns.");
    if (["RECORD_AUCTION", "PASS_AUCTION", "RESOLVE_CONSIGN", "TRADE", "TRANSFER_CASH"].includes(command.type)) {
      throw new Error("Use the solo bidding controls. Table deals are available in shared-computer mode.");
    }
  }
  return runBotTurns(executeCommand(game, command, random), random);
}
