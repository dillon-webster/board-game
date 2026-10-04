import type { GameConfig } from "@/lib/config";
import { money } from "@/lib/valuation";

export default function Rules({ config, solo = false }: { config: GameConfig; solo?: boolean }) {
  return <div className="rules-content">
    <p>{solo ? "You control the first seat. Clara, Jules, and Remy take the other three seats and automatically buy clues and bid. Their bidding styles range from cautious to bold." : "Control all four players yourself, or take turns at one computer. You can also choose Play against bots when starting a new game."} The app contains the items and records the game, so you don’t need physical cards to test it.</p>
    <ol>
      <li><strong>Inspect the lot.</strong> Its base value is public. Authenticity, Condition, History, and Discovery are hidden.</li>
      <li><strong>Take one action each.</strong> Buy a clue ({money(config.clueCost)}), consign an owned item, leverage it for cash, or hold.</li>
      <li><strong>Negotiate.</strong> {solo ? "Chat with the bots, who may bluff, and trade items with them. Bots may open with an offer; you can make each bot up to three offers per round. Their deal decisions come from their own valuations, not their table talk. You can also sell to them with Consign during Investigate." : "Bluff, discuss clues, and agree on deals. Record cash payments or item sales in the deal controls."}</li>
      <li><strong>Run the auction.</strong> {solo ? "You bid first, followed by Clara, Jules, and Remy. Bidding starts at $1,000; each raise must be at least $1,000. Turns circle back to you when you’re outbid. Passing withdraws a player from the current lot. The leading bidder sits out until outbid and wins at their actual bid when everyone else passes. If everyone passes without a bid, the lot stays unsold." : "Bid aloud, or choose a result yourself while testing. Enter the winning player and bid."}</li>
      <li><strong>Inspect.</strong> Each owner may buy one full inspection per round on one owned item, or pass. It reveals a clue in every category for {money(config.inspectionCost)} per category. Categories you already have a clue for are free.</li>
    </ol>
    <h3>Money & information</h3>
    <p>A winning bid uses cash first. Any shortfall creates auction debt with a one-time {config.auctionDebtPenalty * 100}% penalty. Auction debt blocks clues and inspections until repaid. Player-to-player purchases require cash.</p>
    <p>Leverage allows a loan up to {config.leverageLoanPercent * 100}% of the item’s public base value, with a {config.leveragePenalty * 100}% penalty. One active loan per item. Repay a loan before selling its collateral. Leverage debt does not block research.</p>
    <p>Clues stay in the learning player’s notebook, even after the item is sold. Exact truths and values are never revealed during play.</p>
    <h3>Final settlement</h3>
    <p>{config.guaranteedRounds === config.rounds ? `The game lasts ${config.rounds} rounds.` : `The game lasts ${config.guaranteedRounds}–${config.rounds} rounds. After round ${config.guaranteedRounds}, the auction house may close at the end of each round: the chance starts at ${Math.round(config.endChanceStep * 100)}% and rises by ${Math.round(config.endChanceStep * 100)}% each round. It always closes after round ${config.rounds}. Waiting for the last lots is a gamble.`} When it closes, unpaid leverage loans forfeit their collateral and are cleared. Then every item’s true value is revealed at no cost.</p>
    <p><strong>Net worth = remaining cash + owned item values − remaining debt.</strong> Highest net worth wins; tied players share the win.</p>
    <p className="muted small">{solo ? "Bots estimate values from the possible results, and their own clues. They cannot use your notes or unseen item truths. Rival cash balances stay private until final settlement. Bots spend cash only; you may still bid using auction debt." : "Private reveals rely on players looking away."} This local prototype stores the whole game in this browser.</p>
  </div>;
}
