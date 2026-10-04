import test from "node:test";
import assert from "node:assert/strict";
import { GAME_CONFIG } from "../src/lib/config";
import { executeCommand, generateGame } from "../src/lib/gameEngine";
import { createPlaytestReport } from "../src/lib/playtestReport";
import { parseSavedGame } from "../src/lib/storage";
import { calculateItemValue } from "../src/lib/valuation";

function completedGame() {
  let game = generateGame(["You", "Clara", "Jules", "Remy"], { ...GAME_CONFIG, rounds: 2, guaranteedRounds: 2 }, () => 0.4, "solo");
  for (let round = 1; round <= 2; round++) {
    for (const player of game.players) game = executeCommand(game, { type: "BUY_CLUE", playerId: player.id, slot: "Condition" }, () => 0);
    game = executeCommand(game, { type: "START_NEGOTIATION" });
    game = executeCommand(game, { type: "START_AUCTION" });
    game = executeCommand(game, { type: "RECORD_AUCTION", playerId: "player-1", bid: 10_000 });
    game = executeCommand(game, { type: "PASS_INSPECTION", playerId: "player-1" });
    game = executeCommand(game, { type: "ADVANCE" });
  }
  return game;
}

test("AI report preserves the complete game and full ledger without changing the save", () => {
  const game = completedGame();
  const original = JSON.stringify(game);
  const exported = createPlaytestReport(game, new Date("2026-10-02T12:34:56Z"));
  const report = JSON.parse(exported.content);
  assert.equal(report.format, "mystery-auction-playtest");
  assert.equal(report.reportVersion, 2);
  assert.equal(report.exportedAt, "2026-10-02T12:34:56.000Z");
  assert.ok(exported.filename.endsWith(".json"));
  assert.deepEqual(report.game, game);
  assert.deepEqual(parseSavedGame(JSON.stringify(report.game)), game);
  assert.ok(report.game.log.length > 8);
  assert.equal(report.summary.eventCount, game.log.length);
  assert.deepEqual(report.game.log, game.log);
  assert.deepEqual(report.summary.lots.map((lot: { trueValue: number }) => lot.trueValue), game.items.map(calculateItemValue));
  assert.equal(report.summary.lots[0].lastPurchasePrice, 10_000);
  assert.ok(report.analysisContext.limitations.some((text: string) => text.includes("revealed to everyone at final settlement")));
  assert.equal(JSON.stringify(game), original);
});

test("report supports older completed saves, tied winners, and safe filenames", () => {
  const legacy = JSON.parse(JSON.stringify(completedGame()));
  delete legacy.mode;
  delete legacy.bidding;
  const restored = parseSavedGame(JSON.stringify(legacy));
  const report = JSON.parse(createPlaytestReport(restored).content);
  assert.equal(report.summary.mode, "shared");
  assert.ok(report.summary.finalAccounts.every((account: { controller: string }) => account.controller === "human"));
  const game = completedGame();
  game.scores.forEach(score => { score.netWorth = 100; });
  game.id = "../a/b\\c";
  const tied = createPlaytestReport(game);
  assert.equal(JSON.parse(tied.content).summary.winners.length, 4);
  assert.ok(JSON.parse(tied.content).summary.finalAccounts.every((account: { rank: number }) => account.rank === 1));
  assert.ok(!/[\\/]/.test(tied.filename));
});

test("reports cannot expose hidden results before the game finishes", () => {
  const game = generateGame(["One", "Two", "Three", "Four"]);
  assert.throws(() => createPlaytestReport(game), /Finish the game/);
});
