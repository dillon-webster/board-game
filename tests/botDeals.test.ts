import test from "node:test";
import assert from "node:assert/strict";
import { BOT_PROFILES } from "../src/lib/bots";
import { botBuyLimit, botSellFloor, decideProposal, MAX_PROPOSALS } from "../src/lib/botDeals";
import { executePlayCommand as play } from "../src/lib/botGame";
import { GAME_CONFIG } from "../src/lib/config";
import { executeCommand, generateGame } from "../src/lib/gameEngine";
import { parseSavedGame } from "../src/lib/storage";
import { buildTalkContext, cleanLine, fallbackLine, talkContextSchema, talkPrompt } from "../src/lib/tableTalk";
import { respondersTo } from "../src/lib/talkClient";
import { SLOTS, type GameState } from "../src/types/game";

const human = "player-1", clara = "player-2", jules = "player-3", remy = "player-4";
function seeded(seed = 42) {
  return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
}

/** Round 2 negotiation: the human owns lot 1 and Remy owns lot 2 from an earlier sale. */
function negotiating(random = seeded()): GameState {
  let game = generateGame(["Tester", ...BOT_PROFILES.map(bot => bot.name)], GAME_CONFIG, seeded(), "solo");
  const run = (command: Parameters<typeof executeCommand>[1]) => { game = executeCommand(game, command, random); };
  for (const player of game.players) run({ type: "HOLD", playerId: player.id });
  run({ type: "START_NEGOTIATION" }); run({ type: "START_AUCTION" });
  run({ type: "RECORD_AUCTION", playerId: human, bid: 100_000 });
  for (const player of game.players) if (!game.inspectionDone.includes(player.id)) run({ type: "PASS_INSPECTION", playerId: player.id });
  run({ type: "ADVANCE" });
  game.items[1].ownerId = remy;
  game.items[1].purchasePrice = 50_000;
  for (const player of game.players) run({ type: "HOLD", playerId: player.id });
  return play(game, { type: "START_NEGOTIATION" }, random);
}

test("bots always sell above what they would pay, so no bot can be traded against itself", () => {
  const game = negotiating();
  for (const bot of game.players.slice(1)) for (const item of game.items) {
    assert.ok(botSellFloor(game, bot, item) > botBuyLimit(game, bot, item), `${bot.name} lot ${item.lot}`);
  }
});

test("deal decisions cannot read unseen truths or another player's notes", () => {
  const game = negotiating();
  const bot = game.players[3];
  const before = [botBuyLimit(game, bot, game.items[0]), botSellFloor(game, bot, game.items[1])];
  game.players[0].knowledge["lot-1"] = { clues: { Authenticity: ["Human-only note"], Condition: [], History: [], Discovery: [] } };
  for (const slot of SLOTS) Object.defineProperty(game.items[0].hidden, slot, { get() { throw new Error("Hidden truth read"); } });
  assert.deepEqual([botBuyLimit(game, bot, game.items[0]), botSellFloor(game, bot, game.items[1])], before);
});

test("a low offer to buy from a bot is countered at its floor, and accepting the counter completes the sale", () => {
  let game = negotiating();
  game.negotiation.offers = [];
  const floor = botSellFloor(game, game.players[3], game.items[1]);
  game = play(game, { type: "PROPOSE_DEAL", botId: remy, kind: "buy", itemId: "lot-2", price: floor - 1_000 });
  assert.equal(game.items[1].ownerId, remy);
  const counter = game.negotiation.offers.find(offer => offer.botId === remy)!;
  assert.deepEqual([counter.kind, counter.price, counter.itemId], ["bot-sells", floor, "lot-2"]);
  const cash = game.players[0].cash;
  game = play(game, { type: "RESPOND_OFFER", offerId: counter.id, accept: true });
  assert.equal(game.items[1].ownerId, human);
  assert.equal(game.players[0].cash, cash - floor);
  assert.equal(game.negotiation.offers.length, 0);
});

test("a bot buys the human's item at or below its limit and never above it", () => {
  let game = negotiating();
  game.negotiation.offers = [];
  const bot = game.players[1];
  const limit = botBuyLimit(game, bot, game.items[0]);
  assert.ok(limit > 0);
  assert.deepEqual(decideProposal(game, bot, "sell", game.items[0], limit + 1), { accepted: false, counter: limit });
  const botCash = bot.cash;
  game = play(game, { type: "PROPOSE_DEAL", botId: clara, kind: "sell", itemId: "lot-1", price: limit });
  assert.equal(game.items[0].ownerId, clara);
  assert.equal(game.players[1].cash, botCash - limit);
  assert.equal(game.players[0].knowledge["lot-1"], undefined, "No notebook entries are created or copied");
});

test("each bot hears a limited number of proposals per round, and invalid proposals fail atomically", () => {
  let game = negotiating();
  for (let index = 0; index < MAX_PROPOSALS; index++) game = play(game, { type: "PROPOSE_DEAL", botId: jules, kind: "sell", itemId: "lot-1", price: 900_000_000 });
  assert.throws(() => play(game, { type: "PROPOSE_DEAL", botId: jules, kind: "sell", itemId: "lot-1", price: 1 }), /heard enough/);
  const snapshot = JSON.stringify(game);
  assert.throws(() => play(game, { type: "PROPOSE_DEAL", botId: remy, kind: "sell", itemId: "lot-2", price: 1 }), /your own/);
  assert.throws(() => play(game, { type: "PROPOSE_DEAL", botId: remy, kind: "buy", itemId: "lot-2", price: 600_000 }), /cash/);
  assert.throws(() => play(game, { type: "PROPOSE_DEAL", botId: human, kind: "sell", itemId: "lot-1", price: 1 }), /computer opponent/);
  assert.throws(() => play(game, { type: "PROPOSE_DEAL", botId: remy, kind: "buy", itemId: "lot-2", price: 1.5 }), /whole-dollar/);
  assert.equal(JSON.stringify(game), snapshot);
});

test("opening offers appear when negotiation opens, survive reloads, and clear when the auction starts", () => {
  let found: GameState | null = null;
  for (let seed = 1; seed < 40 && !found; seed++) {
    const game = negotiating(seeded(seed));
    if (game.negotiation.offers.length) found = game;
  }
  assert.ok(found, "Some seed produces an opening offer");
  const game = found!;
  for (const offer of game.negotiation.offers) {
    const owner = game.items.find(item => item.id === offer.itemId)!.ownerId;
    assert.equal(owner, offer.kind === "bot-buys" ? human : offer.botId);
    assert.ok(game.log.some(entry => entry.text.includes(`offered`)));
  }
  assert.deepEqual(parseSavedGame(JSON.stringify(game)), game);
  const declined = play(game, { type: "RESPOND_OFFER", offerId: game.negotiation.offers[0].id, accept: false });
  assert.equal(declined.negotiation.offers.length, game.negotiation.offers.length - 1);
  const auction = play(game, { type: "START_AUCTION" });
  assert.deepEqual(auction.negotiation, { offers: [], proposals: {} });
});

test("deals are solo-only and limited to negotiation; chat is capped and never changes the accounts", () => {
  const game = negotiating();
  const shared = { ...structuredClone(game), mode: "shared" as const };
  assert.throws(() => play(shared, { type: "PROPOSE_DEAL", botId: remy, kind: "buy", itemId: "lot-2", price: 1 }), /solo/);
  const auction = play(game, { type: "START_AUCTION" });
  assert.throws(() => play(auction, { type: "PROPOSE_DEAL", botId: remy, kind: "buy", itemId: "lot-2", price: 1 }), /during negotiation/);
  const chatted = play(game, { type: "SAY", speakerId: human, text: `  ${"x".repeat(500)}  ` });
  assert.equal(chatted.chat.at(-1)!.text.length, 280);
  assert.deepEqual(chatted.players, game.players);
  assert.deepEqual(chatted.items, game.items);
  assert.throws(() => play(game, { type: "SAY", speakerId: human, text: "   " }), /Say something/);
  assert.deepEqual(parseSavedGame(JSON.stringify(chatted)), chatted);
});

test("table-talk context carries only public facts and that bot's own clues", () => {
  let game = negotiating();
  game.players[3].knowledge["lot-2"] = { clues: { Authenticity: ["Remy's own clue"], Condition: [], History: [], Discovery: [] } };
  game.players[0].knowledge["lot-2"] = { clues: { Authenticity: ["Human secret clue"], Condition: [], History: [], Discovery: [] } };
  game.players[1].knowledge["lot-2"] = { clues: { Authenticity: ["Clara secret clue"], Condition: [], History: [], Discovery: [] } };
  game = play(game, { type: "SAY", speakerId: human, text: "Remy, what do you know?" });
  const context = buildTalkContext(game, remy, { kind: "human-message", text: "Remy, what do you know?" });
  const serialized = JSON.stringify(context) + talkPrompt(context);
  assert.ok(serialized.includes("Remy's own clue"));
  for (const secret of ["Human secret clue", "Clara secret clue", "valueModifier"]) assert.ok(!serialized.includes(secret), secret);
  for (const item of game.items) for (const slot of SLOTS) assert.ok(!serialized.includes(item.hidden[slot].truth));
  assert.ok(!/\$\d/.test(JSON.stringify(context.currentLot)), "No exact estimate or bid limit");
  assert.doesNotThrow(() => talkContextSchema.parse(JSON.parse(JSON.stringify(context))));
  // Building context must never touch an unseen result.
  for (const item of game.items) for (const slot of SLOTS) Object.defineProperty(item.hidden, slot, { get() { throw new Error("Hidden truth read"); } });
  assert.doesNotThrow(() => buildTalkContext(game, clara, { kind: "negotiation-open" }));
});

test("offline lines, reply cleanup, and responders behave predictably", () => {
  const game = negotiating();
  const context = buildTalkContext(game, remy, { kind: "negotiation-open" });
  assert.ok(fallbackLine(context).length > 0);
  assert.equal(cleanLine('Remy: "Mine, all mine."\nExtra line', "Remy"), "Mine, all mine.");
  assert.equal(cleanLine("y".repeat(400), "Remy").length, 280);
  assert.deepEqual(respondersTo(game, "clara, are you bluffing?"), [clara]);
  assert.deepEqual(respondersTo(game, "Remy and Jules, back off"), [jules, remy]);
  assert.equal(respondersTo(game, "Anyone?", () => 0).length, 2);
});
