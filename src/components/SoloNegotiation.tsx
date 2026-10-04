"use client";

import { useState } from "react";
import { ArrowRight, Check, HandCoins, X } from "lucide-react";
import { activeLoan, ownedItems } from "@/lib/gameEngine";
import { MAX_PROPOSALS } from "@/lib/botDeals";
import { money } from "@/lib/valuation";
import type { GameState } from "@/types/game";
import { MoneyInput, type Dispatch } from "./GameControls";

export default function SoloNegotiation({ game, dispatch }: { game: GameState; dispatch: Dispatch }) {
  const human = game.players[0];
  const bots = game.players.slice(1);
  const [botId, setBotId] = useState(bots[0].id);
  const [kind, setKind] = useState<"buy" | "sell">("sell");
  const [itemId, setItemId] = useState("");
  const [price, setPrice] = useState("");
  const bot = bots.find(bot => bot.id === botId)!;
  const choices = ownedItems(game, kind === "buy" ? botId : human.id).filter(item => !activeLoan(game, item.id));
  const selected = choices.find(item => item.id === itemId) ?? choices[0];
  const left = MAX_PROPOSALS - (game.negotiation.proposals[botId] ?? 0);
  const itemName = (id: string) => { const item = game.items.find(item => item.id === id)!; return `lot ${item.lot} · ${item.name}`; };

  return <div className="control-content">
    <p className="muted">Talk to the table, then make or answer offers. Bots decide deals by their own valuations; their table talk may be a bluff.</p>
    {game.negotiation.offers.length > 0 && <section className="offer-list" aria-label="Offers on the table">
      <h4>Offers on the table</h4>
      {game.negotiation.offers.map(offer => {
        const from = game.players.find(player => player.id === offer.botId)!;
        return <div className="offer" key={offer.id}>
          <p><strong>{from.name}</strong> {offer.kind === "bot-buys" ? "wants to buy your" : "will sell you"} {itemName(offer.itemId)} for <strong>{money(offer.price)}</strong>.</p>
          {offer.kind === "bot-buys" && <p className="muted small">You paid {money(game.items.find(item => item.id === offer.itemId)!.purchasePrice ?? 0)}.</p>}
          <div className="button-row">
            <button className="button secondary" aria-label={`Decline ${from.name}’s offer`} onClick={() => dispatch({ type: "RESPOND_OFFER", offerId: offer.id, accept: false })}><X size={15} /> Decline</button>
            <button className="button primary" aria-label={`Accept ${from.name}’s offer`} onClick={() => dispatch({ type: "RESPOND_OFFER", offerId: offer.id, accept: true })}><Check size={15} /> Accept</button>
          </div>
        </div>;
      })}
    </section>}
    <form className="deal-form" onSubmit={event => {
      event.preventDefault();
      if (selected && dispatch({ type: "PROPOSE_DEAL", botId, kind, itemId: selected.id, price: price.trim() ? Number(price) : NaN })) setPrice("");
    }}>
      <h4>Make an offer</h4>
      <label className="field">Collector<select value={botId} onChange={event => { setBotId(event.target.value); setItemId(""); }}>{bots.map(bot => <option key={bot.id} value={bot.id}>{bot.name}</option>)}</select></label>
      <div className="segmented" aria-label="Deal type">
        {([["sell", "Sell my item"], ["buy", `Buy from ${bot.name}`]] as const).map(([value, title]) => <button type="button" key={value} aria-pressed={kind === value} className={kind === value ? "selected" : ""} onClick={() => { setKind(value); setItemId(""); }}>{title}</button>)}
      </div>
      {choices.length ? <>
        <label className="field">Item<select value={selected?.id} onChange={event => setItemId(event.target.value)}>{choices.map(item => <option key={item.id} value={item.id}>Lot {item.lot} · {item.name}{kind === "sell" ? ` · paid ${money(item.purchasePrice ?? 0)}` : ""}</option>)}</select></label>
        <MoneyInput label="Your price" value={price} onChange={setPrice} min={0} />
        <p className="muted small">{left > 0 ? `${bot.name} will hear ${left} more ${left === 1 ? "offer" : "offers"} this round.` : `${bot.name} has heard enough offers this round.`}</p>
        <button className="button primary full-width" type="submit" disabled={left <= 0}><HandCoins size={17} /> Make offer</button>
      </> : <p className="inline-empty">{kind === "buy" ? `${bot.name} has nothing for sale.` : "You have no items to sell. Collateral must be repaid first."}</p>}
    </form>
    <button className="button primary full-width" onClick={() => dispatch({ type: "START_AUCTION" })}>Continue to Auction <ArrowRight size={17} /></button>
  </div>;
}
