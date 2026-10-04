# Mystery Auction

A playable Next.js prototype for testing the board game on one computer. Play against three local bots, control all four seats yourself, or take turns with friends. Physical cards are not needed. Shared-computer bidding and bluffing happen aloud; solo auctions take turns around the table with you and the bots.

## Run locally

This machine already has Node.js, npm, and Chromium. The project dependencies are installed locally; no Omarchy changes, accounts, API keys, or database are required.

```bash
cd /home/dillon/code/boardgame
npm run dev
```

Open **http://127.0.0.1:3000**. Keep the terminal running; press `Ctrl+C` to stop it. To reinstall dependencies on a fresh checkout, run `npm ci` first.

The game automatically saves in this browser on this address. Refreshing resumes the current game with private notes hidden. Use one game tab at a time. Starting a new game replaces the previous save; clearing browser data removes it. `localhost` and `127.0.0.1` have separate browser storage, so use the same address each time.

## Play a test game

### Play against bots

1. On the setup screen, choose **Play against bots**, enter your name, choose the game length (see **Game length** below), and open the auction house. If a saved game is open, use **New game** first (this replaces that save).
2. You control the first seat. Clara (cautious), Jules (balanced), and Remy (bold) automatically take their investigation turns. Their public actions appear in the auction ledger.
3. Buy a clue, consign an item, borrow against an item, or hold. Use your private notebook and Manage funds as usual. During negotiation, chat with the bots and trade items with them (see **Table talk and deals** below).
4. At auction, enter **Your bid** or choose **Pass this auction**. You go first, then Clara, Jules, and Remy respond one at a time. Bidding starts at $1,000, and raises must be at least $1,000. Turns circle back when you’re outbid. Passing withdraws that player for the lot; the leader sits out until outbid. When everyone else passes, the leader pays their actual bid. If everyone passes without bidding, the lot remains unsold.
5. Buy or pass your inspection, then continue to the next round. When the auction house closes, review the results.

Bots run in your browser with no API keys or services. They estimate values from the result catalog, and their own clues; they cannot see unseen item truths, future lots, or your notebook. They reserve cash for clues, never borrow, and skip inspections because they never resell. You can still use leverage and auction debt. Your own cash and net worth stay visible; opponent cash balances remain private until final results. **Manage funds** shows a breakdown of cash + collection value − auction debt − leverage debt. Items count at their public base value until final settlement, so the total is labeled an estimate whenever you own items. It does not assume collateral forfeitures.

Consigning your item starts a resale auction with the bots bidding in seat order. You watch as the seller, and the winner pays their final bid in cash. The engine checks your private reserve after bidding; if the price misses the reserve, you keep the item and the action is spent. Bot limits do not depend on the reserve. Bots do not initiate consignments.

Solo games save and resume automatically, including the current bid, bidder, and passes in an unfinished auction. Earlier solo saves pick up with turn-by-turn bidding; no new game is needed. Existing shared-computer saves remain in that mode.

### Table talk and deals (solo)

Negotiation in a solo game has two parts that are deliberately kept separate:

- **Deals are rule-based.** Each bot may open with one offer to buy one of your items or sell you one of its own. You can propose a purchase or sale to any bot, up to three proposals per bot per round. A bot accepts at or below what it would pay (90% of its confidence-scaled estimate, within its spendable cash) or at or above its asking price (110% of that estimate); otherwise it counters, and you can accept the counter. Bots value items only from public facts and their own clues. Item sales use cash and never copy notebook entries.
- **Table talk is voiced by Claude.** Bots react when negotiation opens, after each deal, and when you say something (the bots you name answer; otherwise two chime in). Each bot sees only public facts, its own clues, and a vague sense of its interest, never exact limits, hidden truths, or other notebooks. Talk can bluff, but it cannot change cash, ownership, or deal outcomes.

To enable live table talk, create `.env.local` in the project root (it is git-ignored) and restart `npm run dev`:

```bash
ANTHROPIC_API_KEY=your-key-here
# Optional: TABLE_TALK_MODEL=claude-opus-5-5 (the default)
```

Requests go through the local `/api/table-talk` route, so the key never reaches the browser. Without a key, or if a request fails, bots use short offline lines and the panel shows **Offline lines**. Each bot line is one Claude API request.

### Shared computer

1. Choose **Shared computer**. Enter four names, or keep the defaults to control all four seats. Choose the game length.
2. Each round, each player buys a clue, consigns an item, takes a leverage loan, or holds.
3. Use the private notebook to reveal clues. Other players should look away; this is a shared-computer prototype, not secure multiplayer.
4. Continue to negotiation. Optional table deals record item sales or cash payments for agreements made by the players.
5. Continue to the auction, select the winner, and enter their bid. During solo testing, simply choose the outcome you want to exercise.
6. Each owner gets one inspection purchase or pass in the Inspection Window. Manage funds lets players repay auction debt or loans.
7. Advance through the rounds. Before the last possible round, review collateral and repay any loans you want to keep. Finish to reveal every item and calculate the winner.

The in-app **How to play** dialog explains costs and debt restrictions.

## Save a playtest report

On the results screen, choose **Download playtest report** to save an AI-ready `.json` file. Attach it to an AI conversation to review game balance and possible improvements. It includes a summary of final accounts and revealed lot values, suggested review topics, data limitations, and the complete saved game: player notes, hidden item results, leverage loans, rules, final scores, and every recorded ledger entry in play order.

This works with completed games already saved in your browser. Refresh the results page if the button has not appeared. Downloading leaves your saved game unchanged; starting a new game replaces that browser save, so download first to keep the history. The JSON contains a `game` field preserving the full original state; it is an export, not an in-app import feature.

The export date is when you download the file. Event timestamps, per-turn balance snapshots, and bot reasoning were not recorded and are not reconstructed. Private notes in the report contain only clues; exact truths appear in each item’s hidden results.

## Game length

Each round puts one lot on the block. On the setup screen, choose **Guaranteed rounds** and **Maximum rounds** (1–30; defaults 7 and 10). After the guaranteed rounds, the auction house may close at the end of each round: 25% after the first, then 50%, 75%, and so on, and it always closes after the maximum. With the defaults a game lasts 7–10 rounds. Set both numbers the same for a fixed length.

This keeps players from waiting out the early rounds to buy cheap lots at the end: holding cash is a gamble when the game might end. The range and the current chance are public; the roll happens when the round advances, so it is not stored ahead of time. When the game might end after the current round, the table shows the chance and warns that unpaid collateral would be forfeited. Bots budget for the expected remaining length. Lots after an early close are never auctioned and are left out of the results and the playtest report. Saves from before this change keep their fixed length.

## Rules implemented

- Four players, $500,000 each, 7–10 rounds by default (see **Game length**).
- Five item templates, shuffled in groups of five. Each lot has its own permanent randomized mystery, even when the same template appears again.
- Four universal hidden categories; results are filtered by item compatibility. At least five possible results are available for each category on every current template.
- Clues cost $5,000. A full inspection costs $5,000 for each category the player has no clue for yet: $20,000 with no clues, less for every category already clued.
- Auction purchases use cash first, then add the shortfall plus a one-time 20% penalty to auction debt. Old debt is never penalized again. Debt blocks clues and inspections, but does not block bidding, sales, loans, or repayments.
- Each player gets at most one optional inspection per round, after the main auction, on one owned item. It adds one clue in every missing category. Exact truths and modifiers are never revealed during play.
- Item truths never change. Players retain learned clues after selling, and remembered clues are not charged again if they buy the item back.
- Leverage is capped at 50% of public base value, with a one-time 10% penalty and only one active loan per item. A fully repaid item can secure a later loan. Leverage debt does not block research.
- At game end, unpaid collateral is forfeited and its specific loan cleared before scoring, with no second loan deduction.
- Every retained item is revealed at no cost at final settlement.
- Net worth is remaining cash plus owned item true values minus remaining debt. Item values have a $0 floor. Ties share the win.

### Small V1 choices

- Player-to-player purchases require actual cash. Only main auction bids can create auction debt.
- Collateral cannot be sold until its leverage loan is fully repaid.
- Consignment uses the seller’s Phase 1 action and resolves immediately before other Phase 1 actions continue. An unmet reserve or no buyer means no sale, and the action is still used.
- Direct sales and information payments are recorded during negotiation. Information itself is shared verbally and is not copied into another notebook.
- Enter whole-dollar amounts. Auction bids must be positive; reserves and direct sale prices may be zero. Fractional-dollar penalties round up to a dollar.
- Solo mode adds turn-by-turn auctions, rule-based bot deals, and optional Claude-voiced table talk. There is no live multiplayer, authentication, database, or QR codes.

## Adjust the prototype

| File | Purpose |
| --- | --- |
| `src/lib/config.ts` | Starting cash, game length and end chance, costs, penalties, and loan limits |
| `src/lib/gameEngine.ts` | Validated game commands and round progression |
| `src/lib/bots.ts` | Bot observations, value estimates, bidding styles, and auction pricing |
| `src/lib/botGame.ts` | Automatic bot turns and solo command validation |
| `src/lib/botDeals.ts` | Bot offers, proposal decisions, and chat commands |
| `src/lib/tableTalk.ts` | What each bot may say, the table-talk prompt, and offline lines |
| `src/app/api/table-talk/route.ts` | Server route that asks Claude for a bot's line |
| `src/lib/valuation.ts` | Item valuation, inspection costs, penalties, and scoring |
| `src/data/items.ts` | Public item templates |
| `src/data/slotResults.ts` | Hidden results, clue variants, modifiers, compatibility |
| `src/types/game.ts` | State types and save schemas |
| `src/lib/storage.ts` | Saved-game validation |
| `src/components/` | Setup, dashboard, private notebook, player accounts, and results |

Rules are copied into a new game when it starts. Changes to `config.ts` apply to the next new game, preserving the rules of any saved game.

## Verify

```bash
npm test
npm run typecheck
npm run build
npm run test:e2e
```

Engine tests cover phase gates, debt, private knowledge, ownership transfer, loan defaults, inspection pricing, and complete games. Bot tests cover information boundaries, bid order, passes, actual winning prices, and auction resumption, private reserves, cash limits, all-pass auctions, old saves, and sixteen complete solo games. Browser tests use `/usr/bin/chromium` when present (otherwise Playwright’s bundled Chromium; run `npx playwright install chromium` once) to exercise full shared and solo games, an early close, private reveals, persistence, resale, repayments, and a narrow viewport. Override `CHROMIUM_PATH` if Chromium is elsewhere. Playwright starts the local server if it is not already running.

For a production-mode local server, run `npm run build` followed by `npm start`.
