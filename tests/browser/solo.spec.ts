import { test, expect, type Page } from "@playwright/test";
import { STORAGE_KEY } from "../../src/lib/storage";
import { generateGame } from "../../src/lib/gameEngine";
import { GAME_CONFIG } from "../../src/lib/config";
import { SLOTS, type GameState } from "../../src/types/game";

async function state(page: Page): Promise<GameState> {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key)!), STORAGE_KEY);
}

async function pauseClock(page: Page) {
  await page.clock.install({ time: new Date("2026-10-02T12:00:00Z") });
  await page.clock.pauseAt(new Date("2026-10-02T12:00:01Z"));
}

async function finishBotTurns(page: Page) {
  for (let turns = 0; turns < 500; turns++) {
    const game = await state(page);
    if (!game.bidding || game.bidding.turnPlayerId === "player-1") return;
    await page.clock.runFor(700);
  }
  throw new Error("Bot bidding did not finish");
}

test("play ten solo rounds with automatic bots, a human win, inspection, resale, and reload", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await pauseClock(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Play against bots", exact: true }).click();
  await expect(page.getByRole("textbox")).toHaveCount(1);
  await page.getByLabel("Player 1 name").fill("Tester");
  await page.getByLabel("Guaranteed rounds", { exact: true }).fill("10");
  await page.getByRole("button", { name: "Open the auction house" }).click();
  await expect(page.getByRole("button", { name: "Clara", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Manage funds", exact: true })).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Clara private notebook" })).toHaveCount(0);
  const first = await state(page);
  expect(first.mode).toBe("solo");
  const cards = page.getByRole("region", { name: "Player accounts" });
  await expect(cards.locator(".cash-balance").first()).toContainText("$500,000");
  for (const card of await cards.locator(".player-card").all()) {
    const name = await card.getByRole("heading").innerText();
    if (name !== "Tester") await expect(card.locator(".cash-balance")).toHaveText(/Available cash\s*Private/);
  }
  expect(Object.keys(first.actions)).toHaveLength(3);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Your next move" })).toBeVisible();
  expect(await state(page)).toEqual(first);

  for (let round = 1; round <= 10; round++) {
    if (round === 1) {
      await page.getByRole("button", { name: "Buy a Clue · $5,000", exact: true }).click();
      await page.getByRole("button", { name: "Reveal my private notes" }).click();
      await expect(page.locator(".clue-text")).toHaveCount(1);
      await page.getByRole("button", { name: "Hide notes & return to the table" }).click();
    } else if (round === 2) {
      await page.getByRole("button", { name: "Consign", exact: true }).click();
      await page.getByRole("button", { name: "Set a private reserve" }).click();
      await page.getByLabel("Private reserve ($)").fill("0");
      await page.getByRole("button", { name: "Consign item", exact: true }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await finishBotTurns(page);
      const game = await state(page);
      expect(game.consignment).toBeNull();
      expect(game.items[0].ownerId).not.toBe("player-1");
    } else {
      await page.getByRole("button", { name: "Hold · take no action" }).click();
    }
    await page.getByRole("button", { name: "Continue to Negotiation" }).click();
    await expect(page.getByRole("button", { name: "Record a table deal" })).toHaveCount(0);
    await page.getByRole("button", { name: "Continue to Auction" }).click();
    await expect(page.getByLabel("Winning player")).toHaveCount(0);
    if (round === 1) {
      await page.reload();
      await page.getByLabel("Your bid", { exact: true }).fill("300000");
      await page.getByRole("button", { name: "Place bid", exact: true }).click();
      await finishBotTurns(page);
      expect((await state(page)).items[0].ownerId).toBe("player-1");
      await page.getByRole("button", { name: "Purchase inspection · $15,000" }).click();
      await page.getByRole("button", { name: "Reveal my private notes" }).click();
      await expect(page.locator(".clue-text")).toHaveCount(4);
      await page.getByRole("button", { name: "Hide notes & return to the table" }).click();
    } else {
      await page.getByRole("button", { name: "Pass this auction", exact: true }).click();
      await finishBotTurns(page);
    }
    const game = await state(page);
    expect(game.players.slice(1).every(player => game.inspectionDone.includes(player.id))).toBe(true);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    if (round < 10) await page.getByRole("button", { name: "Next round", exact: true }).click();
  }
  await page.getByRole("button", { name: "Review final settlement" }).click();
  await page.getByRole("button", { name: "Finish game & reveal values" }).click();
  await expect(page.getByRole("heading", { name: "Final accounts" })).toBeVisible();
  expect((await state(page)).scores).toHaveLength(4);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Final accounts" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("solo setup and auction fit a phone screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await pauseClock(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Play against bots", exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "/tmp/mystery-auction-solo-setup.png", fullPage: true });
  await page.getByRole("button", { name: "Open the auction house" }).click();
  await page.getByRole("button", { name: "Hold · take no action" }).click();
  await page.getByRole("button", { name: "Continue to Negotiation" }).click();
  await page.getByRole("button", { name: "Continue to Auction" }).click();
  await expect(page.getByLabel("Your bid", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "/tmp/mystery-auction-solo-auction.png", fullPage: true });
});


test("bids appear one seat at a time, return to the human, and resume after reload", async ({ page }) => {
  await pauseClock(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Play against bots", exact: true }).click();
  await page.getByRole("button", { name: "Open the auction house" }).click();
  await page.getByRole("button", { name: "Hold · take no action" }).click();
  await page.getByRole("button", { name: "Continue to Negotiation" }).click();
  await page.getByRole("button", { name: "Continue to Auction" }).click();
  await page.getByLabel("Your bid", { exact: true }).fill("1000");
  await page.getByRole("button", { name: "Place bid", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Clara is deciding…");
  expect((await state(page)).bidding?.history).toEqual([{ playerId: "player-1", bid: 1000 }]);
  await page.clock.runFor(650);
  await expect(page.getByRole("status")).toHaveText("Jules is deciding…");
  expect((await state(page)).bidding?.history).toHaveLength(2);
  const saved = await state(page);
  await page.reload();
  await expect(page.getByRole("status")).toHaveText("Jules is deciding…");
  expect(await state(page)).toEqual(saved);
  await page.clock.runFor(650);
  await expect(page.getByRole("status")).toHaveText("Remy is deciding…");
  await page.clock.runFor(650);
  await expect(page.getByRole("status")).toHaveText("Your turn to bid or pass.");
  await expect(page.getByText("Bidding round 2", { exact: true })).toBeVisible();
  expect((await state(page)).bidding?.currentBid).toBe(16000);
  await expect(page.getByLabel("Your bid", { exact: true })).toHaveValue("17000");
  await page.getByRole("button", { name: "Place bid", exact: true }).click();
  expect((await state(page)).bidding?.currentBid).toBe(17000);
  await finishBotTurns(page);
  await page.getByRole("button", { name: "Pass this auction", exact: true }).click();
  await finishBotTurns(page);
  await expect(page.getByRole("heading", { name: "Inspection window" })).toBeVisible();
  const game = await state(page);
  expect(game.items[0].ownerId).not.toBe("player-1");
  expect(game.bidding).toBeNull();
  await expect(page.getByRole("button", { name: "Place bid", exact: true })).toHaveCount(0);
});

test("the account shows estimated net worth, both debts, and updates after repayment and inspection", async ({ page }) => {
  const game = generateGame(["You", "Clara", "Jules", "Remy"], GAME_CONFIG, () => 0.4, "solo");
  game.phase = "inspection";
  game.players[0].cash = 180_000;
  const item = game.items[0];
  item.ownerId = "player-1";
  item.baseValue = 100_000;
  item.purchasePrice = 80_000;
  for (const [index, slot] of SLOTS.entries()) item.hidden[slot].valueModifier = [-20_000, 20_000, 30_000, 40_000][index];
  game.loans.push({ id: "loan-1", playerId: "player-1", itemId: item.id, principal: 20_000, remaining: 22_000, status: "active" });
  await page.addInitScript(({ key, saved }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(saved));
  }, { key: STORAGE_KEY, saved: game });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator(".account-worth")).toHaveText("Est. net worth$258,000");
  await page.getByRole("button", { name: "Manage funds", exact: true }).click();
  const summary = page.getByRole("region", { name: "Net worth summary" });
  await expect(summary).toContainText("Estimated net worth");
  await expect(summary).toContainText("$258,000");
  await expect(page.locator(".account-totals")).toContainText("Estimated collection value$100,000");
  await expect(page.locator(".account-totals")).toContainText("Leverage debt$22,000");
  await page.getByLabel("Debt to repay").selectOption("loan-1");
  await page.getByLabel("Repayment amount", { exact: true }).fill("5000");
  await page.getByRole("button", { name: "Repay debt", exact: true }).click();
  await expect(summary).toContainText("$258,000");
  await expect(page.locator(".account-totals")).toContainText("Available cash$175,000");
  await page.screenshot({ path: "/tmp/mystery-auction-net-worth.png", fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: "Purchase inspection · $20,000" }).click();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.reload();
  await page.getByRole("button", { name: "Manage funds", exact: true }).click();
  // Clues never reveal exact modifiers, so only the inspection cost changes the estimate.
  await expect(summary).toContainText("$238,000");
  await expect(page.locator(".account-totals")).toContainText("Estimated collection value$100,000");
});

test("the setup screen sets the game length, and the auction house can close early", async ({ page }) => {
  await pauseClock(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Play against bots", exact: true }).click();
  await page.getByLabel("Maximum rounds", { exact: true }).fill("3");
  await page.getByLabel("Guaranteed rounds", { exact: true }).fill("4");
  await expect(page.getByText(/no higher than the maximum/).first()).toBeVisible();
  await page.getByRole("button", { name: "Open the auction house" }).click();
  expect(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY)).toBeNull();
  await page.getByLabel("Guaranteed rounds", { exact: true }).fill("2");
  await expect(page.getByText("Four collectors. 2–3 mysteries.")).toBeVisible();
  await expect(page.getByText(/After round 2, the auction house may close: 25% after each later round/)).toBeVisible();
  await page.getByRole("button", { name: "Open the auction house" }).click();
  await expect(page.locator(".round-marker")).toContainText("/ 2–3");
  const game = await state(page);
  expect([game.config.guaranteedRounds, game.config.rounds, game.items.length]).toEqual([2, 3, 3]);
  for (let round = 1; round <= 2; round++) {
    await page.getByRole("button", { name: "Hold · take no action" }).click();
    await page.getByRole("button", { name: "Continue to Negotiation" }).click();
    await page.getByRole("button", { name: "Continue to Auction" }).click();
    await page.getByRole("button", { name: "Pass this auction", exact: true }).click();
    await finishBotTurns(page);
    if (round === 1) await page.getByRole("button", { name: "Next round", exact: true }).click();
  }
  await expect(page.getByRole("note")).toHaveText(/25% chance the auction house closes after this round/);
  // A low roll closes the house at the first chance. Stubbed only now, after the app has loaded.
  await page.evaluate(() => { Math.random = () => 0.1; });
  await page.getByRole("button", { name: "Continue · the house may close" }).click();
  await expect(page.getByRole("heading", { name: "Final accounts" })).toBeVisible();
  await expect(page.getByText("All 2 lots revealed · the house closed after round 2 of 3")).toBeVisible();
  expect((await state(page)).phase).toBe("finished");
});
