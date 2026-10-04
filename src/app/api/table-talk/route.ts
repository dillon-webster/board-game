import Anthropic from "@anthropic-ai/sdk";
import { cleanLine, TALK_SYSTEM_PROMPT, talkContextSchema, talkPrompt } from "@/lib/tableTalk";

// Override with TABLE_TALK_MODEL in .env.local to trade quality for speed or cost.
const MODEL = process.env.TABLE_TALK_MODEL ?? "claude-opus-5-5";

let client: Anthropic | null = null;

/** Writes one in-character line for a bot. Deal outcomes are decided by the game rules
 * before this is called; the reply is flavor text only. */
export async function POST(request: Request) {
  const parsed = talkContextSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid table-talk context." }, { status: 400 });
  const context = parsed.data;
  try {
    client ??= new Anthropic();
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 2_000,
      output_config: { effort: "low" },
      // Re-runs a refused request on a fallback model chosen by the API.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: TALK_SYSTEM_PROMPT,
      messages: [{ role: "user", content: talkPrompt(context) }],
    });
    if (response.stop_reason === "refusal") return Response.json({ error: "No line available." }, { status: 502 });
    const text = response.content.flatMap(block => block.type === "text" ? [block.text] : []).join("\n");
    const line = cleanLine(text, context.bot.name);
    if (!line) return Response.json({ error: "No line available." }, { status: 502 });
    return Response.json({ text: line });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
      return Response.json({ error: "Claude API credentials were rejected." }, { status: 503 });
    }
    if (error instanceof Anthropic.RateLimitError) return Response.json({ error: "Rate limited." }, { status: 429 });
    if (error instanceof Anthropic.APIError) return Response.json({ error: `Claude API error ${error.status}.` }, { status: 502 });
    // Missing credentials or network failure: the client falls back to offline lines.
    return Response.json({ error: "Table talk is unavailable." }, { status: 503 });
  }
}
