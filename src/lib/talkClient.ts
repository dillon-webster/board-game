import { buildTalkContext, fallbackLine, type TalkTrigger } from "./tableTalk";
import type { GameState } from "../types/game";

export type BotLine = { botId: string; text: string; live: boolean };

/** Asks the table-talk route for a bot's line, falling back to an offline line on any failure. */
export async function requestBotLine(game: GameState, botId: string, trigger: TalkTrigger): Promise<BotLine> {
  const context = buildTalkContext(game, botId, trigger);
  try {
    const response = await fetch("/api/table-talk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(context),
    });
    const body = await response.json() as { text?: string };
    if (response.ok && body.text) return { botId, text: body.text, live: true };
  } catch {
    // Offline or the dev server is unreachable.
  }
  return { botId, text: fallbackLine(context), live: false };
}

/** Bots named in the message answer; otherwise two bots chime in. */
export function respondersTo(game: GameState, text: string, random: () => number = Math.random): string[] {
  const bots = game.players.slice(1);
  const named = bots.filter(bot => new RegExp(`\\b${bot.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(text));
  if (named.length) return named.map(bot => bot.id);
  const skipped = Math.floor(random() * bots.length);
  return bots.filter((_, index) => index !== skipped).map(bot => bot.id);
}
