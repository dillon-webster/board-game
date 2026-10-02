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

1. On the setup screen, choose **Play against bots**, enter your name, and open the auction house. If a saved game is open, use **New game** first (this replaces that save).
2. You control the first seat. Clara (cautious), Jules (balanced), and Remy (bold) automatically take their investigation and appraisal turns. Their public actions appear in the auction ledger.
3. Buy a clue, consign an item, borrow against an item, or hold. Use your private notebook and Manage funds as usual. Continue through negotiation when ready; bots do not chat, bluff, or negotiate table deals.
4. At auction, enter **Your bid** or choose **Pass this auction**. You go first, then Clara, Jules, and Remy respond one at a time. Bidding starts at $1,000, and raises must be at least $1,000. Turns circle back when you’re outbid. Passing withdraws that player for the lot; the leader sits out until outbid. When everyone else passes, the leader pays their actual bid. If everyone passes without bidding, the lot remains unsold.
5. Buy or pass your appraisal, then continue to the next round. After ten rounds, review final settlement and reveal the results.

Bots run in your browser with no API keys or services. They estimate values from the result catalog, their own clues, and purchased appraisals; they cannot inspect unseen item truths, future lots, or your notebook. They reserve cash for research and appraisals and never borrow. You can still use leverage and auction debt. Your own cash and net worth stay visible; opponent cash balances remain private until final results. **Manage funds** shows a breakdown of cash + collection value − auction debt − leverage debt. Unrevealed items use public base value plus appraised modifiers, so the total is labeled an estimate until you know all your item values. This current total does not deduct future settlement fees or assume collateral forfeitures.

Consigning your item starts a resale auction with the bots bidding in seat order. You watch as the seller, and the winner pays their final bid in cash. The engine checks your private reserve after bidding; if the price misses the reserve, you keep the item and the action is spent. Bot limits do not depend on the reserve. Bots do not initiate consignments or direct deals.

Solo games save and resume automatically, including the current bid, bidder, and passes in an unfinished auction. Earlier solo saves pick up with turn-by-turn bidding; no new game is needed. Existing shared-computer saves remain in that mode.

### Shared computer

1. Choose **Shared computer**. Enter four names, or keep the defaults to control all four seats.
2. Each round, each player buys a clue, consigns an item, takes a leverage loan, or holds.
3. Use the private notebook to reveal clues and appraisal results. Other players should look away; this is a shared-computer prototype, not secure multiplayer.
4. Continue to negotiation. Optional table deals record item sales or cash payments for agreements made by the players.
5. Continue to the auction, select the winner, and enter their bid. During solo testing, simply choose the outcome you want to exercise.
6. Each owner gets one appraisal purchase or pass in the Appraisal Window. Manage funds lets players repay auction debt or loans.
7. Advance through ten rounds. Before final settlement, review fees and collateral and repay any loans you want to keep. Finish to reveal every item and calculate the winner.

The in-app **How to play** dialog explains costs and debt restrictions.

## Save a playtest report

On the results screen, choose **Download playtest report** to save an AI-ready `.json` file. Attach it to an AI conversation to review game balance and possible improvements. It includes a summary of final accounts and revealed lot values, suggested review topics, data limitations, and the complete saved game: player notes, hidden item results, leverage loans, rules, final scores, and every recorded ledger entry in play order.

This works with completed games already saved in your browser. Refresh the results page if the button has not appeared. Downloading leaves your saved game unchanged; starting a new game replaces that browser save, so download first to keep the history. The JSON contains a `game` field preserving the full original state; it is an export, not an in-app import feature.

The export date is when you download the file. Event timestamps, per-turn balance snapshots, and bot reasoning were not recorded and are not reconstructed. Private notes in the report reflect settlement, including mandatory final appraisals.

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
- Solo mode adds turn-by-turn auctions and local rule-based bots. There is no live multiplayer, AI conversation, authentication, database, or QR codes.

## Adjust the prototype

| File | Purpose |
| --- | --- |
| `src/lib/config.ts` | Starting cash, rounds, costs, penalties, and loan limits |
| `src/lib/gameEngine.ts` | Validated game commands and round progression |
| `src/lib/bots.ts` | Bot observations, value estimates, bidding styles, and auction pricing |
| `src/lib/botGame.ts` | Automatic bot turns and solo command validation |
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

Engine tests cover phase gates, debt, private knowledge, ownership transfer, loan defaults, mandatory fees, and complete games. Bot tests cover information boundaries, bid order, passes, actual winning prices, and auction resumption, private reserves, cash limits, all-pass auctions, old saves, and sixteen complete solo games. Browser tests use the installed `/usr/bin/chromium` to exercise ten-round shared and solo flows, private reveals, persistence, resale, repayments, and a narrow viewport. Override `CHROMIUM_PATH` if Chromium is elsewhere. Playwright starts the local server if it is not already running.

For a production-mode local server, run `npm run build` followed by `npm start`.
