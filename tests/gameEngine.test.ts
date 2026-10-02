import test from "node:test";
import assert from "node:assert/strict";
import { GAME_CONFIG } from "../src/lib/config";
import { activeLoan, currentItem, executeCommand as run, generateGame, ownedItems } from "../src/lib/gameEngine";
import { calculateItemValue, calculateNetWorth, endgameAppraisalCost, withPenalty } from "../src/lib/valuation";
import { parseSavedGame } from "../src/lib/storage";
import { SLOTS, gameSchema, type GameState } from "../src/types/game";

const names = ["Ada", "Bo", "Cy", "Dee"];
const p1 = "player-1", p2 = "player-2", p3 = "player-3";

function seeded(seed = 42) {
  return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
}

function fresh(rounds = 10) { return generateGame(names, { ...GAME_CONFIG, rounds }, seeded()); }

function negotiation(game: GameState) {
  for (const player of game.players) if (!game.actions[player.id]) game = run(game, { type: "HOLD", playerId: player.id });
  return run(game, { type: "START_NEGOTIATION" });
}

function auction(game: GameState, playerId = p1, bid = 100_000) {
  game = negotiation(game);
  game = run(game, { type: "START_AUCTION" });
  return run(game, { type: "RECORD_AUCTION", playerId, bid });
}

function nextRound(game: GameState) {
  for (const player of game.players) if (!game.appraisalDone.includes(player.id)) game = run(game, { type: "PASS_APPRAISAL", playerId: player.id });
  return run(game, { type: "ADVANCE" });
}

test("creates four players and ten unique, compatible mysteries from five neutral templates", () => {
  const game = fresh();
  assert.equal(game.items.length, 10);
  assert.equal(new Set(game.items.map(item => item.id)).size, 10);
  assert.equal(new Set(game.items.slice(0, 5).map(item => item.templateId)).size, 5);
  assert.ok(game.players.every(player => player.cash === 500_000 && player.auctionDebt === 0));
  for (const item of game.items) for (const slot of SLOTS) assert.ok(item.hidden[slot].compatibleCategories.includes(item.category));
  const next = generateGame(names, GAME_CONFIG, seeded(99));
  assert.notDeepEqual(game.items.map(item => item.hidden), next.items.map(item => item.hidden));
  const copy = structuredClone(game.items[5].hidden);
  game.items[0].hidden.Authenticity.truth = "changed";
  assert.deepEqual(game.items[5].hidden, copy);
});

test("rejects invalid names and freezes the rules into the game", () => {
  assert.throws(() => generateGame(["A", "B", "C"]), /four/);
  assert.throws(() => generateGame(["Ada", "ada ", "Cy", "Dee"]), /different/);
  assert.throws(() => generateGame(["", "Bo", "Cy", "Dee"]), /1–32/);
  const rules = { ...GAME_CONFIG };
  const game = generateGame(names, rules);
  rules.clueCost = 123;
  assert.equal(game.config.clueCost, 5_000);
});

test("buying a clue costs cash, uses one action, and discloses no truth or modifier in knowledge or log", () => {
  const original = fresh();
  const game = run(original, { type: "BUY_CLUE", playerId: p1, slot: "Discovery" }, () => 0);
  assert.equal(game.players[0].cash, 495_000);
  const knowledge = game.players[0].knowledge["lot-1"];
  assert.equal(knowledge.clues.Discovery.length, 1);
  assert.deepEqual(knowledge.appraisedSlots, []);
  assert.ok(!JSON.stringify(knowledge).includes("valueModifier"));
  assert.ok(!JSON.stringify(knowledge).includes(currentItem(game).hidden.Discovery.truth));
  assert.ok(!JSON.stringify(game.log).includes(knowledge.clues.Discovery[0]));
  assert.equal(original.players[0].cash, 500_000);
  assert.throws(() => run(game, { type: "HOLD", playerId: p1 }), /already used/);
});

test("phase rules and failed transactions prevent duplicate sales and action skipping", () => {
  const game = fresh();
  const snapshot = JSON.stringify(game);
  assert.throws(() => run(game, { type: "START_NEGOTIATION" }), /Each player/);
  assert.throws(() => run(game, { type: "RECORD_AUCTION", playerId: p1, bid: 1 }), /only available/);
  assert.throws(() => run(game, { type: "APPRAISE", playerId: p1, itemId: "lot-1", scope: "full" }), /only available/);
  assert.equal(JSON.stringify(game), snapshot);
  const sold = auction(game);
  assert.throws(() => run(sold, { type: "RECORD_AUCTION", playerId: p2, bid: 2 }), /only available/);
  assert.throws(() => run(sold, { type: "ADVANCE" }), /appraisal decision/);
});

test("auctions consume cash first and penalize only new shortfalls", () => {
  let game = fresh();
  game.players[0].cash = 185_000;
  game.players[0].auctionDebt = 12_000;
  game = auction(game, p1, 190_000);
  assert.equal(game.players[0].cash, 0);
  assert.equal(game.players[0].auctionDebt, 18_000);
  assert.equal(currentItem(game).ownerId, p1);
  assert.equal(currentItem(game).purchasePrice, 190_000);
  assert.throws(() => run(game, { type: "APPRAISE", playerId: p1, itemId: "lot-1", scope: "full" }), /Repay auction debt/);
  game = nextRound(game);
  assert.throws(() => run(game, { type: "BUY_CLUE", playerId: p1, slot: "History" }), /Repay auction debt/);
  game = auction(game, p1, 5_000);
  assert.equal(game.players[0].auctionDebt, 24_000);
});

test("invalid and fractional bids fail without changing cash or ownership", () => {
  const game = run(negotiation(fresh()), { type: "START_AUCTION" });
  for (const bid of [-1, 0, 1.5, Infinity, NaN, 1_000_000_001]) {
    assert.throws(() => run(game, { type: "RECORD_AUCTION", playerId: p1, bid }), /whole-dollar/);
  }
  assert.equal(game.players[0].cash, 500_000);
  assert.equal(currentItem(game).ownerId, null);
});

test("appraisal window permits one cash-funded appraisal per owner, including older owned items", () => {
  let game = auction(fresh());
  game = run(game, { type: "APPRAISE", playerId: p1, itemId: "lot-1", scope: "Authenticity" });
  assert.equal(game.players[0].cash, 390_000);
  assert.deepEqual(game.players[0].knowledge["lot-1"].appraisedSlots, ["Authenticity"]);
  assert.equal(endgameAppraisalCost(game, game.items[0]), 30_000);
  assert.throws(() => run(game, { type: "APPRAISE", playerId: p1, itemId: "lot-1", scope: "full" }), /already used/);
  game = auction(nextRound(game), p2);
  game = run(game, { type: "APPRAISE", playerId: p1, itemId: "lot-1", scope: "full" });
  game = run(game, { type: "APPRAISE", playerId: p2, itemId: "lot-2", scope: "Condition" });
  assert.equal(game.items[0].ownerAppraisedSlots.length, 4);
  assert.equal(endgameAppraisalCost(game, game.items[0]), 0);
  assert.equal(game.players[1].knowledge["lot-2"].appraisedSlots.length, 1);
});

test("four partial appraisals finish an item; duplicate categories and non-owner appraisals fail", () => {
  let game = fresh();
  for (let index = 0; index < 4; index++) {
    game = auction(game, index ? p2 : p1, 1);
    if (index) assert.throws(() => run(game, { type: "APPRAISE", playerId: p1, itemId: "lot-1", scope: "Authenticity" }), /already appraised/);
    assert.throws(() => run(game, { type: "APPRAISE", playerId: p3, itemId: "lot-1", scope: "full" }), /own items/);
    game = run(game, { type: "APPRAISE", playerId: p1, itemId: "lot-1", scope: SLOTS[index] });
    if (index < 3) game = nextRound(game);
  }
  assert.equal(endgameAppraisalCost(game, game.items[0]), 0);
  assert.equal(game.players[0].knowledge["lot-1"].appraisedSlots.length, 4);
});

test("insufficient cash cannot finance clues or appraisals", () => {
  let game = fresh();
  game.players[0].cash = 4_999;
  assert.throws(() => run(game, { type: "BUY_CLUE", playerId: p1, slot: "Condition" }), /cash/);
  game = auction(game, p1, 1);
  assert.throws(() => run(game, { type: "APPRAISE", playerId: p1, itemId: "lot-1", scope: "Condition" }), /cash/);
  assert.equal(game.players[0].auctionDebt, 0);
});

test("resale below a private reserve keeps ownership; a successful resale transfers cash and resets status", () => {
  let game = auction(fresh());
  game = run(game, { type: "APPRAISE", playerId: p1, itemId: "lot-1", scope: "full" });
  game = nextRound(game);
  game = run(game, { type: "CONSIGN", playerId: p1, itemId: "lot-1", reserve: 110_001 });
  assert.ok(!JSON.stringify(game.log).includes("110001"));
  assert.throws(() => run(game, { type: "HOLD", playerId: p2 }), /pending consignment/);
  game = run(game, { type: "RESOLVE_CONSIGN", buyerId: p2, price: 100_000 });
  assert.equal(game.items[0].ownerId, p1);
  assert.equal(game.items[0].ownerAppraisedSlots.length, 4);
  game = nextRound(auction(game, p2, 1));
  game = run(game, { type: "CONSIGN", playerId: p1, itemId: "lot-1", reserve: 90_000 });
  const before = game.players.map(player => player.cash);
  const truth = structuredClone(game.items[0].hidden);
  game = run(game, { type: "RESOLVE_CONSIGN", buyerId: p2, price: 95_000 });
  assert.equal(game.players[0].cash, before[0] + 95_000);
  assert.equal(game.players[1].cash, before[1] - 95_000);
  assert.equal(game.items[0].ownerId, p2);
  assert.deepEqual(game.items[0].hidden, truth);
  assert.deepEqual(game.items[0].ownerAppraisedSlots, []);
  assert.equal(endgameAppraisalCost(game, game.items[0]), 50_000);
  assert.equal(game.players[0].knowledge["lot-1"].appraisedSlots.length, 4);
  assert.equal(game.players[1].knowledge["lot-1"], undefined);
});

test("buying an item back retains remembered knowledge but starts a new appraisal status", () => {
  let game = auction(fresh());
  game = run(game, { type: "APPRAISE", playerId: p1, itemId: "lot-1", scope: "full" });
  game = negotiation(nextRound(game));
  game = run(game, { type: "TRADE", sellerId: p1, buyerId: p2, itemId: "lot-1", price: 100_000 });
  game = run(game, { type: "TRADE", sellerId: p2, buyerId: p1, itemId: "lot-1", price: 100_000 });
  assert.equal(game.players[0].knowledge["lot-1"].appraisedSlots.length, 4);
  assert.equal(game.items[0].ownerAppraisedSlots.length, 0);
  assert.equal(endgameAppraisalCost(game, game.items[0]), 50_000);
});

test("table deals require actual cash and preserve the combined balance", () => {
  let game = negotiation(fresh());
  game = run(game, { type: "TRANSFER_CASH", sellerId: p1, buyerId: p2, amount: 25_000 });
  assert.equal(game.players[0].cash, 475_000);
  assert.equal(game.players[1].cash, 525_000);
  assert.throws(() => run(game, { type: "TRANSFER_CASH", sellerId: p1, buyerId: p2, amount: 600_000 }), /cash/);
  assert.throws(() => run(game, { type: "TRANSFER_CASH", sellerId: p1, buyerId: p1, amount: 1 }), /different/);
});

test("leverage uses public base value, limits one active loan per item, and does not block research", () => {
  let game = nextRound(auction(fresh()));
  const max = Math.floor(game.items[0].baseValue * .5);
  assert.throws(() => run(game, { type: "LEVERAGE", playerId: p1, itemId: "lot-1", amount: max + 1 }), /at most/);
  const before = game.players[0].cash;
  game = run(game, { type: "LEVERAGE", playerId: p1, itemId: "lot-1", amount: max });
  assert.equal(game.players[0].cash, before + max);
  assert.equal(activeLoan(game, "lot-1")?.remaining, withPenalty(max, .1));
  game = auction(game, p2, 1);
  game = run(game, { type: "APPRAISE", playerId: p1, itemId: "lot-1", scope: "Condition" });
  game = nextRound(game);
  assert.throws(() => run(game, { type: "LEVERAGE", playerId: p1, itemId: "lot-1", amount: 1 }), /active loan/);
  assert.throws(() => run(game, { type: "CONSIGN", playerId: p1, itemId: "lot-1", reserve: 0 }), /Repay/);
  game = run(game, { type: "BUY_CLUE", playerId: p1, slot: "History" });
  assert.equal(game.actions[p1], "clue");
});

test("auction debt can be repaid with leveraged cash; partial repayments never compound", () => {
  let game = nextRound(auction(fresh(), p1, 510_000));
  game = run(game, { type: "LEVERAGE", playerId: p1, itemId: "lot-1", amount: 20_000 });
  game = run(game, { type: "REPAY", playerId: p1, amount: 5_000 });
  assert.equal(game.players[0].auctionDebt, 7_000);
  assert.equal(game.players[0].cash, 15_000);
  assert.throws(() => run(game, { type: "REPAY", playerId: p1, amount: 7_001 }), /exceeds/);
  game = run(game, { type: "REPAY", playerId: p1, amount: 7_000 });
  assert.equal(game.players[0].auctionDebt, 0);
  assert.equal(game.players[0].cash, 8_000);
  const loanId = game.loans[0].id;
  game = run(game, { type: "REPAY", playerId: p1, loanId, amount: 8_000 });
  assert.equal(game.loans[0].remaining, 14_000);
  assert.equal(game.players[0].cash, 0);
});

test("fully repaying leverage releases collateral and allows a new loan in a later round", () => {
  let game = nextRound(auction(fresh()));
  game = run(game, { type: "LEVERAGE", playerId: p1, itemId: "lot-1", amount: 20_000 });
  game = run(game, { type: "REPAY", playerId: p1, loanId: "loan-1", amount: 22_000 });
  assert.equal(activeLoan(game, "lot-1"), undefined);
  assert.equal(game.loans[0].status, "repaid");
  game = nextRound(auction(game, p2, 1));
  game = run(game, { type: "LEVERAGE", playerId: p1, itemId: "lot-1", amount: 20_000 });
  assert.equal(game.loans.filter(loan => loan.status === "active").length, 1);
});

test("default forfeits collateral before fees and clears only that loan with no double deduction", () => {
  let game = nextRound(auction(fresh(2), p1, 510_000));
  game = run(game, { type: "LEVERAGE", playerId: p1, itemId: "lot-1", amount: 20_000 });
  game = auction(game, p2, 1);
  game = nextRound(game);
  const score = game.scores.find(score => score.playerId === p1)!;
  assert.equal(game.items[0].forfeited, true);
  assert.equal(game.items[0].ownerId, null);
  assert.equal(game.loans[0].status, "forfeited");
  assert.equal(game.loans[0].remaining, 0);
  assert.equal(score.appraisalFees, 0);
  assert.equal(score.leverageDebt, 0);
  assert.equal(score.auctionDebt, 12_000);
  assert.equal(score.netWorth, 8_000);
  assert.throws(() => run(game, { type: "ADVANCE" }), /finished/);
});

test("mandatory appraisal fees use each current owner’s status and penalize only unaffordable fees", () => {
  let game = fresh(3);
  game = auction(game, p1, 100_000);
  game = run(game, { type: "APPRAISE", playerId: p1, itemId: "lot-1", scope: "full" });
  game = nextRound(game);
  game = auction(game, p1, 100_000);
  game = run(game, { type: "APPRAISE", playerId: p1, itemId: "lot-2", scope: "History" });
  game = nextRound(game);
  game = auction(game, p1, 250_000);
  assert.equal(game.players[0].cash, 15_000);
  game = nextRound(game);
  const score = game.scores.find(score => score.playerId === p1)!;
  assert.equal(score.appraisalFees, 80_000);
  assert.equal(score.cash, 0);
  assert.equal(score.newDebt, 78_000);
  assert.equal(score.auctionDebt, 78_000);
  assert.equal(score.itemValue, game.items.reduce((sum, item) => sum + calculateItemValue(item), 0));
  assert.equal(score.netWorth, score.itemValue - 78_000);
  assert.ok(game.items.every(item => item.ownerAppraisedSlots.length === 4));
});

test("valuation floors at zero and loan penalties do not gain floating-point dollars", () => {
  const item = fresh().items[0];
  item.baseValue = 10;
  for (const slot of SLOTS) item.hidden[slot].valueModifier = -100;
  assert.equal(calculateItemValue(item), 0);
  assert.equal(withPenalty(100_000, .1), 110_000);
  assert.equal(withPenalty(5_000, .2), 6_000);
  assert.equal(withPenalty(1, .2), 2);
});

test("a complete ten-round playtest produces consistent, serializable final accounts", () => {
  let game = fresh();
  for (let round = 0; round < 10; round++) {
    const playerId = game.players[round % 4].id;
    game = run(game, { type: "BUY_CLUE", playerId, slot: SLOTS[round % 4] }, seeded(round));
    game = auction(game, playerId, 75_000);
    if (round % 3 === 0) game = run(game, { type: "APPRAISE", playerId, itemId: currentItem(game).id, scope: "full" });
    game = parseSavedGame(JSON.stringify(game));
    game = nextRound(game);
    gameSchema.parse(game);
    assert.ok(game.players.every(player => player.cash >= 0 && player.auctionDebt >= 0));
  }
  assert.equal(game.phase, "finished");
  assert.equal(game.scores.length, 4);
  for (const player of game.players) {
    assert.equal(game.scores.find(score => score.playerId === player.id)?.netWorth, calculateNetWorth(game, player));
    assert.ok(ownedItems(game, player.id).every(item => item.ownerAppraisedSlots.length === 4));
  }
  assert.deepEqual(parseSavedGame(JSON.stringify(game)), game);
});

test("save validation rejects malformed and internally inconsistent saves", () => {
  assert.throws(() => parseSavedGame("not json"));
  assert.throws(() => parseSavedGame('{"version": 999}'));
  const game = fresh();
  game.items[0].ownerId = "ghost";
  assert.throws(() => parseSavedGame(JSON.stringify(game)), /inconsistent/);
  game.items[0].ownerId = null;
  game.players[0].cash = -1;
  assert.throws(() => parseSavedGame(JSON.stringify(game)));
});
