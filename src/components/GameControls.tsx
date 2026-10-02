"use client";

import { useState, type FormEvent } from "react";
import { ArrowRight, Check, Gavel, HandCoins, LockKeyhole, Search, SkipForward } from "lucide-react";
import { activeLoan, currentItem, ownedItems, type Command } from "@/lib/gameEngine";
import { BID_INCREMENT, isBot } from "@/lib/bots";
import type { PlayCommand } from "@/lib/botGame";
import { money, withPenalty } from "@/lib/valuation";
import { SLOTS, type GameState, type Player } from "@/types/game";
import Modal from "./Modal";

export type Dispatch = (command: PlayCommand) => boolean;
type ControlsProps = { game: GameState; player: Player; dispatch: Dispatch };

export function MoneyInput({ label, value, onChange, min = 1, max = 1_000_000_000 }: { label: string; value: string; onChange: (value: string) => void; min?: number; max?: number }) {
  return <label className="field">{label}<div className="money-input"><span>$</span><input aria-label={label} type="number" min={min} max={max} step="1" required value={value} onChange={event => onChange(event.target.value)} placeholder="0" /></div></label>;
}

function ConsignmentResult({ game, dispatch }: { game: GameState; dispatch: Dispatch }) {
  const listing = game.consignment!;
  const buyers = game.players.filter(player => player.id !== listing.sellerId);
  const [buyerId, setBuyerId] = useState(buyers[0].id);
  const [price, setPrice] = useState("");
  const item = game.items.find(item => item.id === listing.itemId)!;
  return <div className="control-content">
    <span className="tag">Resale in progress</span><h3>{item.name}</h3>
    <p className="muted">Hold the resale auction, then enter the result. The app checks the seller’s private reserve. The buyer must pay with cash.</p>
    <form onSubmit={event => { event.preventDefault(); dispatch({ type: "RESOLVE_CONSIGN", buyerId, price: Number(price) }); }}>
      <label className="field">Buyer<select value={buyerId} onChange={event => setBuyerId(event.target.value)}>{buyers.map(player => <option key={player.id} value={player.id}>{player.name} · {money(player.cash)}</option>)}</select></label>
      <MoneyInput label="Final resale price" value={price} onChange={setPrice} min={0} />
      <button className="button primary full-width" type="submit">Record resale</button>
    </form>
    <button className="button quiet full-width" onClick={() => dispatch({ type: "RESOLVE_CONSIGN", buyerId: null, price: 0 })}>No sale · keep the item</button>
  </div>;
}

function ActionControls({ game, player, dispatch }: ControlsProps) {
  const [action, setAction] = useState<"clue" | "consign" | "leverage">("clue");
  const [slot, setSlot] = useState<(typeof SLOTS)[number]>("Authenticity");
  const availableItems = ownedItems(game, player.id).filter(item => !activeLoan(game, item.id));
  const [itemId, setItemId] = useState(availableItems[0]?.id ?? "");
  const [cash, setCash] = useState("");
  const [reserveOpen, setReserveOpen] = useState(false);
  const selectedItem = availableItems.find(item => item.id === itemId);
  const taken = game.actions[player.id];
  if (taken) return <div className="empty-state"><span className="large-icon"><Check /></span><h3>Action recorded</h3><p>{player.name} chose {taken === "clue" ? "Buy a Clue" : taken}. {game.mode === "solo" ? "The bots have taken their turns. Continue when you’re ready." : "Select another player to continue."}</p></div>;
  return <div className="control-content">
    <p className="muted">One action for {player.name}. What’s your next move?</p>
    <div className="segmented" aria-label="Phase 1 action">
      {([ ["clue", "Buy a Clue"], ["consign", "Consign"], ["leverage", "Leverage"] ] as const).map(([value, title]) => <button key={value} aria-pressed={action === value} className={action === value ? "selected" : ""} onClick={() => { setAction(value); setCash(""); }}>{title}</button>)}
    </div>
    {action === "clue" ? <>
      <label className="field">Investigate a hidden category<select value={slot} onChange={event => setSlot(event.target.value as typeof slot)}>{SLOTS.map(slot => <option key={slot}>{slot}</option>)}</select></label>
      <div className="price-line"><span>A lead, with no exact valuation</span><strong>{money(game.config.clueCost)}</strong></div>
      {player.auctionDebt > 0 ? <p className="inline-warning">Repay auction debt to unlock clues.</p> : player.cash < game.config.clueCost ? <p className="inline-warning">Not enough cash for a clue.</p> : null}
      <button className="button primary full-width" disabled={player.auctionDebt > 0 || player.cash < game.config.clueCost} onClick={() => dispatch({ type: "BUY_CLUE", playerId: player.id, slot })}><Search size={17} /> Buy a Clue · {money(game.config.clueCost)}</button>
    </> : availableItems.length ? <>
      <label className="field">Choose an owned item<select value={itemId} onChange={event => { setItemId(event.target.value); setCash(""); }}>{availableItems.map(item => <option key={item.id} value={item.id}>Lot {item.lot} · {item.name}</option>)}</select></label>
      {action === "consign" ? <>
        <p className="muted small">Offer this item to the other players. You keep it if its private reserve is not met.</p>
        <button className="button primary full-width" onClick={() => setReserveOpen(true)}><LockKeyhole size={17} /> Set a private reserve</button>
      </> : <form onSubmit={event => { event.preventDefault(); dispatch({ type: "LEVERAGE", playerId: player.id, itemId, amount: Number(cash) }); }}>
        <p className="muted small">Borrow up to {money(Math.floor((selectedItem?.baseValue ?? 0) * game.config.leverageLoanPercent))}. A one-time {game.config.leveragePenalty * 100}% penalty applies. Unpaid collateral is forfeited at game end.</p>
        <MoneyInput label="Loan amount" value={cash} onChange={setCash} max={Math.floor((selectedItem?.baseValue ?? 0) * game.config.leverageLoanPercent)} />
        <button className="button primary full-width" type="submit"><HandCoins size={17} /> Take leverage loan</button>
      </form>}
    </> : <div className="inline-empty">You need an owned item without an active leverage loan to {action}.</div>}
    <button className="button quiet full-width" onClick={() => dispatch({ type: "HOLD", playerId: player.id })}>Hold · take no action <ArrowRight size={15} /></button>
    {reserveOpen && <Modal title={`${player.name}’s private reserve`} onClose={() => setReserveOpen(false)}>
      <p>Only {player.name} should enter this amount. The reserve stays hidden during the resale auction.</p>
      <form onSubmit={event => { event.preventDefault(); if (dispatch({ type: "CONSIGN", playerId: player.id, itemId, reserve: cash.trim() ? Number(cash) : NaN })) setReserveOpen(false); }}>
        <label className="field">Private reserve ($)<input type="password" inputMode="numeric" autoComplete="off" value={cash} onChange={event => setCash(event.target.value)} required placeholder="Enter whole dollars" /></label>
        <button type="submit" className="button primary full-width">Consign item</button>
      </form>
    </Modal>}
  </div>;
}

function AuctionControls({ game, dispatch }: { game: GameState; dispatch: Dispatch }) {
  const [playerId, setPlayerId] = useState(game.players[0].id);
  const [bid, setBid] = useState("");
  const winner = game.players.find(player => player.id === playerId)!;
  const shortfall = Math.max(0, Number(bid) - winner.cash);
  return <div className="control-content">
    <p className="muted">Bid aloud at the table, or choose a winning result to test on your own.</p>
    <form onSubmit={event => { event.preventDefault(); dispatch({ type: "RECORD_AUCTION", playerId, bid: Number(bid) }); }}>
      <label className="field">Winning player<select value={playerId} onChange={event => setPlayerId(event.target.value)}>{game.players.map(player => <option key={player.id} value={player.id}>{player.name} · {money(player.cash)}</option>)}</select></label>
      <MoneyInput label="Winning bid" value={bid} onChange={setBid} />
      {shortfall > 0 && Number.isFinite(shortfall) && <div className="inline-warning">Cash used: {money(winner.cash)}<br />New auction debt: {money(withPenalty(shortfall, game.config.auctionDebtPenalty))} including the {game.config.auctionDebtPenalty * 100}% penalty.</div>}
      <button type="submit" className="button primary full-width"><Gavel size={17} /> Record auction result</button>
    </form>
  </div>;
}

function BotAuctionControls({ game, dispatch }: { game: GameState; dispatch: Dispatch }) {
  const bidding = game.bidding;
  const minimum = (bidding?.currentBid ?? 0) + BID_INCREMENT;
  const [bid, setBid] = useState(String(minimum));
  const player = game.players[0];
  const shortfall = Math.max(0, Number(bid) - player.cash);
  if (!bidding) return <div className="control-content">Opening bidding…</div>;
  const humanTurn = !isBot(game, bidding.turnPlayerId);
  const leader = game.players.find(person => person.id === bidding.highBidderId);
  const next = game.players.find(person => person.id === bidding.turnPlayerId)!;
  const item = game.items.find(item => item.id === bidding.itemId)!;
  return <div className="control-content">
    <span className="tag">Bidding round {bidding.cycle}</span>
    {game.consignment && <h3>Resale · {item.name}</h3>}
    <div className="live-bid"><span>Current bid</span><strong>{bidding.currentBid ? money(bidding.currentBid) : "No bids yet"}</strong><small>{leader ? `${leader.name} is leading` : `Opening bid: ${money(BID_INCREMENT)}`}</small></div>
    <ol className="bid-seats" aria-label="Bidding order">{game.players.filter(person => person.id !== game.consignment?.sellerId).map(person => <li key={person.id} aria-current={person.id === next.id ? "step" : undefined}><strong>{person.id === player.id ? "You" : person.name}</strong><span>{bidding.passedPlayerIds.includes(person.id) ? "Passed" : person.id === next.id ? "Up next" : person.id === leader?.id ? "Leading" : "In"}</span></li>)}</ol>
    <p className="bid-turn" role="status">{humanTurn ? "Your turn to bid or pass." : `${next.name} is deciding…`}</p>
    {humanTurn ? <>
      <p className="muted small">Raise by at least {money(BID_INCREMENT)}. Your bid is the price you’ll pay if everyone else passes.</p>
      <form onSubmit={event => { event.preventDefault(); dispatch({ type: "PLACE_BID", amount: bid.trim() ? Number(bid) : NaN }); }}>
        <MoneyInput label="Your bid" value={bid} onChange={setBid} min={minimum} />
        {shortfall > 0 && Number.isFinite(shortfall) && <p className="inline-warning">Winning at this price creates {money(withPenalty(shortfall, game.config.auctionDebtPenalty))} in auction debt, including the penalty.</p>}
        <button type="submit" className="button primary full-width" disabled={minimum > 1_000_000_000}><Gavel size={17} /> Place bid</button>
      </form>
      <button className="button quiet full-width" onClick={() => dispatch({ type: "PASS_BID" })}><SkipForward size={16} /> Pass this auction</button>
      <p className="muted small">Passing withdraws you from this lot.</p>
    </> : <p className="muted small">{game.consignment ? "The bots bid in seat order. Your private reserve is checked when bidding closes." : bidding.passedPlayerIds.includes(player.id) ? "You’ve passed. The remaining bidders will finish this auction." : "The bots respond in seat order, then bidding comes back to you if you’re outbid."}</p>}
    {bidding.history.length > 0 && <div className="bid-history"><h4>Latest bids</h4><ol>{bidding.history.slice(-8).map((entry, index) => <li key={index}><span>{game.players.find(person => person.id === entry.playerId)?.name}</span><strong>{entry.bid === null ? "Passed" : money(entry.bid)}</strong></li>)}</ol></div>}
  </div>;
}

function AppraisalControls({ game, player, dispatch }: ControlsProps) {
  const available = ownedItems(game, player.id).filter(item => item.ownerAppraisedSlots.length < SLOTS.length);
  const [itemId, setItemId] = useState(available[0]?.id ?? "");
  const [scope, setScope] = useState<(typeof SLOTS)[number] | "full">("full");
  const item = available.find(item => item.id === itemId);
  const cost = scope === "full" ? game.config.fullAppraisalCost : game.config.partialAppraisalCost;
  if (game.appraisalDone.includes(player.id)) return <div className="empty-state"><span className="large-icon"><Check /></span><h3>Window complete</h3><p>{player.name} has finished or has no items to appraise. {game.mode === "solo" ? "The bots have finished their appraisals too." : "Select another player to continue."}</p></div>;
  return <div className="control-content">
    <p className="muted">{player.name} may purchase one appraisal on one owned item this round.</p>
    {available.length ? <>
      <label className="field">Item to appraise<select value={itemId} onChange={event => { setItemId(event.target.value); setScope("full"); }}>{available.map(item => <option key={item.id} value={item.id}>Lot {item.lot} · {item.name}</option>)}</select></label>
      <label className="field">Appraisal type<select value={scope} onChange={event => setScope(event.target.value as typeof scope)}><option value="full">Full appraisal · {money(game.config.fullAppraisalCost)}</option>{SLOTS.filter(slot => !item?.ownerAppraisedSlots.includes(slot)).map(slot => <option key={slot} value={slot}>{slot} only · {money(game.config.partialAppraisalCost)}</option>)}</select></label>
      <p className="muted small">{scope === "full" ? "Privately reveals all four truths, modifiers, and the exact item value." : "Privately reveals the truth and exact modifier for this category only."}</p>
      {player.auctionDebt > 0 ? <p className="inline-warning">Auction debt blocks appraisal. Repay it using Manage funds, or pass this window.</p> : player.cash < cost ? <p className="inline-warning">You need {money(cost)} in cash. Appraisals cannot be financed.</p> : null}
      <button className="button primary full-width" disabled={player.auctionDebt > 0 || player.cash < cost} onClick={() => dispatch({ type: "APPRAISE", playerId: player.id, itemId, scope })}><Search size={17} /> Purchase appraisal · {money(cost)}</button>
    </> : <p className="inline-empty">All your owned items are fully appraised.</p>}
    <button className="button quiet full-width" onClick={() => dispatch({ type: "PASS_APPRAISAL", playerId: player.id })}><SkipForward size={16} /> Pass appraisal window</button>
  </div>;
}

export default function GameControls({ game, player, dispatch, onDeals }: ControlsProps & { onDeals: () => void }) {
  if (game.consignment) return game.mode === "solo" ? <BotAuctionControls key={game.bidding?.history.length} game={game} dispatch={dispatch} /> : <ConsignmentResult game={game} dispatch={dispatch} />;
  if (game.phase === "actions") return <ActionControls game={game} player={player} dispatch={dispatch} />;
  if (game.phase === "auction") return game.mode === "solo" ? <BotAuctionControls key={game.bidding?.history.length} game={game} dispatch={dispatch} /> : <AuctionControls game={game} dispatch={dispatch} />;
  if (game.phase === "appraisal") return <AppraisalControls game={game} player={player} dispatch={dispatch} />;
  return <div className="control-content negotiation-copy">
    <span className="large-icon"><HandCoins size={28} /></span><h3>{game.mode === "solo" ? "Consider your next bid." : <>Make your case.<br />Or make a deal.</>}</h3>
    <p>{game.mode === "solo" ? "Review your notebook and manage your funds before bidding. Bots don’t negotiate table deals; you can offer an owned item to them with Consign during Investigate." : "Compare notes, bluff about what you know, and agree on any offers. You can record item sales and payments here."}</p>
    {game.mode !== "solo" && <button className="button secondary full-width" onClick={onDeals}>Record a table deal</button>}
    <button className="button primary full-width" onClick={() => dispatch({ type: "START_AUCTION" })}>Continue to Auction <ArrowRight size={17} /></button>
  </div>;
}

export function DealControls({ game, dispatch, onClose }: { game: GameState; dispatch: Dispatch; onClose: () => void }) {
  const [sellerId, setSellerId] = useState(game.players[0].id);
  const [buyerId, setBuyerId] = useState(game.players[1].id);
  const [kind, setKind] = useState("cash");
  const [itemId, setItemId] = useState("");
  const [price, setPrice] = useState("");
  const available = ownedItems(game, sellerId).filter(item => !activeLoan(game, item.id));
  function submit(event: FormEvent) {
    event.preventDefault();
    const command: Command = kind === "cash" ? { type: "TRANSFER_CASH", sellerId, buyerId, amount: Number(price) } : { type: "TRADE", sellerId, buyerId, itemId, price: Number(price) };
    if (dispatch(command)) onClose();
  }
  return <form onSubmit={submit}>
    <p className="muted">Record an agreed deal. These transfers use cash; private information is shared by the players themselves.</p>
    <label className="field">Deal type<select value={kind} onChange={event => { setKind(event.target.value); setItemId(""); }}><option value="cash">Cash payment (information or other deal)</option><option value="item">Direct item sale</option></select></label>
    <label className="field">{kind === "cash" ? "Paying player" : "Seller"}<select value={sellerId} onChange={event => { setSellerId(event.target.value); setItemId(""); }}>{game.players.map(player => <option key={player.id} value={player.id}>{player.name}</option>)}</select></label>
    <label className="field">{kind === "cash" ? "Receiving player" : "Buyer"}<select value={buyerId} onChange={event => setBuyerId(event.target.value)}>{game.players.map(player => <option disabled={player.id === sellerId} key={player.id} value={player.id}>{player.name}</option>)}</select></label>
    {kind === "item" && <label className="field">Item<select required value={itemId} onChange={event => setItemId(event.target.value)}><option value="">Choose an item</option>{available.map(item => <option key={item.id} value={item.id}>Lot {item.lot} · {item.name}</option>)}</select></label>}
    <MoneyInput label={kind === "cash" ? "Payment amount" : "Sale price"} value={price} onChange={setPrice} min={kind === "cash" ? 1 : 0} />
    <button className="button primary full-width" type="submit" disabled={sellerId === buyerId}>Record agreed deal</button>
  </form>;
}
