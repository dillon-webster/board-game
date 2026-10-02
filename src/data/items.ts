import type { ItemTemplate } from "../types/game";

export const ITEM_TEMPLATES: ItemTemplate[] = [
  { id: "chest", name: "Locked Sea Chest", category: "Container", baseValue: 120_000,
    description: "An iron-bound wooden chest with a salt-worn finish. Its brass lock is closed, and a faded shipping label clings to one side." },
  { id: "painting", name: "Dusty Oil Painting", category: "Artwork", baseValue: 150_000,
    description: "A quiet coastal scene in a dark wooden frame. A layer of dust softens the colors, and the reverse is covered with old backing paper." },
  { id: "footlocker", name: "Military Footlocker", category: "Military", baseValue: 90_000,
    description: "An olive-green field locker with reinforced corners. Stenciled lettering has worn away, leaving only fragments of a name and number." },
  { id: "telescope", name: "Antique Telescope", category: "Instrument", baseValue: 180_000,
    description: "A brass telescope on a folding wooden stand. The barrel bears a small maker’s plate and a series of carefully engraved markings." },
  { id: "cabinet", name: "Astronomer’s Cabinet", category: "Furniture", baseValue: 140_000,
    description: "A narrow walnut cabinet with shallow drawers and a star-patterned inlay. The drawers are lined in faded blue felt." },
];
