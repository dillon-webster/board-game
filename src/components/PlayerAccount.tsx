"use client";

import { useState } from "react";
import { BookOpen, Landmark } from "lucide-react";
import { activeLoan, ownedItems } from "@/lib/gameEngine";
import { accountItemValue, accountNetWorth, endgameAppraisalCost, money } from "@/lib/valuation";
import type { GameState, Player } from "@/types/game";
import Modal from "./Modal";
import { MoneyInput, type Dispatch } from "./GameControls";

export default function PlayerAccount({ game, player, dispatch, onClose, onNotebook }: { game: GameState; player: Player; dispatch: Dispatch; onClose: () => void; onNotebook: () => void }) {
  const [debtId, setDebtId] = useState("auction");
  const [payment, setPayment] = useState("");
  const loans = game.loans.filter(loan => loan.playerId === player.id && loan.status === "active");
  const debt = debtId === "auction" ? player.auctionDebt : loans.find(loan => loan.id === debtId)?.remaining ?? 0;
  const items = ownedItems(game, player.id);
  const account = accountNetWorth(game, player);
  return <Modal title={`${player.name}’s account`} onClose={onClose} wide>
    <section className="net-worth-summary" aria-label="Net worth summary">
      <span>{account.estimated ? "Estimated net worth" : "Net worth"}</span>
      <strong>{money(account.netWorth)}</strong>
      <p>Cash + collection value − auction debt − leverage debt</p>
    </section>
    <div className="account-totals"><div><span>Available cash</span><strong>{money(account.cash)}</strong></div><div><span>{account.estimated ? "Estimated collection value" : "Collection value"}</span><strong>{money(account.collectionValue)}</strong></div><div><span>Auction debt</span><strong className={account.auctionDebt ? "debt-text" : ""}>{money(account.auctionDebt)}</strong></div><div><span>Leverage debt</span><strong>{money(account.leverageDebt)}</strong></div></div>
    <p className="muted small">{account.estimated ? "Unrevealed items use their public base value plus modifiers you’ve appraised. Unknown details may raise or lower your total. " : "All owned item values are known. "}This total is before endgame appraisal fees and collateral forfeitures.</p>
    {(player.auctionDebt > 0 || loans.length > 0) && <section className="repayment-box">
      <h3><Landmark size={18} /> Repay debt</h3>
      <form onSubmit={event => { event.preventDefault(); if (dispatch({ type: "REPAY", playerId: player.id, amount: Number(payment), ...(debtId === "auction" ? {} : { loanId: debtId }) })) { setPayment(""); setDebtId("auction"); } }}>
        <label className="field">Debt to repay<select value={debtId} onChange={event => { setDebtId(event.target.value); setPayment(""); }}><option value="auction">Auction debt · {money(player.auctionDebt)}</option>{loans.map(loan => <option key={loan.id} value={loan.id}>Lot {game.items.find(item => item.id === loan.itemId)?.lot} leverage · {money(loan.remaining)}</option>)}</select></label>
        <MoneyInput label="Repayment amount" value={payment} onChange={setPayment} max={Math.min(player.cash, debt)} />
        <div className="button-row"><button className="button secondary" type="button" disabled={!player.cash || !debt} onClick={() => setPayment(String(Math.min(player.cash, debt)))}>Use maximum cash</button><button className="button primary" type="submit" disabled={!player.cash || !debt}>Repay debt</button></div>
      </form>
    </section>}
    <div className="row-between section-heading"><h3>Owned items <span className="count">{items.length}</span></h3><button className="text-button" onClick={onNotebook}><BookOpen size={16} /> Private notebook</button></div>
    {items.length === 0 && <p className="inline-empty">Your collection starts with your first winning bid.</p>}
    {items.map(item => {
      const loan = activeLoan(game, item.id);
      const valuation = accountItemValue(item, player);
      return <div className="owned-item" key={item.id}>
        <div className="row-between"><strong>Lot {item.lot} · {item.name}</strong><span className="tag">{item.ownerAppraisedSlots.length}/4 appraised</span></div>
        <p className="muted small">Base {money(item.baseValue)} · Paid {money(item.purchasePrice ?? 0)}</p>
        <p className="small">{valuation.estimated ? "Estimated value" : "Known value"}: <strong>{money(valuation.value)}</strong></p>
        <p className="small">{loan ? `Collateral · ${money(loan.remaining)} owed. Forfeited if unpaid at game end.` : `Endgame appraisal fee: ${money(endgameAppraisalCost(game, item))}`}</p>
      </div>;
    })}
  </Modal>;
}
