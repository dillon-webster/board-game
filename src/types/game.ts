import { z } from "zod";

export const SLOTS = ["Authenticity", "Condition", "History", "Discovery"] as const;
export type Slot = (typeof SLOTS)[number];
export const CATEGORIES = ["Container", "Artwork", "Instrument", "Document", "Collectible", "Furniture", "Military", "Scientific"] as const;
export type Category = (typeof CATEGORIES)[number];

const money = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const slot = z.enum(SLOTS);
const slotMap = <T extends z.ZodType>(value: T) => z.object({
  Authenticity: value, Condition: value, History: value, Discovery: value,
});

export const configSchema = z.object({
  startingCash: money,
  rounds: z.number().int().min(1).max(100),
  clueCost: money,
  partialAppraisalCost: money,
  fullAppraisalCost: money,
  endgameFullAppraisalCost: money,
  endgameCompletionCost: money,
  auctionDebtPenalty: z.number().min(0).max(1),
  leverageLoanPercent: z.number().min(0).max(1),
  leveragePenalty: z.number().min(0).max(1),
});

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
  // Appraisal fees use the current ownership period. Knowledge is retained separately.
  ownerAppraisedSlots: z.array(slot),
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
    appraisedSlots: z.array(slot),
  })),
});
export type Player = z.infer<typeof playerSchema>;

const scoreSchema = z.object({
  playerId: z.string(), cash: money, itemValue: money, auctionDebt: money,
  leverageDebt: money, netWorth: z.number().int(), appraisalFees: money,
  newDebt: money, forfeitedItemIds: z.array(z.string()),
});

export const gameSchema = z.object({
  version: z.literal(1),
  id: z.string(),
  config: configSchema,
  round: z.number().int().positive(),
  phase: z.enum(["actions", "negotiation", "auction", "appraisal", "finished"]),
  players: z.array(playerSchema).length(4),
  items: z.array(itemSchema),
  actions: z.record(z.string(), z.enum(["clue", "consign", "leverage", "hold"])),
  appraisalDone: z.array(z.string()),
  loans: z.array(z.object({
    id: z.string(), playerId: z.string(), itemId: z.string(), principal: money,
    remaining: money, status: z.enum(["active", "repaid", "forfeited"]),
  })),
  consignment: z.object({ sellerId: z.string(), itemId: z.string(), reserve: money }).nullable(),
  log: z.array(z.object({ id: z.string(), round: z.number().int(), text: z.string() })),
  scores: z.array(scoreSchema),
});
export type GameState = z.infer<typeof gameSchema>;
export type Phase = GameState["phase"];
export type Score = z.infer<typeof scoreSchema>;
