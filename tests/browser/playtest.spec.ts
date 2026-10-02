import { test, expect, type Page } from "@playwright/test";
import { generateGame, executeCommand as run, type Command } from "../../src/lib/gameEngine";
import { STORAGE_KEY } from "../../src/lib/storage";
import type { GameState } from "../../src/types/game";

async function start(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Open the auction house" }).click();
  await expect(page.getByRole("heading", { name: "Every lot has a secret." })).toBeVisible();
}

async function state(page: Page): Promise<GameState> {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key)!), STORAGE_KEY);
}

async function holds(page: Page) {
  while ((await page.getByRole("button", { name: "Hold · take no action" }).count()) > 0) {
    await page.getByRole("button", { name: "Hold · take no action" }).click();
  }
  await page.getByRole("button", { name: "Continue to Negotiation" }).click();
}

test("complete a ten-round game using visible controls, with private clues, appraisal, and reload", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/");
  await page.screenshot({ path: "/tmp/mystery-auction-setup.png", fullPage: true });
  await page.getByRole("button", { name: "Open the auction house" }).click();
  await page.screenshot({ path: "/tmp/mystery-auction-game.png", fullPage: true });

  await page.getByRole("button", { name: "Buy a Clue · $5,000", exact: true }).click();
  let game = await state(page);
  expect(game.players[0].cash).toBe(495_000);
  const clue = game.players[0].knowledge["lot-1"].clues.Authenticity[0];
  await expect(page.getByText(clue, { exact: false })).toHaveCount(0);
  await page.getByRole("button", { name: "Reveal my private notes" }).click();
  await expect(page.getByText(clue, { exact: false })).toBeVisible();
  for (const hidden of Object.values(game.items[0].hidden)) await expect(page.getByText(hidden.truth, { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Hide notes & return to the table" }).click();
  await expect(page.getByText(clue, { exact: false })).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole("heading", { name: "Every lot has a secret." })).toBeVisible();
  expect((await state(page)).actions["player-1"]).toBe("clue");
  // The active player can also be selected explicitly after restoring.
  await page.getByRole("button", { name: "Player 2", exact: true }).click();

  for (let round = 1; round <= 10; round++) {
    await holds(page);
    await page.getByRole("button", { name: "Continue to Auction" }).click();
    await page.getByLabel("Winning player").selectOption(`player-${((round - 1) % 4) + 1}`);
    await page.getByLabel("Winning bid", { exact: true }).fill("75000");
    await page.getByRole("button", { name: "Record auction result" }).click();
    if (round === 1) {
      await page.getByRole("button", { name: "Purchase appraisal · $25,000" }).click();
      await page.getByRole("button", { name: "Reveal my private notes" }).click();
      await expect(page.getByText("Exact item value", { exact: true })).toBeVisible();
      game = await state(page);
      for (const result of Object.values(game.items[0].hidden)) await expect(page.getByText(result.truth, { exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Hide notes & return to the table" }).click();
    }
    while ((await page.getByRole("button", { name: "Pass appraisal window" }).count()) > 0) await page.getByRole("button", { name: "Pass appraisal window" }).click();
    if (round < 10) await page.getByRole("button", { name: "Next round", exact: true }).click();
  }
  await page.getByRole("button", { name: "Review final settlement" }).click();
  await page.getByRole("button", { name: "Finish game & reveal values" }).click();
  await expect(page.getByRole("heading", { name: "Final accounts" })).toBeVisible();
  game = await state(page);
  expect(game.phase).toBe("finished");
  expect(game.scores).toHaveLength(4);
  await page.screenshot({ path: "/tmp/mystery-auction-results.png", fullPage: true });
  await page.reload();
  await expect(page.getByRole("heading", { name: "Final accounts" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("resale, private reserve, borrowing, and debt repayment work through the interface", async ({ page }) => {
  await start(page);
  await holds(page);
  await page.getByRole("button", { name: "Continue to Auction" }).click();
  await page.getByLabel("Winning bid", { exact: true }).fill("510000");
  await expect(page.getByText("New auction debt: $12,000", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Record auction result" }).click();
  await expect(page.getByRole("button", { name: "Purchase appraisal · $25,000" })).toBeDisabled();
  await page.getByRole("button", { name: "Pass appraisal window" }).click();
  await page.getByRole("button", { name: "Next round", exact: true }).click();
  await page.getByRole("button", { name: "Leverage", exact: true }).click();
  await page.getByLabel("Loan amount", { exact: true }).fill("50000");
  await page.getByRole("button", { name: "Take leverage loan" }).click();
  await page.getByRole("button", { name: "Manage funds", exact: true }).first().click();
  await page.getByRole("button", { name: "Use maximum cash" }).click();
  await page.getByRole("button", { name: "Repay debt", exact: true }).click();
  expect((await state(page)).players[0].auctionDebt).toBe(0);
  await page.getByRole("button", { name: "Close dialog" }).click();
  await holds(page);
  await page.getByRole("button", { name: "Record a table deal" }).click();
  await page.getByLabel("Paying player").selectOption("player-2");
  await page.getByLabel("Receiving player").selectOption("player-1");
  await page.getByLabel("Payment amount", { exact: true }).fill("50000");
  await page.getByRole("button", { name: "Record agreed deal" }).click();
  await page.getByRole("button", { name: "Manage funds", exact: true }).first().click();
  await page.getByLabel("Debt to repay").selectOption("loan-1");
  await page.getByRole("button", { name: "Use maximum cash" }).click();
  await page.getByRole("button", { name: "Repay debt", exact: true }).click();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: "Continue to Auction" }).click();
  await page.getByLabel("Winning player").selectOption("player-2");
  await page.getByLabel("Winning bid", { exact: true }).fill("1000");
  await page.getByRole("button", { name: "Record auction result" }).click();
  while ((await page.getByRole("button", { name: "Pass appraisal window" }).count()) > 0) await page.getByRole("button", { name: "Pass appraisal window" }).click();
  await page.getByRole("button", { name: "Next round", exact: true }).click();
  await page.getByRole("button", { name: "Consign", exact: true }).click();
  await page.getByRole("button", { name: "Set a private reserve" }).click();
  await page.getByLabel("Private reserve ($)").fill("123456");
  await page.getByRole("button", { name: "Consign item", exact: true }).click();
  await expect(page.getByText("123456", { exact: false })).toHaveCount(0);
  await page.getByLabel("Final resale price", { exact: true }).fill("150000");
  await page.getByRole("button", { name: "Record resale", exact: true }).click();
  const game = await state(page);
  expect(game.items[0].ownerId).toBe("player-2");
  expect(game.items[0].ownerAppraisedSlots).toEqual([]);
  expect(game.loans[0].status).toBe("repaid");
});

test("mobile layout stays within the viewport and notebook closes without exposing information", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await start(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "/tmp/mystery-auction-mobile.png", fullPage: true });
  await page.getByRole("button", { name: "Player 1 private notebook" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "New game" }).click();
  await page.getByRole("button", { name: "Keep this game" }).click();
  expect((await state(page)).round).toBe(1);
});

test("malformed saves show a recovery message and allow a fresh game", async ({ page }) => {
  await page.addInitScript(key => localStorage.setItem(key, '{"broken":true}'), STORAGE_KEY);
  await page.goto("/");
  await expect(page.locator(".error-banner")).toContainText("saved game could not be loaded");
  await page.getByRole("button", { name: "Open the auction house" }).click();
  await expect(page.getByRole("heading", { name: "Every lot has a secret." })).toBeVisible();
  await expect(page.locator(".error-banner")).toHaveCount(0);
});

test("partial appraisal renders exactly one truth and no total valuation", async ({ page }) => {
  let game = generateGame(["One", "Two", "Three", "Four"]);
  const commands: Command[] = game.players.map(player => ({ type: "HOLD", playerId: player.id }));
  commands.push({ type: "START_NEGOTIATION" }, { type: "START_AUCTION" }, { type: "RECORD_AUCTION", playerId: "player-1", bid: 100_000 });
  for (const command of commands) game = run(game, command);
  await page.addInitScript(({ key, game }) => localStorage.setItem(key, JSON.stringify(game)), { key: STORAGE_KEY, game });
  await page.goto("/");
  await page.getByLabel("Appraisal type").selectOption("Condition");
  await page.getByRole("button", { name: "Purchase appraisal · $10,000" }).click();
  await page.getByRole("button", { name: "Reveal my private notes" }).click();
  await expect(page.getByText(game.items[0].hidden.Condition.truth, { exact: true })).toBeVisible();
  await expect(page.getByText(game.items[0].hidden.Authenticity.truth, { exact: true })).toHaveCount(0);
  await expect(page.getByText("Exact item value", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Hide notes & return to the table" }).click();
});
