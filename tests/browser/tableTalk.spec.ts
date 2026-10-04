import { test, expect, type Page } from "@playwright/test";
import { STORAGE_KEY } from "../../src/lib/storage";
import { executeCommand, generateGame } from "../../src/lib/gameEngine";
import { GAME_CONFIG } from "../../src/lib/config";
import { SLOTS, type GameState } from "../../src/types/game";

async function state(page: Page): Promise<GameState> {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key)!), STORAGE_KEY);
}

/** Round 3 investigation, bots done: the human owns lot 1 and Remy owns lot 2. */
function savedGame() {
  let game = generateGame(["You", "Clara", "Jules", "Remy"], GAME_CONFIG, () => 0.4, "solo");
  game.round = 3;
  game.items[0].ownerId = "player-1";
  game.items[0].purchasePrice = 100_000;
  game.items[1].ownerId = "player-4";
  game.items[1].purchasePrice = 50_000;
  for (const player of game.players.slice(1)) game = executeCommand(game, { type: "HOLD", playerId: player.id });
  return game;
}

async function open(page: Page, game: GameState) {
  await page.addInitScript(({ key, saved }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(saved));
  }, { key: STORAGE_KEY, saved: game });
  await page.goto("/");
  await page.getByRole("button", { name: "Hold · take no action" }).click();
  await page.getByRole("button", { name: "Continue to Negotiation" }).click();
}

test("bots talk through the Claude route, answer the human, and never receive hidden truths", async ({ page }) => {
  const game = savedGame();
  const bodies: string[] = [];
  await page.route("**/api/table-talk", async route => {
    const body = route.request().postData() ?? "";
    bodies.push(body);
    await route.fulfill({ json: { text: `Line from ${JSON.parse(body).bot.name}.` } });
  });
  await open(page, game);
  const talk = page.getByRole("region", { name: "Table talk" });
  for (const name of ["Clara", "Jules", "Remy"]) await expect(talk.getByText(`Line from ${name}.`)).toBeVisible();
  await expect(talk.getByText("Live", { exact: true })).toBeVisible();
  await page.getByLabel("Say something to the table").fill("Remy, is that lot genuine?");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(talk.getByText("Remy, is that lot genuine?")).toBeVisible();
  await expect(talk.getByText("Line from Remy.")).toHaveCount(2);
  expect(bodies).toHaveLength(4);
  expect(JSON.parse(bodies[3]).trigger).toEqual({ kind: "human-message", text: "Remy, is that lot genuine?" });
  for (const body of bodies) {
    expect(body).not.toContain("valueModifier");
    for (const item of game.items) for (const slot of SLOTS) expect(body).not.toContain(item.hidden[slot].truth);
  }
  expect((await state(page)).chat).toHaveLength(5);
  await page.reload();
  await expect(page.getByRole("region", { name: "Table talk" }).getByText("Remy, is that lot genuine?")).toBeVisible();
});

test("haggling through the interface: a lowball is countered, and accepting buys the item", async ({ page }) => {
  await page.route("**/api/table-talk", route => route.fulfill({ status: 503, json: { error: "Table talk is unavailable." } }));
  await open(page, savedGame());
  await expect(page.getByRole("region", { name: "Table talk" }).getByText("Offline lines", { exact: true })).toBeVisible();
  await page.getByLabel("Collector").selectOption("player-4");
  await page.getByRole("button", { name: "Buy from Remy", exact: true }).click();
  await page.getByLabel("Your price", { exact: true }).fill("1000");
  await page.getByRole("button", { name: "Make offer", exact: true }).click();
  await expect(page.getByText(/Remy will sell you lot 2/)).toBeVisible();
  await expect(page.getByText("Remy will hear 2 more offers this round.")).toBeVisible();
  const counter = (await state(page)).negotiation.offers.find(offer => offer.botId === "player-4")!;
  const cash = (await state(page)).players[0].cash;
  await page.getByRole("button", { name: "Accept Remy’s offer" }).click();
  const after = await state(page);
  expect(after.items[1].ownerId).toBe("player-1");
  expect(after.players[0].cash).toBe(cash - counter.price);
  await page.getByRole("button", { name: "Continue to Auction" }).click();
  await expect(page.getByLabel("Your bid", { exact: true })).toBeVisible();
  expect((await state(page)).negotiation.offers).toEqual([]);
});
