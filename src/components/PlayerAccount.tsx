"use client";

import { useState } from "react";
import { BookOpen, Landmark } from "lucide-react";
import { activeLoan, ownedItems } from "@/lib/gameEngine";
import { endgameAppraisalCost, money } from "@/lib/valuation";
import type { GameState, Player } from "@/types/game";
import Modal from "./Modal";
import { MoneyInput, type Dispatch } from "./GameControls";

export default function PlayerAccount({ game, player, dispatch, onClose, onNotebook }: { game: GameState; player: Player; dispatch: Dispatch; onClose: () => void; onNotebook: () => void }) {
  const [debtId, setDebtId] = useState("auction");
  const [payment, setPayment] = useState("");
  const loans = game.loans.filter(loan => loan.playerId === player.id && loan.status === "active");
  const debt = debtId === "auction" ? player.auctionDebt : loans.find(loan => loan.id === debtId)?.remaining ?? 0;
  const items = ownedItems(game, player.id);
  return <Modal title={`${player.name}’s account`} onClose={onClose} wide>
    <div className="account-totals"><div><span>Available cash</span><strong>{money(player.cash)}</strong></div><div><span>Auction debt</span><strong className={player.auctionDebt ? "debt-text" : ""}>{money(player.auctionDebt)}</strong></div><div><span>Leverage debt</span><strong>{money(loans.reduce((sum, loan) => sum + loan.remaining, 0))}</strong></div></div>
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
      return <div className="owned-item" key={item.id}>
        <div className="row-between"><strong>Lot {item.lot} · {item.name}</strong><span className="tag">{item.ownerAppraisedSlots.length}/4 appraised</span></div>
        <p className="muted small">Base {money(item.baseValue)} · Paid {money(item.purchasePrice ?? 0)}</p>
        <p className="small">{loan ? `Collateral · ${money(loan.remaining)} owed. Forfeited if unpaid at game end.` : `Endgame appraisal fee: ${money(endgameAppraisalCost(game, item))}`}</p>
      </div>;
    })}
  </Modal>;
}
