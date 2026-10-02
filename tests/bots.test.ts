import test from "node:test";
import assert from "node:assert/strict";
import { BOT_PROFILES, botBidLimit, estimateValue, observeItem } from "../src/lib/bots";
import { executePlayCommand as play, runBotTurns } from "../src/lib/botGame";
import { GAME_CONFIG } from "../src/lib/config";
import { currentItem, executeCommand, generateGame } from "../src/lib/gameEngine";
import { parseSavedGame } from "../src/lib/storage";
import { calculateItemValue, calculateNetWorth } from "../src/lib/valuation";
import { SLOT_RESULTS } from "../src/data/slotResults";
import { SLOTS, type GameState } from "../src/types/game";

const human = "player-1";
function seeded(seed = 42) {
  return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
}
function fresh(rounds = 10, seed = 42) {
  return generateGame(["Tester", ...BOT_PROFILES.map(bot => bot.name)], { ...GAME_CONFIG, rounds }, seeded(seed), "solo");
}
function auction(state: GameState) {
  let game = runBotTurns(state, seeded());
  if (!game.actions[human]) game = play(game, { type: "HOLD", playerId: human });
  return play(play(game, { type: "START_NEGOTIATION" }), { type: "START_AUCTION" });
}
function advance(game: GameState) {
  if (!game.appraisalDone.includes(human)) game = play(game, { type: "PASS_APPRAISAL", playerId: human });
  return play(game, { type: "ADVANCE" }, seeded());
}

function finishBotBidding(game: GameState) {
  let turns = 0;
  while (game.bidding) {
    assert.notEqual(game.bidding.turnPlayerId, human, "The test must make the human decision first");
    assert.ok(turns++ < 1_000, "Bidding must terminate");
    game = play(game, { type: "BOT_BID_TURN" });
  }
  return game;
}

test("bot bidding cannot read unseen truths, other notebooks, or future lots", () => {
  const game = runBotTurns(fresh(), seeded());
  const before = game.players.slice(1).map(player => botBidLimit(game, player, currentItem(game)));
  const observation = observeItem(currentItem(game), game.players[1]);
  const changed = structuredClone(game);
  for (const item of changed.items) for (const slot of SLOTS) {
    item.hidden[slot].valueModifier = 999_999;
    item.hidden[slot].truth = "Unseen secret";
    item.hidden[slot].clues = ["Unseen clue"];
  }
  changed.players[0].knowledge = structuredClone(changed.players[1].knowledge);
  changed.players[0].knowledge["lot-1"].appraisedSlots = [...SLOTS];
  assert.deepEqual(observeItem(currentItem(changed), changed.players[1]), observation);
  assert.deepEqual(changed.players.slice(1).map(player => botBidLimit(changed, player, currentItem(changed))), before);
  // Throwing getters prove that even incidental access to an unknown slot fails.
  for (const slot of SLOTS) Object.defineProperty(game.items[0].hidden, slot, { get() { throw new Error("Hidden truth read"); } });
  assert.doesNotThrow(() => botBidLimit(game, game.players[1], currentItem(game)));
});

test("own clues influence estimates; purchased appraisals allow exact valuation", () => {
  let game = fresh();
  const item = game.items[0];
  item.hidden.Authenticity = structuredClone(SLOT_RESULTS.Authenticity.find(result => result.id === "auth-rare")!);
  const prior = estimateValue(observeItem(item, game.players[1]));
  game = executeCommand(game, { type: "BUY_CLUE", playerId: "player-2", slot: "Authenticity" }, seeded());
  assert.ok(estimateValue(observeItem(game.items[0], game.players[1])) > prior);
  game.players[1].knowledge[item.id].appraisedSlots = [...SLOTS];
  assert.equal(estimateValue(observeItem(game.items[0], game.players[1])), calculateItemValue(game.items[0]));
});

test("bidding follows human, Clara, Jules, Remy and returns to the human for another round", () => {
  let game = auction(fresh());
  assert.equal(game.bidding?.turnPlayerId, human);
  game = play(game, { type: "PLACE_BID", amount: 1_000 });
  assert.equal(game.players[0].cash, GAME_CONFIG.startingCash);
  for (const id of ["player-2", "player-3", "player-4"]) {
    assert.equal(game.bidding?.turnPlayerId, id);
    assert.throws(() => play(game, { type: "PLACE_BID", amount: 500_000 }), /Wait/);
    game = play(game, { type: "BOT_BID_TURN" });
  }
  assert.equal(game.bidding?.turnPlayerId, human);
  assert.equal(game.bidding?.cycle, 2);
  assert.deepEqual(game.bidding?.history.map(entry => entry.playerId), game.players.map(player => player.id));
  assert.equal(game.bidding?.currentBid, 16_000);
  assert.equal(game.phase, "auction");
  game = play(game, { type: "PLACE_BID", amount: 17_000 });
  assert.equal(game.bidding?.turnPlayerId, "player-2");
});

test("passing withdraws a bidder and the leader is skipped until outbid", () => {
  let game = auction(fresh());
  game.players[1].cash = 0;
  game = play(game, { type: "PLACE_BID", amount: 1_000 });
  game = play(game, { type: "BOT_BID_TURN" });
  assert.deepEqual(game.bidding?.passedPlayerIds, ["player-2"]);
  game = play(game, { type: "BOT_BID_TURN" });
  game = play(game, { type: "BOT_BID_TURN" });
  game = play(game, { type: "PASS_BID" });
  assert.equal(game.bidding?.turnPlayerId, "player-3");
  while (game.bidding) {
    assert.notEqual(game.bidding.turnPlayerId, game.bidding.highBidderId);
    assert.ok(!game.bidding.passedPlayerIds.includes(game.bidding.turnPlayerId));
    game = play(game, { type: "BOT_BID_TURN" });
  }
  assert.equal(game.phase, "appraisal");
  assert.ok(["player-3", "player-4"].includes(currentItem(game).ownerId!));
});

test("bots take turns once, resume safely, and leave the human in control", () => {
  const original = fresh();
  const game = runBotTurns(original, seeded());
  assert.deepEqual(original.actions, {});
  assert.equal(game.actions[human], undefined);
  for (const player of game.players.slice(1)) {
    assert.equal(game.actions[player.id], "clue");
    assert.equal(player.cash, GAME_CONFIG.startingCash - GAME_CONFIG.clueCost);
  }
  assert.deepEqual(runBotTurns(parseSavedGame(JSON.stringify(game))), game);
  assert.throws(() => play(game, { type: "HOLD", playerId: "player-2" }), /own turns/);
  assert.throws(() => play(game, { type: "RECORD_AUCTION", playerId: human, bid: 1_000 }), /solo bidding/);
  assert.throws(() => play(game, { type: "TRANSFER_CASH", sellerId: "player-2", buyerId: human, amount: 1 }), /Table deals/);
  assert.throws(() => play(game, { type: "PLACE_BID", amount: 1_000 }), /during a solo auction/);
});

test("old saves remain shared games and do not trigger bot automation", () => {
  const game = fresh();
  const legacy = JSON.parse(JSON.stringify(game));
  delete legacy.mode;
  const restored = parseSavedGame(JSON.stringify(legacy));
  assert.equal(restored.mode, "shared");
  assert.deepEqual(runBotTurns(restored), restored);
  assert.throws(() => play(restored, { type: "PLACE_BID", amount: 1_000 }), /solo auction/);
});

test("bids validate atomically and the winner pays their actual offer including debt", () => {
  const game = auction(fresh());
  const snapshot = JSON.stringify(game);
  for (const amount of [-1, 0, 999, 1_000.5, NaN, Infinity, 1_000_000_001]) {
    assert.throws(() => play(game, { type: "PLACE_BID", amount }), /Bid at least/);
  }
  assert.throws(() => play(game, { type: "BOT_BID_TURN" }), /your turn/);
  assert.equal(JSON.stringify(game), snapshot);
  let won = play(game, { type: "PLACE_BID", amount: 600_000 });
  assert.equal(won.players[0].cash, 500_000, "Cash is only charged when bidding closes");
  won = finishBotBidding(won);
  assert.equal(currentItem(won).ownerId, human);
  assert.equal(currentItem(won).purchasePrice, 600_000);
  assert.equal(won.players[0].cash, 0);
  assert.equal(won.players[0].auctionDebt, 120_000);
});

test("auction progress survives reloads and inconsistent bidding saves are rejected", () => {
  let game = play(auction(fresh()), { type: "PLACE_BID", amount: 1_000 });
  game = play(game, { type: "BOT_BID_TURN" });
  const restored = runBotTurns(parseSavedGame(JSON.stringify(game)));
  assert.deepEqual(restored, game);
  assert.deepEqual(play(restored, { type: "BOT_BID_TURN" }), play(game, { type: "BOT_BID_TURN" }));
  for (const patch of [{ currentBid: 1 }, { turnPlayerId: human }, { passedPlayerIds: [human] }, { highBidderId: human }, { itemId: "lot-2" }, { cycle: 10 }]) {
    const broken = structuredClone(game);
    Object.assign(broken.bidding!, patch);
    assert.throws(() => parseSavedGame(JSON.stringify(broken)), /inconsistent/);
  }
  const legacy = JSON.parse(JSON.stringify(auction(fresh())));
  delete legacy.bidding;
  const migrated = runBotTurns(parseSavedGame(JSON.stringify(legacy)));
  assert.equal(migrated.bidding?.turnPlayerId, human);
  assert.equal(migrated.bidding?.currentBid, 0);
});

test("passing lets bots win and appraise without exposing notes in the log", () => {
  const game = finishBotBidding(play(auction(fresh()), { type: "PASS_BID" }));
  const item = currentItem(game);
  assert.notEqual(item.ownerId, human);
  assert.deepEqual(item.ownerAppraisedSlots, [...SLOTS]);
  assert.ok(game.players.slice(1).every(player => game.appraisalDone.includes(player.id)));
  for (const result of Object.values(item.hidden)) assert.ok(!JSON.stringify(game.log).includes(result.truth));
});

test("cash-strapped bots hold and pass; an unsold lot still reaches final settlement", () => {
  let game = fresh(1);
  for (const player of game.players) player.cash = 0;
  game = auction(game);
  assert.ok(game.players.every(player => game.actions[player.id] === "hold"));
  game = finishBotBidding(play(game, { type: "PASS_BID" }));
  assert.equal(game.phase, "appraisal");
  assert.equal(currentItem(game).ownerId, null);
  game = advance(game);
  assert.equal(game.phase, "finished");
  assert.ok(game.scores.every(score => score.netWorth === 0 && score.appraisalFees === 0));
  assert.deepEqual(parseSavedGame(JSON.stringify(game)), game);
});

test("resale bidding uses seat order and a private reserve cannot influence the offers", () => {
  let game = finishBotBidding(play(auction(fresh()), { type: "PLACE_BID", amount: 300_000 }));
  game = advance(game);
  const listing = play(game, { type: "CONSIGN", playerId: human, itemId: "lot-1", reserve: 0 });
  assert.equal(listing.bidding?.turnPlayerId, "player-2");
  assert.throws(() => play(listing, { type: "PLACE_BID", amount: 1_000 }), /Wait/);
  const sold = finishBotBidding(listing);
  const price = sold.items[0].purchasePrice!;
  assert.ok(price > 0);
  assert.notEqual(sold.items[0].ownerId, human);
  assert.equal(sold.players[0].cash, game.players[0].cash + price);
  const rejected = finishBotBidding(play(game, { type: "CONSIGN", playerId: human, itemId: "lot-1", reserve: price + 1 }));
  assert.equal(rejected.items[0].ownerId, human);
  assert.equal(rejected.consignment, null);
  assert.equal(rejected.bidding, null);
  assert.equal(rejected.actions[human], "consign");
  assert.deepEqual(rejected.log.filter(entry => entry.text.includes(" on resale lot")), sold.log.filter(entry => entry.text.includes(" on resale lot")));
});

test("varied ten-round solo games finish with valid accounts and stable reloads", () => {
  for (let seed = 1; seed <= 16; seed++) {
    let game = fresh(10, seed);
    for (let round = 1; round <= 10; round++) {
      game = auction(game);
      game = play(game, round % 3 === 0 ? { type: "PLACE_BID", amount: 250_000 } : { type: "PASS_BID" });
      while (game.bidding) {
        game = play(game, game.bidding.turnPlayerId === human ? { type: "PASS_BID" } : { type: "BOT_BID_TURN" });
      }
      assert.equal(game.phase, "appraisal");
      for (const player of game.players.slice(1)) {
        assert.ok(player.cash >= 0);
        assert.equal(player.auctionDebt, 0);
        assert.ok(game.appraisalDone.includes(player.id));
      }
      game = parseSavedGame(JSON.stringify(game));
      game = advance(game);
      assert.deepEqual(runBotTurns(parseSavedGame(JSON.stringify(game))), game);
    }
    assert.equal(game.phase, "finished");
    assert.equal(game.scores.length, 4);
    for (const score of game.scores) assert.equal(score.netWorth, calculateNetWorth(game, game.players.find(player => player.id === score.playerId)!));
  }
});
