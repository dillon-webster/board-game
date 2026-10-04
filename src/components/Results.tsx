"use client";

import { useState } from "react";
import { ArrowUpRight, Download, Trophy } from "lucide-react";
import { calculateItemValue, money } from "@/lib/valuation";
import { createPlaytestReport } from "@/lib/playtestReport";
import { SLOTS, type GameState } from "@/types/game";

export default function Results({ game, onNewGame }: { game: GameState; onNewGame: () => void }) {
  const [downloadError, setDownloadError] = useState("");
  const highest = game.scores[0].netWorth;
  // Lots after an early close never reached the block.
  const played = game.items.filter(item => item.lot <= game.round);
  const winners = game.scores.filter(score => score.netWorth === highest).map(score => game.players.find(player => player.id === score.playerId)!.name);
  function downloadReport() {
    let url: string | undefined;
    const link = document.createElement("a");
    try {
      const report = createPlaytestReport(game);
      url = URL.createObjectURL(new Blob([report.content], { type: "application/json;charset=utf-8" }));
      link.href = url;
      link.download = report.filename;
      document.body.appendChild(link);
      link.click();
      setDownloadError("");
    } catch {
      setDownloadError("The report could not be downloaded. Your saved game is still here; please try again.");
    } finally {
      link.remove();
      // Give the browser time to begin reading the download before releasing it.
      if (url) window.setTimeout(() => URL.revokeObjectURL(url!), 1_000);
    }
  }
  return <>
    <section className="results-hero"><span className="large-icon"><Trophy size={30} /></span><p className="eyebrow">The final hammer has fallen</p><h1>{winners.join(" & ")} {winners.length === 1 ? "wins" : "share the win"}.</h1><p>{money(highest)} in final net worth. Every mystery, finally out in the open.</p><div className="results-actions"><button className="button cream" onClick={downloadReport}><Download size={17} /> Download playtest report</button><button className="button secondary" onClick={onNewGame}>Play another game <ArrowUpRight size={17} /></button></div><p className="report-note">Download the complete game and ledger as JSON to share with an AI for playtest analysis. Save it before starting another game.</p></section>
    {downloadError && <p className="error-banner" role="alert">{downloadError}</p>}
    <section className="panel results-panel"><div className="panel-heading"><h2>Final accounts</h2><span className="tag">After all forfeitures</span></div><div className="table-scroll"><table><thead><tr><th>Collector</th><th>Cash left</th><th>Item values</th><th>Auction debt</th><th>Net worth</th></tr></thead><tbody>{game.scores.map((score, index) => <tr key={score.playerId}><td><span className="rank">{score.netWorth === highest ? <Trophy size={16} /> : index + 1}</span><strong>{game.players.find(player => player.id === score.playerId)?.name}</strong></td><td>{money(score.cash)}</td><td>{money(score.itemValue)}</td><td>{money(score.auctionDebt)}</td><td><strong>{money(score.netWorth)}</strong></td></tr>)}</tbody></table></div>
      <div className="settlement-notes">{game.scores.map(score => <p key={score.playerId}><strong>{game.players.find(player => player.id === score.playerId)?.name}:</strong> {score.forfeitedItemIds.length ? `${score.forfeitedItemIds.length} collateral item(s) forfeited; the associated leverage debt was cleared.` : "No collateral forfeited."}</p>)}</div>
    </section>
    <div className="section-heading row-between"><h2>The full story</h2><span className="muted small">All {played.length} lots revealed{played.length < game.items.length ? ` · the house closed after round ${game.round} of ${game.config.rounds}` : ""}</span></div>
    <div className="revealed-grid">{played.map(item => <details className="panel revealed-item" key={item.id}><summary><span className="lot-number">{String(item.lot).padStart(2, "0")}</span><span><strong>{item.name}</strong><small>{item.forfeited ? "Forfeited to the auction house" : game.players.find(player => player.id === item.ownerId)?.name ?? "Unowned"}{item.purchasePrice === null ? " · Unsold" : ` · Paid ${money(item.purchasePrice)}`}</small></span><strong className="revealed-value">{money(calculateItemValue(item))}</strong></summary><div className="reveal-breakdown"><div className="total-line"><span>Public base value</span><strong>{money(item.baseValue)}</strong></div>{SLOTS.map(slot => <div className="knowledge-slot" key={slot}><div className="row-between"><h4>{slot}</h4><strong>{item.hidden[slot].valueModifier >= 0 ? "+" : ""}{money(item.hidden[slot].valueModifier)}</strong></div><p>{item.hidden[slot].truth}</p></div>)}<div className="total-line"><span>True value (minimum $0)</span><strong>{money(calculateItemValue(item))}</strong></div>{item.purchasePrice !== null && <><div className="total-line"><span>{item.forfeited ? "Last sale price" : "Price paid by final owner"}</span><strong>{money(item.purchasePrice)}</strong></div><div className="total-line"><span>{calculateItemValue(item) >= item.purchasePrice ? "Profit" : "Loss"}</span><strong className={calculateItemValue(item) < item.purchasePrice ? "debt-text" : undefined}>{calculateItemValue(item) >= item.purchasePrice ? "+" : "−"}{money(Math.abs(calculateItemValue(item) - item.purchasePrice))}</strong></div></>}</div></details>)}</div>
  </>;
}
