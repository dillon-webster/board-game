import type { GameConfig } from "@/lib/config";
import { money } from "@/lib/valuation";

export default function Rules({ config }: { config: GameConfig }) {
  return <div className="rules-content">
    <p>Control all four players yourself, or take turns at one computer. The app contains the items and records the game, so you don’t need physical cards to test it.</p>
    <ol>
      <li><strong>Inspect the lot.</strong> Its base value is public. Authenticity, Condition, History, and Discovery are hidden.</li>
      <li><strong>Take one action each.</strong> Buy a clue ({money(config.clueCost)}), consign an owned item, leverage it for cash, or hold.</li>
      <li><strong>Negotiate.</strong> Bluff, discuss clues, and agree on deals. Record cash payments or item sales in the deal controls.</li>
      <li><strong>Run the auction.</strong> Bid aloud, or choose a result yourself while testing. Enter the winning player and bid.</li>
      <li><strong>Appraise.</strong> Each owner may buy one appraisal per round on one owned item, or pass. A partial appraisal costs {money(config.partialAppraisalCost)}; a full one costs {money(config.fullAppraisalCost)}.</li>
    </ol>
    <h3>Money & information</h3>
    <p>A winning bid uses cash first. Any shortfall creates auction debt with a one-time {config.auctionDebtPenalty * 100}% penalty. Auction debt blocks clues and appraisals until repaid. Player-to-player purchases require cash.</p>
    <p>Leverage allows a loan up to {config.leverageLoanPercent * 100}% of the item’s public base value, with a {config.leveragePenalty * 100}% penalty. One active loan per item. Repay a loan before selling its collateral. Leverage debt does not block research.</p>
    <p>Clues and appraisals stay in the learning player’s notebook. Every ownership transfer resets that item’s appraisal status for its new owner, including a returning owner.</p>
    <h3>Final settlement</h3>
    <p>After {config.rounds} rounds, unpaid leverage loans forfeit their collateral and are cleared. Remaining unappraised items cost {money(config.endgameFullAppraisalCost)} each to appraise; partially appraised items cost {money(config.endgameCompletionCost)}; fully appraised items cost nothing. Unaffordable fees become debt with the same penalty.</p>
    <p><strong>Net worth = remaining cash + owned item values − remaining debt.</strong> Highest net worth wins; tied players share the win.</p>
    <p className="muted small">Private reveals rely on players looking away. This local prototype stores the whole game in this browser.</p>
  </div>;
}
