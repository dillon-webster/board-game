import type { GameConfig } from "@/lib/config";
import { money } from "@/lib/valuation";

export default function Rules({ config, solo = false }: { config: GameConfig; solo?: boolean }) {
  return <div className="rules-content">
    <p>{solo ? "You control the first seat. Clara, Jules, and Remy take the other three seats and automatically buy clues, bid, and appraise items. Their bidding styles range from cautious to bold." : "Control all four players yourself, or take turns at one computer. You can also choose Play against bots when starting a new game."} The app contains the items and records the game, so you don’t need physical cards to test it.</p>
    <ol>
      <li><strong>Inspect the lot.</strong> Its base value is public. Authenticity, Condition, History, and Discovery are hidden.</li>
      <li><strong>Take one action each.</strong> Buy a clue ({money(config.clueCost)}), consign an owned item, leverage it for cash, or hold.</li>
      <li><strong>Negotiate.</strong> {solo ? "Review your notes and manage funds. Bots do not chat, bluff, or negotiate table deals. To sell them an item, use Consign during Investigate; bots bid automatically and the engine checks your private reserve." : "Bluff, discuss clues, and agree on deals. Record cash payments or item sales in the deal controls."}</li>
      <li><strong>Run the auction.</strong> {solo ? "You bid first, followed by Clara, Jules, and Remy. Bidding starts at $1,000; each raise must be at least $1,000. Turns circle back to you when you’re outbid. Passing withdraws a player from the current lot. The leading bidder sits out until outbid and wins at their actual bid when everyone else passes. If everyone passes without a bid, the lot stays unsold." : "Bid aloud, or choose a result yourself while testing. Enter the winning player and bid."}</li>
      <li><strong>Appraise.</strong> Each owner may buy one appraisal per round on one owned item, or pass. A partial appraisal costs {money(config.partialAppraisalCost)}; a full one costs {money(config.fullAppraisalCost)}.</li>
    </ol>
    <h3>Money & information</h3>
    <p>A winning bid uses cash first. Any shortfall creates auction debt with a one-time {config.auctionDebtPenalty * 100}% penalty. Auction debt blocks clues and appraisals until repaid. Player-to-player purchases require cash.</p>
    <p>Leverage allows a loan up to {config.leverageLoanPercent * 100}% of the item’s public base value, with a {config.leveragePenalty * 100}% penalty. One active loan per item. Repay a loan before selling its collateral. Leverage debt does not block research.</p>
    <p>Clues and appraisals stay in the learning player’s notebook. Every ownership transfer resets that item’s appraisal status for its new owner, including a returning owner.</p>
    <h3>Final settlement</h3>
    <p>After {config.rounds} rounds, unpaid leverage loans forfeit their collateral and are cleared. Remaining unappraised items cost {money(config.endgameFullAppraisalCost)} each to appraise; partially appraised items cost {money(config.endgameCompletionCost)}; fully appraised items cost nothing. Unaffordable fees become debt with the same penalty.</p>
    <p><strong>Net worth = remaining cash + owned item values − remaining debt.</strong> Highest net worth wins; tied players share the win.</p>
    <p className="muted small">{solo ? "Bots estimate values from the possible results, their own clues, and purchased appraisals. They cannot use your notes or unseen item truths. Rival cash balances stay private until final settlement. Bots spend cash only; you may still bid using auction debt." : "Private reveals rely on players looking away."} This local prototype stores the whole game in this browser.</p>
  </div>;
}
