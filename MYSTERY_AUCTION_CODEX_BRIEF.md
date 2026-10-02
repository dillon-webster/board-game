# Mystery Auction — Codex Build Brief

## Confirmed rules added for the computer prototype

These decisions supersede any ambiguity in the original brief below:

- **Collateral default:** An unpaid leverage loan forfeits its collateral at game end and that specific loan is cleared. The player loses the item without also subtracting that loan from net worth. Only one active leverage loan per item is allowed.
- **Appraisal knowledge:** Hidden truth belongs to the item; learned clues and appraisal information belong to the player. Every ownership transfer gives the new owner no appraisal status, while the previous owner retains remembered information. Endgame fees use the current owner's own appraisal status for that ownership period.
- **Appraisal Window:** After each main auction, each player who owns an item may buy one appraisal on one owned item, including the lot they just won. They must pay with actual cash and have no auction debt. A player may pass instead. Mandatory endgame appraisals happen separately after Round 10.
- **Computer playtesting:** The prototype must support playing the entire game on one computer before physical components exist. One person can control all four seats; friends can also take turns at the same screen.

Implementation details and the remaining small V1 conventions are documented in `README.md`.

---

## Goal

Build a simple **web-based prototype** for a physical auction board game called **Mystery Auction**.

The web app is a **digital companion**, not the game itself.

The physical table experience should remain the focus:
- live bidding
- bluffing
- negotiation
- haggling
- player interaction

The web app should handle:
- randomized hidden item information
- private clues
- private appraisals
- player cash
- debt
- item ownership
- round progression
- final scoring

For the first prototype, keep everything simple and functional. Do not overbuild authentication, animations, QR scanning, or production infrastructure yet.

---

# Core Game Concept

There are 4 competing players.

Each player starts with:

```text
$500,000
```

The game lasts:

```text
10 rounds
```

Each round introduces one auction item.

Examples:

- Locked Sea Chest
- Dusty Oil Painting
- Military Footlocker
- Antique Telescope
- Blackwood Strongbox
- Astronomer's Cabinet
- Explorer's Trunk

Items should be described generally enough that randomized hidden information can fit them.

Do not create item names that already reveal:
- authenticity
- owner
- historical significance
- hidden contents
- final value

---

# Hidden Item System

Every item has:

1. a public base value
2. four hidden information slots

The four universal slots are:

```text
Authenticity
Condition
History
Discovery
```

## Authenticity

Examples:

- genuine
- reproduction
- altered
- counterfeit
- misidentified
- unusually rare authentic example

## Condition

Examples:

- heavily damaged
- poor
- average
- well preserved
- exceptional

## History

Examples:

- no meaningful documented history
- owned by a notable collector
- connected to a historic voyage
- tied to a famous person
- documented military use
- significant archival history

## Discovery

Examples:

- nothing unusual
- hidden compartment
- documents
- signature
- coins
- jewelry
- concealed object
- valuable contents

---

# Random Generation

When a new game is created, the app should generate the hidden mystery for all 10 items.

Each item should receive one randomized result for:

```text
Authenticity
Condition
History
Discovery
```

Each hidden result should also contain:

```text
truth
clue variants
value modifier
```

Example:

```json
{
  "slot": "Discovery",
  "truth": "Silver coins hidden beneath a false bottom",
  "clues": [
    "The interior sounds slightly hollow when tapped.",
    "There appears to be unusual weight concentrated near the bottom.",
    "The lower panel does not sit perfectly flush."
  ],
  "valueModifier": 85000
}
```

The app should randomly choose one clue variant when a player buys a clue.

A clue should provide useful evidence without directly revealing the truth.

A player should not automatically know the exact value modifier from a clue.

---

# Item Categories

The four hidden slots are universal, but some hidden results may need compatibility rules.

Possible item categories:

```text
Container
Artwork
Instrument
Document
Collectible
Furniture
Military
Scientific
```

For example:

A "silver coins hidden inside" Discovery result may fit a Container but not an Oil Painting.

Design the data structure so hidden results can specify compatible categories.

Example:

```json
{
  "compatibleCategories": ["Container", "Furniture"]
}
```

---

# Prototype Player Setup

For the first version:

- support exactly 4 players
- allow the host to enter player names
- each player starts with $500,000
- no login system is required
- one computer can control the entire game during early testing

Later this may become multiplayer across phones, but do not build that yet unless it is very easy to keep the architecture ready for it.

---

# Main Game Screen

The main game screen should show:

```text
Round X of 10
Current auction item
Public description
Base value
Current owner if already owned
Player list
Current cash
Debt status
Owned items
```

For testing, it is okay if all player information is visible on one computer.

---

# Round Flow

Each round should follow this order.

## Step 1 — Reveal Item

Display:

- item name
- public description
- category
- base value

Do not reveal hidden information.

---

## Step 2 — Phase 1 Actions

Each player gets one Phase 1 action.

Available actions:

```text
Buy a Clue
Consign
Leverage
Hold
```

For the prototype, prioritize getting **Buy a Clue** working first.

The other actions can be simpler initially.

---

# Buy a Clue

Research should not be free.

Rename the old Research action to:

```text
Buy a Clue
```

Suggested initial cost:

```text
$5,000
```

This value should be easy to change in configuration.

The player chooses one slot:

```text
Authenticity
Condition
History
Discovery
```

The app subtracts the clue cost from the player's cash.

The player privately sees one clue related to that slot.

The app should record that the player has learned the clue.

Do not reveal:

- the exact truth
- exact modifier
- exact total value

A player with outstanding auction debt cannot buy a clue.

---

# Negotiation Phase

The actual negotiation happens physically at the table.

The web app does not need to simulate conversation.

The host should simply click:

```text
Continue to Auction
```

Players may verbally:

- bluff
- lie
- sell information
- discuss likely values
- negotiate deals
- form temporary partnerships
- make direct item offers

The app does not need to enforce verbal honesty.

---

# Main Auction

The auction happens verbally at the table.

The app does not need a live bidding interface for V1.

After bidding ends, the host enters:

```text
Winning player
Winning bid
```

Then the app:

1. transfers ownership of the item
2. subtracts the player's available cash
3. creates auction debt if needed

---

# Auction Debt

Players are allowed to bid above their available cash.

Use available cash first.

Any remaining amount becomes auction debt.

Auction debt receives a one-time 20% penalty.

Example:

```text
Player cash: $185,000
Winning bid: $190,000
Shortfall: $5,000
Debt after penalty: $6,000
```

Formula:

```text
auctionDebt = shortfall * 1.20
```

For now, treat this as a **one-time 20% penalty**, not compounding interest.

While a player has auction debt:

```text
Cannot Buy a Clue
Cannot Appraise
```

They may still:

```text
Bid
Negotiate
Sell items
Consign items
Leverage items
Repay debt
```

---

# Appraisals

Appraisals are private information.

## Partial Appraisal

Cost:

```text
$10,000
```

The player chooses one hidden slot.

Reveal:

```text
truth
exact value modifier
```

Do not reveal the other three slots.

---

## Full Appraisal

Cost:

```text
$25,000
```

Reveal:

```text
all four truths
all four value modifiers
exact total item value
```

A player must pay appraisal costs with actual cash.

A player cannot finance an appraisal.

A player with auction debt cannot appraise.

---

# Item Value Calculation

For the prototype, use:

```text
True Item Value =
Base Value
+ Authenticity Modifier
+ Condition Modifier
+ History Modifier
+ Discovery Modifier
```

Prevent the final value from becoming negative.

Example:

```javascript
trueValue = Math.max(
  0,
  baseValue +
    authenticityModifier +
    conditionModifier +
    historyModifier +
    discoveryModifier
)
```

Keep this logic in one reusable function.

---

# Consign

A player may put an owned item up for resale to the other players.

The seller sets a private reserve price.

The resale auction happens verbally.

The host records:

```text
Buyer
Final sale price
```

If the reserve is not met:

```text
Seller keeps the item
```

If sold:

```text
Cash transfers
Ownership transfers
```

Previously learned private appraisal information does not automatically transfer to the new owner.

The hidden truth of the item does not change.

---

# Leverage

A player may borrow money against an owned item.

For the first prototype, use a simple rule:

```text
Maximum loan = 50% of the item's current known base value
```

Suggested loan penalty:

```text
10%
```

Example:

```text
Loan received: $100,000
Amount owed: $110,000
```

Track the item as collateral.

If the leverage debt is unpaid at the end of the game:

```text
the item is forfeited
```

Keep leverage debt separate from auction debt.

Leverage debt should not block clue purchases or appraisal.

Make these values configurable because this rule will probably change during playtesting.

---

# Hold

Hold means:

```text
Take no Phase 1 action
```

No cost.

No effect.

---

# Endgame

After Round 10, every item must have a final true value.

## Completely Unappraised Item

Mandatory full endgame appraisal:

```text
$50,000
```

The player cannot choose a partial appraisal.

---

## Partially Appraised Item

Mandatory completion cost:

```text
$30,000
```

---

## Fully Appraised Item

Additional cost:

```text
$0
```

If the player cannot afford a mandatory endgame appraisal cost:

- use all available cash first
- remaining cost becomes debt
- apply the same 20% penalty

---

# Final Scoring

Calculate:

```text
Final Net Worth =
Cash
+ True Value of Owned Items
- Outstanding Auction Debt
- Outstanding Leverage Debt
- Other Liabilities
```

Apply collateral forfeiture before final scoring if required.

The player with the highest final net worth wins.

---

# Prototype Screens

Build the prototype with a small number of simple pages or views.

Suggested structure:

```text
/
  Start Game

/game
  Main Game Dashboard

/game/item/[id]
  Current Item

/game/player/[id]
  Player Details

/game/end
  Final Results
```

A single-page implementation is also acceptable if it is faster.

---

# Recommended Tech

Use:

```text
Next.js
React
TypeScript
```

For the first prototype, avoid unnecessary infrastructure.

Use either:

```text
localStorage
```

or simple in-memory state.

Do not add a database unless needed.

Keep the game engine logic separate from the UI.

Suggested structure:

```text
src/
  app/
  components/
  data/
    items.ts
    slotResults.ts
  lib/
    gameEngine.ts
    valuation.ts
    randomizer.ts
  types/
    game.ts
```

---

# Important Architecture Rule

Keep game rules separate from UI components.

For example:

```text
generateGame()
buyClue()
recordAuctionResult()
appraiseSlot()
fullAppraisal()
repayDebt()
consignItem()
leverageItem()
calculateItemValue()
calculateNetWorth()
advanceRound()
```

These should live in the game engine rather than inside React components.

This will make it easier to change the rules during playtesting.

---

# Initial Data Requirement

Do not build hundreds of cards yet.

Start with approximately:

```text
5 auction items
```

and enough hidden results to make the randomizer meaningful.

Aim for at least:

```text
5 possible results per slot
```

where practical.

The goal is to test the system, not create final game content.

---

# First Development Milestone

The first milestone is complete when this flow works:

1. Start a new game.
2. Enter 4 player names.
3. Generate randomized mysteries.
4. Begin Round 1.
5. Display the auction item.
6. Player buys a clue.
7. Player privately sees clue.
8. Run physical auction.
9. Host records winner and price.
10. App updates cash and debt.
11. Winning player can purchase appraisal if eligible.
12. Advance to next round.
13. Repeat.
14. End the game.
15. Reveal true values.
16. Calculate final net worth.
17. Display winner.

Do not prioritize visual polish until this entire flow works.

---

# Future Features — Not Required for V1

Do not build these first, but keep them in mind:

- QR codes printed on physical cards
- join game with short code
- one phone per player
- private player views
- public table display
- public access log
- PWA / install to home screen
- real-time multiplayer
- Supabase or similar backend
- reconnecting to an active game
- host controls
- saved game history
- player-to-player clue transfers
- generated QR cards
- game statistics
- content expansion packs

---

# Future QR Concept

Eventually, physical cards may contain static QR codes.

Example:

```text
/item/3
```

or:

```text
/game/{gameId}/item/{itemId}
```

Scanning the card would open the appropriate item in the web companion.

The physical QR code should stay the same between games.

The randomized mystery should come from the current game's stored state.

Do not implement this until the base prototype is working.

---

# Design Philosophy

The digital companion should never replace the social game.

Keep these interactions physical:

```text
Bidding
Bluffing
Negotiation
Haggling
Reading other players
Making deals
```

Use the web app for:

```text
Hidden information
Randomization
Private clues
Appraisal
Money tracking
Debt tracking
Ownership
Rules enforcement
Final scoring
```

The goal is to make the app feel like the game's hidden auction-house system, not like the board game itself.

---

# Current Rule Values

Keep these in a configuration file so they are easy to change:

```typescript
export const GAME_CONFIG = {
  startingCash: 500000,
  rounds: 10,
  clueCost: 5000,
  partialAppraisalCost: 10000,
  fullAppraisalCost: 25000,
  endgameFullAppraisalCost: 50000,
  endgameCompletionCost: 30000,
  auctionDebtPenalty: 0.20,
  leverageLoanPercent: 0.50,
  leveragePenalty: 0.10,
};
```

These values are provisional and will change during playtesting.

---

# Priority

When making implementation decisions, prioritize in this order:

1. Correct game state
2. Easy rule changes
3. Clear UX
4. Fast playtesting
5. Visual polish

Build the smallest version that lets us play a complete game and learn what rules work.
