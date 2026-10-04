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

test("account estimates use public base values and cannot read unknown truths, even with clues", () => {
  const game = accountGame();
  const player = game.players[0];
  const item = game.items[0];
  player.knowledge[item.id] = { clues: { Authenticity: [], Condition: [item.hidden.Condition.clues[0]], History: [], Discovery: [] } };
  for (const slot of SLOTS) Object.defineProperty(item.hidden, slot, { get() { throw new Error("Unseen value read"); } });
  assert.equal(accountNetWorth(game, player).netWorth, 248_000);
  assert.deepEqual(accountItemValue(item), { value: 100_000, estimated: true });
});

test("selling every item leaves an exact, non-estimated net worth", () => {
  const game = accountGame();
  const player = game.players[0];
  game.items[0].ownerId = game.players[1].id;
  game.loans = [];
  assert.equal(accountNetWorth(game, player).collectionValue, 0);
  assert.equal(accountNetWorth(game, player).estimated, false);
  assert.equal(accountNetWorth(game, player).netWorth, calculateNetWorth(game, player));
  player.auctionDebt = 250_000;
  assert.equal(accountNetWorth(game, player).netWorth, -70_000);
});
