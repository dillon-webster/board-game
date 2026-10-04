import { z } from "zod";

export const SLOTS = ["Authenticity", "Condition", "History", "Discovery"] as const;
export type Slot = (typeof SLOTS)[number];
export const CATEGORIES = ["Container", "Artwork", "Instrument", "Document", "Collectible", "Furniture", "Military", "Scientific"] as const;
export type Category = (typeof CATEGORIES)[number];

const money = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const slotMap = <T extends z.ZodType>(value: T) => z.object({
  Authenticity: value, Condition: value, History: value, Discovery: value,
});

// Saves made before uncertain endings had a fixed length: every round guaranteed.
export const configSchema = z.preprocess(value => value && typeof value === "object" && !("guaranteedRounds" in value)
  ? { ...value, guaranteedRounds: (value as { rounds?: unknown }).rounds, endChanceStep: 0 }
  : value, z.object({
  startingCash: money,
  rounds: z.number().int().min(1).max(100),
  guaranteedRounds: z.number().int().min(1).max(100),
  endChanceStep: z.number().min(0).max(1),
  clueCost: money,
  inspectionCost: money,
  auctionDebtPenalty: z.number().min(0).max(1),
  leverageLoanPercent: z.number().min(0).max(1),
  leveragePenalty: z.number().min(0).max(1),
}).refine(config => config.guaranteedRounds <= config.rounds, "Guaranteed rounds cannot exceed the maximum."));

export const hiddenResultSchema = z.object({
  id: z.string(),
  truth: z.string(),
  clues: z.array(z.string()).min(1),
  valueModifier: z.number().int(),
  compatibleCategories: z.array(z.enum(CATEGORIES)),
});
export type HiddenResult = z.infer<typeof hiddenResultSchema>;

export const itemSchema = z.object({
  id: z.string(),
  templateId: z.string(),
  name: z.string(),
  description: z.string(),
  category: z.enum(CATEGORIES),
  baseValue: money,
  lot: z.number().int().positive(),
  hidden: slotMap(hiddenResultSchema),
  ownerId: z.string().nullable(),
  purchasePrice: money.nullable(),
  forfeited: z.boolean(),
});
export type GameItem = z.infer<typeof itemSchema>;
export type ItemTemplate = Pick<GameItem, "name" | "description" | "category" | "baseValue"> & { id: string };

export const playerSchema = z.object({
  id: z.string(),
  name: z.string().trim().min(1).max(32),
  cash: money,
  auctionDebt: money,
  knowledge: z.record(z.string(), z.object({
    clues: slotMap(z.array(z.string())),
  })),
});
export type Player = z.infer<typeof playerSchema>;

const scoreSchema = z.object({
  playerId: z.string(), cash: money, itemValue: money, auctionDebt: money,
  leverageDebt: money, netWorth: z.number().int(), forfeitedItemIds: z.array(z.string()),
});

export const tableOfferSchema = z.object({
  id: z.string(),
  botId: z.string(),
  // From the bot's side: it wants to buy the human's item, or sell one of its own.
  kind: z.enum(["bot-buys", "bot-sells"]),
  itemId: z.string(),
  price: money.max(1_000_000_000),
});
export type TableOffer = z.infer<typeof tableOfferSchema>;

export const CHAT_MAX_LENGTH = 280;
const chatEntrySchema = z.object({ id: z.string(), round: z.number().int(), speakerId: z.string(), text: z.string().min(1).max(CHAT_MAX_LENGTH) });
export type ChatEntry = z.infer<typeof chatEntrySchema>;

export const gameSchema = z.object({
  // Version 2 replaced appraisals and endgame fees with clue inspections.
  version: z.literal(2),
  // Saves made before solo mode existed remain shared-computer games.
  mode: z.enum(["shared", "solo"]).default("shared"),
  id: z.string(),
  config: configSchema,
  round: z.number().int().positive(),
  phase: z.enum(["actions", "negotiation", "auction", "inspection", "finished"]),
  players: z.array(playerSchema).length(4),
  items: z.array(itemSchema),
  actions: z.record(z.string(), z.enum(["clue", "consign", "leverage", "hold"])),
  inspectionDone: z.array(z.string()),
  loans: z.array(z.object({
    id: z.string(), playerId: z.string(), itemId: z.string(), principal: money,
    remaining: money, status: z.enum(["active", "repaid", "forfeited"]),
  })),
  consignment: z.object({ sellerId: z.string(), itemId: z.string(), reserve: money }).nullable(),
  bidding: z.object({
    itemId: z.string(),
    currentBid: money.max(1_000_000_000),
    highBidderId: z.string().nullable(),
    turnPlayerId: z.string(),
    cycle: z.number().int().positive(),
    passedPlayerIds: z.array(z.string()),
    history: z.array(z.object({ playerId: z.string(), bid: money.max(1_000_000_000).nullable() })),
  }).nullable().default(null),
  log: z.array(z.object({ id: z.string(), round: z.number().int(), text: z.string() })),
  // Solo negotiation: bot offers awaiting the human, and how many proposals each bot has heard this round.
  negotiation: z.object({
    offers: z.array(tableOfferSchema),
    proposals: z.record(z.string(), z.number().int().nonnegative()),
  }).default({ offers: [], proposals: {} }),
  // Table talk is flavor only; it never changes cash, ownership, or knowledge.
  chat: z.array(chatEntrySchema).default([]),
  scores: z.array(scoreSchema),
});
export type GameState = z.infer<typeof gameSchema>;
export type Phase = GameState["phase"];
export type Score = z.infer<typeof scoreSchema>;
