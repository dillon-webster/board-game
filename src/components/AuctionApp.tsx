"use client";

import { useEffect, useState } from "react";
import { ArrowRight, BookOpen, Check, CircleHelp, Gavel, Landmark, LockKeyhole, RotateCcw, Search, ShieldCheck, Users } from "lucide-react";
import { GAME_CONFIG } from "@/lib/config";
import { activeLoan, currentItem, executeCommand, generateGame, ownedItems, type Command } from "@/lib/gameEngine";
import { endgameAppraisalCost, money } from "@/lib/valuation";
import { parseSavedGame, STORAGE_KEY } from "@/lib/storage";
import { SLOTS, type GameState } from "@/types/game";
import GameControls, { DealControls } from "./GameControls";
import LotIllustration from "./LotIllustration";
import Modal, { ModalErrorContext } from "./Modal";
import PlayerAccount from "./PlayerAccount";
import PrivateNotebook from "./PrivateNotebook";
import Results from "./Results";
import Rules from "./Rules";

const PHASES = [
  { id: "actions", title: "Investigate", description: "One action each" },
  { id: "negotiation", title: "Negotiate", description: "Talk & trade" },
  { id: "auction", title: "Auction", description: "Record the winner" },
  { id: "appraisal", title: "Appraise", description: "One appraisal each" },
];

export default function AuctionApp() {
  const [loaded, setLoaded] = useState(false);
  const [game, setGame] = useState<GameState | null>(null);
  const [names, setNames] = useState(["Player 1", "Player 2", "Player 3", "Player 4"]);
  const [selectedId, setSelectedId] = useState("player-1");
  const [error, setError] = useState("");
  const [saveWarning, setSaveWarning] = useState("");
  const [notebook, setNotebook] = useState<{ playerId: string; itemId?: string } | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [modal, setModal] = useState<"rules" | "reset" | "deals" | "finish" | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const restored = parseSavedGame(saved);
        setGame(restored);
        const pending = restored.players.find(player => restored.phase === "actions" ? !restored.actions[player.id] : restored.phase === "appraisal" ? !restored.appraisalDone.includes(player.id) : false);
        if (pending) setSelectedId(pending.id);
      }
    } catch {
      setSaveWarning("The saved game could not be loaded. Starting a new game will replace it. If browser storage is unavailable, this session will not survive a refresh.");
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded || !game) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(game));
      setSaveWarning("");
    } catch {
      setSaveWarning("Your browser could not save this game. Keep this tab open to preserve the current session.");
    }
  }, [game, loaded]);

  function dispatch(command: Command): boolean {
    if (!game) return false;
    try {
      const next = executeCommand(game, command);
      setGame(next);
      setError("");
      if (command.type === "BUY_CLUE") setNotebook({ playerId: command.playerId, itemId: currentItem(game).id });
      if (command.type === "APPRAISE") setNotebook({ playerId: command.playerId, itemId: command.itemId });
      const pending = next.players.find(player => next.phase === "actions" ? !next.actions[player.id] : next.phase === "appraisal" ? !next.appraisalDone.includes(player.id) : false);
      if (pending) setSelectedId(pending.id);
      return true;
    } catch (error) {
      setError(error instanceof Error ? error.message : "That action could not be completed.");
      return false;
    }
  }

  function newGame() {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* The storage warning remains visible. */ }
    setGame(null); setModal(null); setNotebook(null); setAccountId(null); setError(""); setSelectedId("player-1");
  }

  function openModal(value: typeof modal) { setError(""); setModal(value); }
  const config = game?.config ?? GAME_CONFIG;
  const item = game ? currentItem(game) : null;
  const player = game?.players.find(player => player.id === selectedId) ?? game?.players[0];
  const allActionsDone = game?.players.every(player => game.actions[player.id]) && !game?.consignment;
  const allAppraisalsDone = game?.players.every(player => game.appraisalDone.includes(player.id));
  const phaseIndex = PHASES.findIndex(phase => phase.id === game?.phase);

  return <ModalErrorContext.Provider value={error}>
    <header className="site-header"><div className="header-inner"><a className="brand" href="/" aria-label="Mystery Auction home"><span className="brand-mark"><Gavel size={23} /></span><span>Mystery Auction<small>The auction house</small></span></a><div className="header-actions"><span className="prototype-tag">PLAYTEST EDITION</span><button className="header-button" aria-label="How to play" onClick={() => openModal("rules")}><CircleHelp size={18} /><span>How to play</span></button>{game && <button className="header-button" aria-label="New game" onClick={() => openModal("reset")}><RotateCcw size={17} /><span>New game</span></button>}</div></div></header>
    <main className="app-shell">
      {saveWarning && <p className="error-banner" role="alert">{saveWarning}</p>}
      {error && !modal && !notebook && !accountId && <p className="error-banner" role="alert">{error}</p>}
      {!loaded ? <div className="loading-state">Opening the auction house…</div> : !game ? <div className="setup-layout">
        <section className="setup-intro"><p className="eyebrow"><span className="small-rule" /> Four collectors. Ten mysteries.</p><h1>What’s it<br /><em>really</em> worth?</h1><p className="setup-description">A little evidence. A good bluff. A very expensive hunch. Take your seat at the auction house.</p><div className="setup-art"><LotIllustration kind="chest" /><span className="art-label">Contents unknown. Possibilities unlimited.</span></div><div className="setup-facts"><div><Users size={20} /><strong>4 players</strong><span>One shared computer</span></div><div><Gavel size={20} /><strong>{config.rounds} rounds</strong><span>A fresh mystery each time</span></div><div><Landmark size={20} /><strong>{money(config.startingCash)}</strong><span>Starting cash each</span></div></div></section>
        <section className="panel setup-panel"><span className="tag">Your table is ready</span><h2>Meet the collectors.</h2><p className="muted">Enter four names, or use the defaults to test every seat yourself. No board or physical cards needed.</p><form onSubmit={event => { event.preventDefault(); try { setGame(generateGame(names)); setError(""); } catch (error) { setError((error as Error).message); } }}><div className="name-fields">{names.map((name, index) => <label className="field player-name-field" key={index}><span className={`avatar seat-${index}`}>{String(index + 1).padStart(2, "0")}</span><span>Player {index + 1}<input aria-label={`Player ${index + 1} name`} value={name} maxLength={32} required onChange={event => setNames(names.map((old, i) => i === index ? event.target.value : old))} /></span></label>)}</div><button className="button primary full-width large" type="submit">Open the auction house <ArrowRight size={19} /></button></form><p className="save-note"><ShieldCheck size={15} /> Progress saves automatically in this browser.</p></section>
      </div> : game.phase === "finished" ? <Results game={game} onNewGame={() => openModal("reset")} /> : <>
        <div className="game-title row-between"><div><p className="eyebrow">The auction room</p><h1>Every lot has a secret.</h1></div><div className="round-marker"><span>ROUND</span><strong>{String(game.round).padStart(2, "0")} <small>/ {game.config.rounds}</small></strong></div></div>
        <nav className="phase-track" aria-label="Round progress">{PHASES.map((phase, index) => <div key={phase.id} className={`phase-step ${index === phaseIndex ? "active" : ""} ${index < phaseIndex ? "complete" : ""}`} aria-current={index === phaseIndex ? "step" : undefined}><span className="phase-number">{index < phaseIndex ? <Check size={15} /> : index + 1}</span><div><strong>{phase.title}</strong><small>{phase.description}</small></div></div>)}</nav>
        <div className="game-grid">
          <section className="lot-card"><div className="lot-topline"><span className="eyebrow">{game.phase === "appraisal" ? "Under the hammer · sold" : "On the block"}</span><span className="lot-tag">LOT {String(item!.lot).padStart(2, "0")}</span></div><div className="lot-main"><div className="lot-copy"><span className="category-label">{item!.category}</span><h2>{item!.name}</h2><p>{item!.description}</p></div><LotIllustration kind={item!.templateId} /></div><div className="lot-valuation"><div><span>Public base value</span><strong>{money(item!.baseValue)}</strong></div><div className="lot-status">{item!.ownerId ? <><Check size={18} /><span>Acquired by<br /><strong>{game.players.find(player => player.id === item!.ownerId)?.name}</strong></span></> : <><LockKeyhole size={18} /><span>True value<br /><strong>Still a mystery</strong></span></>}</div></div><div className="hidden-slots">{SLOTS.map(slot => <div key={slot}><LockKeyhole size={13} /><span>{slot}</span></div>)}</div></section>
          <section className="panel action-panel"><div className="panel-heading"><div><p className="eyebrow">Step {phaseIndex + 1} of 4</p><h2>{game.consignment ? "Consignment auction" : game.phase === "actions" ? "Your next move" : game.phase === "negotiation" ? "A little table talk" : game.phase === "auction" ? "Going, going…" : "Appraisal window"}</h2></div><span className="panel-icon">{game.phase === "auction" ? <Gavel size={21} /> : <Search size={21} />}</span></div>
            {(game.phase === "actions" || game.phase === "appraisal") && !game.consignment && <div className="player-tabs" aria-label="Choose acting player">{game.players.map((person, index) => { const done = game.phase === "actions" ? !!game.actions[person.id] : game.appraisalDone.includes(person.id); return <button key={person.id} aria-label={person.name} aria-pressed={selectedId === person.id} className={selectedId === person.id ? "active" : ""} onClick={() => { setSelectedId(person.id); setError(""); }} title={person.name}><span className={`avatar small-avatar seat-${index}`}>{done ? <Check size={13} /> : index + 1}</span><span>{person.name}</span></button>; })}</div>}
            <GameControls key={`${game.round}-${game.phase}-${player!.id}-${game.consignment?.itemId ?? ""}`} game={game} player={player!} dispatch={dispatch} onDeals={() => openModal("deals")} />
            {game.phase === "actions" && allActionsDone && <div className="phase-footer"><button className="button primary full-width" onClick={() => dispatch({ type: "START_NEGOTIATION" })}>Continue to Negotiation <ArrowRight size={17} /></button></div>}
            {game.phase === "appraisal" && allAppraisalsDone && <div className="phase-footer"><p className="muted small">All appraisal decisions are complete. You can still manage funds before continuing.</p><button className="button primary full-width" onClick={() => game.round === game.config.rounds ? openModal("finish") : dispatch({ type: "ADVANCE" })}>{game.round === game.config.rounds ? "Review final settlement" : "Next round"} <ArrowRight size={17} /></button></div>}
          </section>
        </div>
        <div className="section-heading row-between"><h2>The collectors <span className="count">4</span></h2><span className="muted small">Cash is public. Knowledge is personal.</span></div>
        <section className="players-grid" aria-label="Player accounts">{game.players.map((person, index) => { const items = ownedItems(game, person.id); const leverage = game.loans.filter(loan => loan.playerId === person.id && loan.status === "active").reduce((sum, loan) => sum + loan.remaining, 0); return <article className="panel player-card" key={person.id}><div className="player-card-title"><span className={`avatar seat-${index}`}>{person.name.slice(0, 1).toUpperCase()}</span><div><h3>{person.name}</h3><span className="muted small">{items.length} {items.length === 1 ? "item" : "items"} in collection</span></div></div><div className="cash-balance"><span>Available cash</span><strong>{money(person.cash)}</strong></div><div className="debt-row"><span>Auction debt</span><strong className={person.auctionDebt ? "debt-text" : ""}>{money(person.auctionDebt)}</strong></div><div className="debt-row"><span>Leverage debt</span><strong>{money(leverage)}</strong></div><div className="mini-collection">{items.length ? items.map(item => <span key={item.id} title={item.name}>#{item.lot} {item.name}{activeLoan(game, item.id) ? " · Collateral" : ""}</span>) : <span className="muted">An empty shelf. For now.</span>}</div><div className="player-card-actions"><button onClick={() => { setError(""); setAccountId(person.id); }}><Landmark size={15} /> Manage funds</button><button aria-label={`${person.name} private notebook`} onClick={() => { setError(""); setNotebook({ playerId: person.id }); }}><BookOpen size={15} /> Notebook</button></div></article>; })}</section>
        <section className="panel activity-panel"><div className="panel-heading"><h2>The auction ledger</h2><span className="tag">Public record</span></div><ol className="activity-list">{game.log.slice(-8).reverse().map(entry => <li key={entry.id}><span>R{String(entry.round).padStart(2, "0")}</span><p>{entry.text}</p></li>)}</ol>{game.log.length > 8 && <details className="older-events"><summary>Show earlier entries ({game.log.length - 8})</summary><ol className="activity-list">{game.log.slice(0, -8).reverse().map(entry => <li key={entry.id}><span>R{String(entry.round).padStart(2, "0")}</span><p>{entry.text}</p></li>)}</ol></details>}</section>
      </>}
      <footer className="site-footer"><span>Mystery Auction <span className="footer-dot">·</span> A board game in the making</span><span><ShieldCheck size={14} /> {saveWarning ? "Session in this tab" : "Saved on this computer"}</span></footer>
    </main>
    {notebook && game && <PrivateNotebook game={game} {...notebook} onClose={() => setNotebook(null)} />}
    {accountId && game && <PlayerAccount game={game} player={game.players.find(player => player.id === accountId)!} dispatch={dispatch} onClose={() => setAccountId(null)} onNotebook={() => { setNotebook({ playerId: accountId }); setAccountId(null); }} />}
    {modal === "rules" && <Modal title="How to play" onClose={() => setModal(null)} wide><Rules config={config} /></Modal>}
    {modal === "deals" && game && <Modal title="Record a table deal" onClose={() => setModal(null)}><DealControls game={game} dispatch={dispatch} onClose={() => setModal(null)} /></Modal>}
    {modal === "reset" && <Modal title="Start a fresh game?" onClose={() => setModal(null)}><p>This replaces the saved game on this computer. A new set of mysteries will be generated when you start.</p><div className="button-row"><button className="button secondary" onClick={() => setModal(null)}>Keep this game</button><button className="button primary" onClick={newGame}>Start new game</button></div></Modal>}
    {modal === "finish" && game && <Modal title="Settle the final accounts" onClose={() => setModal(null)} wide><p>Unpaid collateral will be forfeited and its loan cleared. Then mandatory appraisals are charged, all item truths are revealed, and final scores are calculated.</p><div className="settlement-preview">{game.players.map(player => { const items = ownedItems(game, player.id); const forfeited = items.filter(item => activeLoan(game, item.id)); const fees = items.filter(item => !activeLoan(game, item.id)).reduce((sum, item) => sum + endgameAppraisalCost(game, item), 0); return <div key={player.id}><strong>{player.name}</strong><span>{money(fees)} in fees · {forfeited.length} items forfeited</span></div>; })}</div><p className="muted small">Return to the table to repay loans before settling. Settlement is final.</p><div className="button-row"><button className="button secondary" onClick={() => setModal(null)}>Back to the table</button><button className="button primary" onClick={() => { if (dispatch({ type: "ADVANCE" })) setModal(null); }}>Finish game & reveal values</button></div></Modal>}
  </ModalErrorContext.Provider>;
}
