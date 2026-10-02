import test from "node:test";
import assert from "node:assert/strict";
import { generateGame } from "../src/lib/gameEngine";
import { accountItemValue, accountNetWorth, calculateNetWorth } from "../src/lib/valuation";
import { SLOTS } from "../src/types/game";

function accountGame() {
  const game = generateGame(["You", "Clara", "Jules", "Remy"]);
  const player = game.players[0];
  player.cash = 180_000;
  player.auctionDebt = 10_000;
  const item = game.items[0];
  item.ownerId = player.id;
  item.baseValue = 100_000;
  item.purchasePrice = 80_000;
  for (const [index, slot] of SLOTS.entries()) item.hidden[slot].valueModifier = [-20_000, 20_000, 30_000, 40_000][index];
  game.loans.push({ id: "loan-1", playerId: player.id, itemId: item.id, principal: 20_000, remaining: 22_000, status: "active" });
  return game;
}

test("net worth combines cash and collection, subtracting both debts without counting purchase costs twice", () => {
  const game = accountGame();
  assert.deepEqual(accountNetWorth(game, game.players[0]), {
    cash: 180_000, collectionValue: 100_000, auctionDebt: 10_000, leverageDebt: 22_000,
    netWorth: 248_000, estimated: true,
  });
  game.players[0].cash -= 5_000;
  game.loans[0].remaining -= 5_000;
  assert.equal(accountNetWorth(game, game.players[0]).netWorth, 248_000);
  game.loans[0].status = "repaid";
  assert.equal(accountNetWorth(game, game.players[0]).leverageDebt, 0);
});

test("account estimates cannot read unknown truths or use another player's appraisals", () => {
  const game = accountGame();
  const player = game.players[0];
  const item = game.items[0];
  game.players[1].knowledge[item.id] = { clues: { Authenticity: [], Condition: [], History: [], Discovery: [] }, appraisedSlots: [...SLOTS] };
  for (const slot of SLOTS) Object.defineProperty(item.hidden, slot, { get() { throw new Error("Unseen value read"); } });
  assert.equal(accountNetWorth(game, player).netWorth, 248_000);
  assert.equal(accountItemValue(item, player).estimated, true);
});

test("partial appraisals update estimates; complete remembered knowledge produces exact net worth", () => {
  const game = accountGame();
  const player = game.players[0];
  const item = game.items[0];
  player.knowledge[item.id] = { clues: { Authenticity: [], Condition: [item.hidden.Condition.clues[0]], History: [], Discovery: [] }, appraisedSlots: [] };
  assert.equal(accountItemValue(item, player).value, 100_000, "Clues do not reveal an exact modifier");
  player.knowledge[item.id].appraisedSlots = ["Condition"];
  assert.deepEqual(accountItemValue(item, player), { value: 120_000, estimated: true });
  player.knowledge[item.id].appraisedSlots = [...SLOTS];
  assert.deepEqual(item.ownerAppraisedSlots, [], "Retained knowledge can outlive the ownership period");
  assert.deepEqual(accountItemValue(item, player), { value: 170_000, estimated: false });
  assert.equal(accountNetWorth(game, player).netWorth, calculateNetWorth(game, player));
  assert.equal(accountNetWorth(game, player).estimated, false);
});

test("estimates floor individual item values at zero and exclude sold items", () => {
  const game = accountGame();
  const player = game.players[0];
  const item = game.items[0];
  player.knowledge[item.id] = { clues: { Authenticity: [], Condition: [], History: [], Discovery: [] }, appraisedSlots: ["Authenticity"] };
  item.hidden.Authenticity.valueModifier = -150_000;
  assert.equal(accountItemValue(item, player).value, 0);
  item.ownerId = game.players[1].id;
  game.loans = [];
  assert.equal(accountNetWorth(game, player).collectionValue, 0);
  assert.equal(accountNetWorth(game, player).estimated, false);
  player.auctionDebt = 250_000;
  assert.equal(accountNetWorth(game, player).netWorth, -70_000);
});
