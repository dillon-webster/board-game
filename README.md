# Mystery Auction

A playable Next.js prototype for testing the board game on one computer. You can control all four seats yourself or take turns with friends. Physical cards are not needed. Bidding and bluffing happen aloud; the host enters the auction result.

## Run locally

This machine already has Node.js, npm, and Chromium. The project dependencies are installed locally; no Omarchy changes, accounts, API keys, or database are required.

```bash
cd /home/dillon/code/boardgame
npm run dev
```

Open **http://127.0.0.1:3000**. Keep the terminal running; press `Ctrl+C` to stop it. To reinstall dependencies on a fresh checkout, run `npm ci` first.

The game automatically saves in this browser on this address. Refreshing resumes the current game with private notes hidden. Use one game tab at a time. Starting a new game replaces the previous save; clearing browser data removes it. `localhost` and `127.0.0.1` have separate browser storage, so use the same address each time.

## Play a test game

1. Enter four names, or keep the defaults to control all four seats.
2. Each round, each player buys a clue, consigns an item, takes a leverage loan, or holds.
3. Use the private notebook to reveal clues and appraisal results. Other players should look away; this is a shared-computer prototype, not secure multiplayer.
4. Continue to negotiation. Optional table deals record item sales or cash payments for agreements made by the players.
5. Continue to the auction, select the winner, and enter their bid. During solo testing, simply choose the outcome you want to exercise.
6. Each owner gets one appraisal purchase or pass in the Appraisal Window. Manage funds lets players repay auction debt or loans.
7. Advance through ten rounds. Before final settlement, review fees and collateral and repay any loans you want to keep. Finish to reveal every item and calculate the winner.

The in-app **How to play** dialog explains costs and debt restrictions.

## Rules implemented

- Four players, $500,000 each, ten rounds.
- Five item templates, shuffled in groups of five. Each lot has its own permanent randomized mystery, even when the same template appears again.
- Four universal hidden categories; results are filtered by item compatibility. At least five possible results are available for each category on every current template.
- Clues cost $5,000. Partial appraisals cost $10,000; full appraisals cost $25,000.
- Auction purchases use cash first, then add the shortfall plus a one-time 20% penalty to auction debt. Old debt is never penalized again. Debt blocks clues and appraisals, but does not block bidding, sales, loans, or repayments.
- Each player gets at most one optional appraisal per round, after the main auction, on one owned item. Four separate partial appraisals also count as fully appraised.
- Item truths never change. Players retain learned clues and truths after selling. Each ownership transfer resets the new owner’s fee-related appraisal status, including if a previous owner buys an item back. Remembered truths remain available in that player’s notebook.
- Leverage is capped at 50% of public base value, with a one-time 10% penalty and only one active loan per item. A fully repaid item can secure a later loan. Leverage debt does not block research.
- At game end, unpaid collateral is forfeited and its specific loan cleared **before** mandatory appraisals. Forfeited items incur no appraisal fee and no second loan deduction.
- Retained items cost $50,000 to appraise if unappraised by the current owner, $30,000 if partially appraised, and $0 if fully appraised. Unaffordable fees use the same shortfall/debt rule.
- Net worth is remaining cash plus owned item true values minus remaining debt. Item values have a $0 floor. Ties share the win.

### Small V1 choices

- Player-to-player purchases require actual cash. Only main auction bids and mandatory endgame fees can create auction debt.
- Collateral cannot be sold until its leverage loan is fully repaid.
- Consignment uses the seller’s Phase 1 action and resolves immediately before other Phase 1 actions continue. An unmet reserve or no buyer means no sale, and the action is still used.
- Direct sales and information payments are recorded during negotiation. Information itself is shared verbally and is not copied into another notebook.
- Enter whole-dollar amounts. Auction bids must be positive; reserves and direct sale prices may be zero. Fractional-dollar penalties round up to a dollar.
- No live bidding engine, bots, multiplayer, authentication, database, or QR codes in this version.

## Adjust the prototype

| File | Purpose |
| --- | --- |
| `src/lib/config.ts` | Starting cash, rounds, costs, penalties, and loan limits |
| `src/lib/gameEngine.ts` | Validated game commands and round progression |
| `src/lib/valuation.ts` | Item valuation, fees, penalties, and scoring |
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

Engine tests cover phase gates, debt, private knowledge, ownership transfer, loan defaults, mandatory fees, and a complete game. Browser tests use the installed `/usr/bin/chromium` to exercise the ten-round flow, private reveals, persistence, resale, repayments, and a narrow viewport. Override `CHROMIUM_PATH` if Chromium is elsewhere. Playwright starts the local server if it is not already running.

For a production-mode local server, run `npm run build` followed by `npm start`.
