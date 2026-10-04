import { readFile } from "node:fs/promises";
import { test, expect } from "@playwright/test";
import { GAME_CONFIG } from "../../src/lib/config";
import { executeCommand, generateGame } from "../../src/lib/gameEngine";
import { STORAGE_KEY } from "../../src/lib/storage";
import { calculateItemValue } from "../../src/lib/valuation";

test("download a complete AI report from an existing finished save without replacing it", async ({ page }) => {
  let game = generateGame(["You", "Clara", "Jules", "Remy"], { ...GAME_CONFIG, rounds: 1, guaranteedRounds: 1 }, () => 0.4, "solo");
  for (const player of game.players) game = executeCommand(game, { type: "HOLD", playerId: player.id });
  game = executeCommand(game, { type: "START_NEGOTIATION" });
  game = executeCommand(game, { type: "START_AUCTION" });
  game = executeCommand(game, { type: "RECORD_AUCTION", playerId: "player-1", bid: 100_000 });
  game = executeCommand(game, { type: "PASS_INSPECTION", playerId: "player-1" });
  game = executeCommand(game, { type: "ADVANCE" });
  await page.addInitScript(({ key, saved }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(saved));
  }, { key: STORAGE_KEY, saved: game });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Final accounts" })).toBeVisible();
  await page.reload();
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download playtest report", exact: true }).click();
  const download = await pending;
  expect(download.suggestedFilename()).toMatch(/^mystery-auction-playtest-.*\.json$/);
  expect(await download.failure()).toBeNull();
  const report = JSON.parse(await readFile((await download.path())!, "utf8"));
  expect(report.game).toEqual(game);
  expect(report.summary.eventCount).toBe(game.log.length);
  expect(report.analysisContext.reviewTopics.length).toBeGreaterThan(0);
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), STORAGE_KEY)).toEqual(game);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "/tmp/mystery-auction-report.png", fullPage: true });
});

test("the results show each lot's sale price and profit against its true value", async ({ page }) => {
  let game = generateGame(["You", "Clara", "Jules", "Remy"], { ...GAME_CONFIG, rounds: 1, guaranteedRounds: 1 }, () => 0.4, "solo");
  for (const player of game.players) game = executeCommand(game, { type: "HOLD", playerId: player.id });
  game = executeCommand(game, { type: "START_NEGOTIATION" });
  game = executeCommand(game, { type: "START_AUCTION" });
  game = executeCommand(game, { type: "RECORD_AUCTION", playerId: "player-1", bid: 100_000 });
  game = executeCommand(game, { type: "PASS_INSPECTION", playerId: "player-1" });
  game = executeCommand(game, { type: "ADVANCE" });
  await page.addInitScript(({ key, saved }) => localStorage.setItem(key, JSON.stringify(saved)), { key: STORAGE_KEY, saved: game });
  await page.goto("/");
  const card = page.locator(".revealed-item").first();
  await expect(card.locator("summary")).toContainText("You · Paid $100,000");
  await card.locator("summary").click();
  await expect(card).toContainText("Price paid by final owner$100,000");
  const value = calculateItemValue(game.items[0]);
  await expect(card).toContainText(`${value >= 100_000 ? "Profit+" : "Loss−"}$${Math.abs(value - 100_000).toLocaleString("en-US")}`);
});
