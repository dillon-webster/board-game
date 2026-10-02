import { CATEGORIES, type Category, type HiddenResult, type Slot } from "../types/game";

function result(id: string, truth: string, valueModifier: number, clues: string[], compatibleCategories: Category[] = [...CATEGORIES]): HiddenResult {
  return { id, truth, valueModifier, clues, compatibleCategories };
}

export const SLOT_RESULTS: Record<Slot, HiddenResult[]> = {
  Authenticity: [
    result("auth-genuine", "An authentic example from its advertised period.", 50_000, ["Tool marks are consistent with period manufacturing methods.", "Wear appears continuous across both exposed and protected surfaces.", "The materials match examples in an old reference catalog."]),
    result("auth-reproduction", "A later reproduction made for the decorative market.", -80_000, ["Several details look surprisingly uniform under magnification.", "An adhesive sample seems younger than the surface finish.", "One small fitting resembles a modern catalog part."]),
    result("auth-altered", "An older object substantially altered with replacement parts.", -35_000, ["The finish changes subtly around several joins.", "Two sections show noticeably different patterns of wear.", "Some fasteners do not match the rest of the construction."]),
    result("auth-counterfeit", "A deliberate counterfeit with fabricated identifying marks.", -110_000, ["An identifying mark sits over a scratch rather than beneath it.", "The maker’s lettering differs slightly from archived examples.", "A patch of surface aging looks unusually regular."]),
    result("auth-rare", "An unusually rare authentic example from a short production run.", 130_000, ["An obscure design detail appears in an early workshop drawing.", "The maker’s mark includes a seldom-recorded variation.", "A tiny construction feature is absent from common examples."]),
    result("auth-misidentified", "A genuine object attributed to the wrong, more valuable workshop.", -50_000, ["Its regional styling conflicts with the auction catalog attribution.", "The maker’s initials could be read in more than one way.", "A construction detail resembles the work of a neighboring workshop."]),
  ],
  Condition: [
    result("condition-damaged", "Severe structural damage requires specialist restoration.", -85_000, ["A faint crack continues beneath a reinforced section.", "There is movement at a joint that should be rigid.", "A concealed surface shows signs of prolonged moisture exposure."]),
    result("condition-poor", "Poor condition, with extensive wear and old repairs.", -40_000, ["Several repairs are visible under angled light.", "The finish flakes gently at the edges.", "One stress point has been patched more than once."]),
    result("condition-average", "Average condition for its age, with ordinary wear.", 0, ["Most wear is concentrated where you would expect handling.", "The surfaces show a mixture of small scratches and intact finish.", "Routine maintenance appears to have kept deterioration in check."]),
    result("condition-preserved", "Well preserved, with stable materials and only minor wear.", 35_000, ["Protected areas retain much of their original finish.", "Delicate edges remain surprisingly sharp.", "There are few signs of repairs around the most vulnerable areas."]),
    result("condition-exceptional", "Exceptional original condition, suitable for a major collection.", 75_000, ["Even the most fragile details appear undisturbed.", "A conservator’s old storage note recommends minimal intervention.", "The least accessible surfaces look almost untouched."]),
  ],
  History: [
    result("history-none", "No meaningful documented provenance survives.", 0, ["The paper trail stops at an ordinary estate sale.", "Previous inventory records list only a generic description.", "The most recent dealer could not locate earlier ownership records."]),
    result("history-collector", "Documented ownership by an influential private collector.", 40_000, ["A collection number matches the format used by a prominent estate.", "An old label shares a distinctive typeface with a known collection.", "A receipt mentions a buyer whose surname appears in collecting journals."]),
    result("history-voyage", "Documented connection to a significant historic expedition.", 80_000, ["A faded inventory code resembles an expedition supply manifest.", "A port stamp is dated just before a well-known departure.", "An archival photograph includes a remarkably similar silhouette."]),
    result("history-person", "Verified personal ownership by a celebrated historical figure.", 120_000, ["A set of initials matches those on a notable private inventory.", "An old correspondence file describes a strikingly similar possession.", "A family estate record may connect it to a famous household."]),
    result("history-archive", "An unbroken archival record establishes important institutional use.", 60_000, ["Several inventory numbers can be traced to the same institution.", "A storage label references an unusually detailed archive.", "Dates on successive labels form a nearly continuous sequence."]),
  ],
  Discovery: [
    result("discovery-none", "A complete inspection reveals no additional contents or features.", 0, ["The visible construction accounts for nearly all of its weight.", "No unexplained gaps appear during a careful surface inspection.", "Its dimensions closely match an ordinary catalog example."]),
    result("discovery-mark", "A concealed workshop signature adds significant collector interest.", 45_000, ["A few deliberate strokes are visible on a protected inner edge.", "An inconspicuous underside has a small polished patch.", "A faint inscription appears only in raking light."]),
    result("discovery-label", "A rare original exhibition label is preserved beneath a later label.", 30_000, ["One paper label appears to have another layer beneath it.", "A sliver of ornate printing extends beyond a plain inventory sticker.", "A paper edge is thicker than expected."]),
    result("discovery-inlay", "An overlooked decorative detail contains precious metal.", 65_000, ["A small accent has tarnished differently from neighboring materials.", "One decorative part feels denser than its size suggests.", "A worn corner exposes an unexpected color beneath the surface."]),
    result("discovery-prototype", "Hidden assembly marks identify an important early design variant.", 95_000, ["An internal serial mark ends with an unfamiliar letter.", "A small detail does not appear in the standard production drawings.", "A penciled measurement remains beneath a finished surface."]),
    result("discovery-coins", "Silver coins are concealed beneath a false bottom.", 85_000, ["The bottom sounds slightly hollow when tapped.", "Unusual weight is concentrated low in the object.", "A lower panel does not sit perfectly flush."], ["Container", "Furniture", "Military"]),
    result("discovery-papers", "Valuable original correspondence survives in a hidden recess.", 110_000, ["A thin seam appears behind an interior panel.", "A dry rustling sound comes from an enclosed section.", "One lining has a small pull tab concealed at its edge."], ["Container", "Furniture", "Military"]),
    result("discovery-overpaint", "An earlier finished composition lies beneath the visible painting.", 100_000, ["An outline beneath the paint does not match the visible scene.", "Raised brushwork runs in an unexpected direction.", "A small loss in the top layer exposes a different color scheme."], ["Artwork"]),
  ],
};
