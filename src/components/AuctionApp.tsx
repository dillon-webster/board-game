"use client";

import { useEffect, useState } from "react";
import { ArrowRight, BookOpen, Check, CircleHelp, Gavel, Landmark, LockKeyhole, RotateCcw, Search, ShieldCheck, Users } from "lucide-react";
import { GAME_CONFIG } from "@/lib/config";
import { activeLoan, currentItem, endChanceAfter, generateGame, ownedItems } from "@/lib/gameEngine";
import { executePlayCommand, runBotTurns, type PlayCommand } from "@/lib/botGame";
import { BOT_PROFILES, isBot } from "@/lib/bots";
import { accountNetWorth, money } from "@/lib/valuation";
import { parseSavedGame, STORAGE_KEY } from "@/lib/storage";
import { SLOTS, type GameState } from "@/types/game";
import GameControls, { DealControls } from "./GameControls";
import LotIllustration from "./LotIllustration";
import Modal, { ModalErrorContext } from "./Modal";
import PlayerAccount from "./PlayerAccount";
import PrivateNotebook from "./PrivateNotebook";
import Results from "./Results";
import Rules from "./Rules";
import TableTalk, { type TalkStatus } from "./TableTalk";
import { requestBotLine, respondersTo } from "@/lib/talkClient";
import type { TalkTrigger } from "@/lib/tableTalk";

const MIN_ROUNDS = 1;
const MAX_ROUNDS = 30;

const PHASES = [
  { id: "actions", title: "Investigate", description: "One action each" },
  { id: "negotiation", title: "Negotiate", description: "Talk & trade" },
  { id: "auction", title: "Auction", description: "Record the winner" },
  { id: "inspection", title: "Inspect", description: "One inspection each" },
];

export default function AuctionApp() {
  const [loaded, setLoaded] = useState(false);
  const [game, setGame] = useState<GameState | null>(null);
  const [mode, setMode] = useState<GameState["mode"]>("shared");
  const [names, setNames] = useState(["Player 1", "Player 2", "Player 3", "Player 4"]);
  const [rounds, setRounds] = useState(String(GAME_CONFIG.rounds));
  const [guaranteed, setGuaranteed] = useState(String(GAME_CONFIG.guaranteedRounds));
  const [selectedId, setSelectedId] = useState("player-1");
  const [error, setError] = useState("");
  const [saveWarning, setSaveWarning] = useState("");
  const [notebook, setNotebook] = useState<{ playerId: string; itemId?: string } | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [modal, setModal] = useState<"rules" | "reset" | "deals" | "finish" | null>(null);
  const [speaking, setSpeaking] = useState<string[]>([]);
  const [talkStatus, setTalkStatus] = useState<TalkStatus>("unknown");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const restored = runBotTurns(parseSavedGame(saved));
        setMode(restored.mode);
        setGame(restored);
        const pending = restored.players.filter(player => !isBot(restored, player.id)).find(player => restored.phase === "actions" ? !restored.actions[player.id] : restored.phase === "inspection" ? !restored.inspectionDone.includes(player.id) : false);
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

  useEffect(() => {
    if (!game?.bidding || !isBot(game, game.bidding.turnPlayerId) || modal || notebook || accountId) return;
    const timer = window.setTimeout(() => {
      try {
        const next = executePlayCommand(game, { type: "BOT_BID_TURN" });
        // Ignore an obsolete timer after another action or a reset.
        setGame(current => current === game ? next : current);
      } catch (error) {
        setError(error instanceof Error ? error.message : "The bot turn could not be completed.");
      }
    }, 650);
    return () => window.clearTimeout(timer);
  }, [game, modal, notebook, accountId]);

  // Bot lines arrive asynchronously; each is appended to whatever the game is by then.
  function botsSpeak(state: GameState, botIds: string[], trigger: TalkTrigger) {
    if (state.mode !== "solo" || !botIds.length) return;
    setSpeaking(current => [...new Set([...current, ...botIds])]);
    for (const botId of botIds) {
      requestBotLine(state, botId, trigger).then(line => {
        setTalkStatus(line.live ? "live" : "offline");
        setGame(current => {
          if (!current || current.id !== state.id) return current;
          try { return executePlayCommand(current, { type: "SAY", speakerId: botId, text: line.text }); } catch { return current; }
        });
      }).finally(() => setSpeaking(current => current.filter(id => id !== botId)));
    }
  }

  function say(text: string) {
    if (!game) return;
    try {
      const next = executePlayCommand(game, { type: "SAY", speakerId: game.players[0].id, text });
      setGame(next);
      setError("");
      // Responders see the human's line in their context.
      botsSpeak(next, respondersTo(next, text), { kind: "human-message", text: text.trim() });
    } catch (error) {
      setError(error instanceof Error ? error.message : "That message could not be sent.");
    }
  }

  function dispatch(command: PlayCommand): boolean {
    if (!game) return false;
    try {
      const next = executePlayCommand(game, command);
      setGame(next);
      setError("");
      if (next.mode === "solo") {
        const events = next.log.slice(game.log.length).map(entry => entry.text);
        if (command.type === "START_NEGOTIATION") botsSpeak(next, next.players.slice(1).map(bot => bot.id), { kind: "negotiation-open" });
        if (command.type === "PROPOSE_DEAL") botsSpeak(next, [command.botId], { kind: "deal", events });
        if (command.type === "RESPOND_OFFER") {
          const offer = game.negotiation.offers.find(offer => offer.id === command.offerId);
          if (offer) botsSpeak(next, [offer.botId], { kind: "deal", events });
        }
      }
      if (command.type === "BUY_CLUE") setNotebook({ playerId: command.playerId, itemId: currentItem(game).id });
      if (command.type === "INSPECT") setNotebook({ playerId: command.playerId, itemId: command.itemId });
      const pending = next.players.filter(player => !isBot(next, player.id)).find(player => next.phase === "actions" ? !next.actions[player.id] : next.phase === "inspection" ? !next.inspectionDone.includes(player.id) : false);
      if (pending) setSelectedId(pending.id);
      return true;
    } catch (error) {
      setError(error instanceof Error ? error.message : "That action could not be completed.");
      return false;
    }
  }

  function newGame() {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* The storage warning remains visible. */ }
    setGame(null); setSpeaking([]); setModal(null); setNotebook(null); setAccountId(null); setError(""); setSelectedId("player-1");
  }

  function openModal(value: typeof modal) { setError(""); setModal(value); }
  const chosenRounds = Number(rounds);
  const chosenGuaranteed = Number(guaranteed);
  const roundsValid = Number.isInteger(chosenRounds) && chosenRounds >= MIN_ROUNDS && chosenRounds <= MAX_ROUNDS &&
    Number.isInteger(chosenGuaranteed) && chosenGuaranteed >= MIN_ROUNDS && chosenGuaranteed <= chosenRounds;
  const config = game?.config ?? (roundsValid ? { ...GAME_CONFIG, rounds: chosenRounds, guaranteedRounds: chosenGuaranteed } : GAME_CONFIG);
  const lengthLabel = config.guaranteedRounds === config.rounds ? String(config.rounds) : `${config.guaranteedRounds}–${config.rounds}`;
  const item = game ? currentItem(game) : null;
  const player = game?.mode === "solo" ? game.players[0] : game?.players.find(player => player.id === selectedId) ?? game?.players[0];
  const allActionsDone = game?.players.every(player => game.actions[player.id]) && !game?.consignment;
  const allInspectionsDone = game?.players.every(player => game.inspectionDone.includes(player.id));
  const endChance = game ? endChanceAfter(game.config, game.round) : 0;
  const phaseIndex = PHASES.findIndex(phase => phase.id === game?.phase);

  return <ModalErrorContext.Provider value={error}>
    <header className="site-header"><div className="header-inner"><a className="brand" href="/" aria-label="Mystery Auction home"><span className="brand-mark"><Gavel size={23} /></span><span>Mystery Auction<small>The auction house</small></span></a><div className="header-actions"><span className="prototype-tag">PLAYTEST EDITION</span><button className="header-button" aria-label="How to play" onClick={() => openModal("rules")}><CircleHelp size={18} /><span>How to play</span></button>{game && <button className="header-button" aria-label="New game" onClick={() => openModal("reset")}><RotateCcw size={17} /><span>New game</span></button>}</div></div></header>
    <main className="app-shell">
      {saveWarning && <p className="error-banner" role="alert">{saveWarning}</p>}
      {error && !modal && !notebook && !accountId && <p className="error-banner" role="alert">{error}</p>}
      {!loaded ? <div className="loading-state">Opening the auction house…</div> : !game ? <div className="setup-layout">
        <section className="setup-intro"><p className="eyebrow"><span className="small-rule" /> Four collectors. {lengthLabel} {config.rounds === 1 ? "mystery" : "mysteries"}.</p><h1>What’s it<br /><em>really</em> worth?</h1><p className="setup-description">A little evidence. A good bluff. A very expensive hunch. Take your seat at the auction house.</p><div className="setup-art"><LotIllustration kind="chest" /><span className="art-label">Contents unknown. Possibilities unlimited.</span></div><div className="setup-facts"><div><Users size={20} /><strong>4 players</strong><span>{mode === "solo" ? "You + three bots" : "One shared computer"}</span></div><div><Gavel size={20} /><strong>{lengthLabel} rounds</strong><span>A fresh mystery each time</span></div><div><Landmark size={20} /><strong>{money(config.startingCash)}</strong><span>Starting cash each</span></div></div></section>
        <section className="panel setup-panel">
          <span className="tag">Your table is ready</span><h2>Meet the collectors.</h2>
          <div className="segmented mode-picker" aria-label="Game mode">
            <button type="button" aria-pressed={mode === "solo"} className={mode === "solo" ? "selected" : ""} onClick={() => setMode("solo")}>Play against bots</button>
            <button type="button" aria-pressed={mode === "shared"} className={mode === "shared" ? "selected" : ""} onClick={() => setMode("shared")}>Shared computer</button>
          </div>
          <p className="muted">{mode === "solo" ? "Take your seat against three computer collectors. They investigate, bid, haggle, and talk a good game. No account or API key needed." : "Enter four names, or use the defaults to test every seat yourself. No board or physical cards needed."}</p>
          <form onSubmit={event => {
            event.preventDefault();
            try {
              const tableNames = mode === "solo" ? [names[0], ...BOT_PROFILES.map(bot => bot.name)] : names;
              if (!roundsValid) throw new Error(`Choose a maximum of ${MIN_ROUNDS}–${MAX_ROUNDS} rounds, with guaranteed rounds no higher than the maximum.`);
              setGame(runBotTurns(generateGame(tableNames, config, Math.random, mode)));
              setError("");
            } catch (error) { setError((error as Error).message); }
          }}>
            <div className="name-fields">{(mode === "solo" ? names.slice(0, 1) : names).map((name, index) => <label className="field player-name-field" key={index}><span className={`avatar seat-${index}`}>{String(index + 1).padStart(2, "0")}</span><span>{mode === "solo" ? "Your name" : `Player ${index + 1}`}<input aria-label={`Player ${index + 1} name`} value={name} maxLength={32} required onChange={event => setNames(names.map((old, i) => i === index ? event.target.value : old))} /></span></label>)}</div>
            <div className="rounds-fields">
              <label className="field rounds-field">Guaranteed rounds<input aria-label="Guaranteed rounds" type="number" min={MIN_ROUNDS} max={MAX_ROUNDS} step="1" required value={guaranteed} onChange={event => setGuaranteed(event.target.value)} /></label>
              <label className="field rounds-field">Maximum rounds<input aria-label="Maximum rounds" type="number" min={MIN_ROUNDS} max={MAX_ROUNDS} step="1" required value={rounds} onChange={event => setRounds(event.target.value)} /></label>
            </div>
            <p className="muted small rounds-summary">{!roundsValid ? `Guaranteed rounds must be ${MIN_ROUNDS}–${MAX_ROUNDS} and no higher than the maximum.` : config.guaranteedRounds === config.rounds ? `Exactly ${config.rounds} ${config.rounds === 1 ? "round" : "rounds"}, one lot each.` : `One lot per round. After round ${config.guaranteedRounds}, the auction house may close: ${Array.from({ length: config.rounds - config.guaranteedRounds }, (_, index) => `${Math.round(endChanceAfter(config, config.guaranteedRounds + index) * 100)}%`).join(", ")} after each later round, and it always closes after round ${config.rounds}.`}</p>
            {mode === "solo" && <div className="bot-lineup">{BOT_PROFILES.map((bot, index) => <div key={bot.name}><span className={`avatar seat-${index + 1}`}>{bot.name[0]}</span><div><strong>{bot.name}</strong><span>{bot.style} bot</span></div></div>)}</div>}
            <button className="button primary full-width large" type="submit">Open the auction house <ArrowRight size={19} /></button>
          </form>
          <p className="save-note"><ShieldCheck size={15} /> Progress saves automatically in this browser.</p>
        </section>
      </div> : game.phase === "finished" ? <Results game={game} onNewGame={() => openModal("reset")} /> : <>
        <div className="game-title row-between"><div><p className="eyebrow">{game.mode === "solo" ? "Solo table · You vs. three bots" : "The auction room"}</p><h1>Every lot has a secret.</h1></div><div className="round-marker"><span>ROUND</span><strong>{String(game.round).padStart(2, "0")} <small>/ {lengthLabel}</small></strong></div></div>
        <nav className="phase-track" aria-label="Round progress">{PHASES.map((phase, index) => <div key={phase.id} className={`phase-step ${index === phaseIndex ? "active" : ""} ${index < phaseIndex ? "complete" : ""}`} aria-current={index === phaseIndex ? "step" : undefined}><span className="phase-number">{index < phaseIndex ? <Check size={15} /> : index + 1}</span><div><strong>{phase.title}</strong><small>{phase.id === "auction" && game.mode === "solo" ? "Take turns bidding" : phase.description}</small></div></div>)}</nav>
        <div className="game-grid">
          <section className="lot-card"><div className="lot-topline"><span className="eyebrow">{game.phase === "inspection" ? item!.ownerId ? "Under the hammer · sold" : "Auction closed · unsold" : "On the block"}</span><span className="lot-tag">LOT {String(item!.lot).padStart(2, "0")}</span></div><div className="lot-main"><div className="lot-copy"><span className="category-label">{item!.category}</span><h2>{item!.name}</h2><p>{item!.description}</p></div><LotIllustration kind={item!.templateId} /></div><div className="lot-valuation"><div><span>Public base value</span><strong>{money(item!.baseValue)}</strong></div><div className="lot-status">{item!.ownerId ? <><Check size={18} /><span>Acquired by<br /><strong>{game.players.find(player => player.id === item!.ownerId)?.name}</strong></span></> : <><LockKeyhole size={18} /><span>True value<br /><strong>Still a mystery</strong></span></>}</div></div><div className="hidden-slots">{SLOTS.map(slot => <div key={slot}><LockKeyhole size={13} /><span>{slot}</span></div>)}</div></section>
          <section className="panel action-panel"><div className="panel-heading"><div><p className="eyebrow">Step {phaseIndex + 1} of 4</p><h2>{game.consignment ? "Consignment auction" : game.phase === "actions" ? "Your next move" : game.phase === "negotiation" ? "A little table talk" : game.phase === "auction" ? "Going, going…" : "Inspection window"}</h2></div><span className="panel-icon">{game.phase === "auction" ? <Gavel size={21} /> : <Search size={21} />}</span></div>
            {(game.phase === "actions" || game.phase === "inspection") && !game.consignment && <div className="player-tabs" aria-label="Choose acting player">{game.players.map((person, index) => { const done = game.phase === "actions" ? !!game.actions[person.id] : game.inspectionDone.includes(person.id); return <button key={person.id} disabled={isBot(game, person.id)} aria-label={person.name} aria-pressed={selectedId === person.id} className={selectedId === person.id ? "active" : ""} onClick={() => { setSelectedId(person.id); setError(""); }} title={person.name}><span className={`avatar small-avatar seat-${index}`}>{done ? <Check size={13} /> : index + 1}</span><span>{person.name}</span></button>; })}</div>}
            <GameControls key={`${game.round}-${game.phase}-${player!.id}-${game.consignment?.itemId ?? ""}`} game={game} player={player!} dispatch={dispatch} onDeals={() => openModal("deals")} />
            {game.phase === "actions" && allActionsDone && <div className="phase-footer"><button className="button primary full-width" onClick={() => dispatch({ type: "START_NEGOTIATION" })}>Continue to Negotiation <ArrowRight size={17} /></button></div>}
            {game.phase === "inspection" && allInspectionsDone && <div className="phase-footer"><p className="muted small">All inspection decisions are complete. You can still manage funds before continuing.</p>{endChance > 0 && endChance < 1 && <p className="inline-warning" role="note">There’s a {Math.round(endChance * 100)}% chance the auction house closes after this round. If it does, unpaid collateral is forfeited and every item is revealed.</p>}<button className="button primary full-width" onClick={() => endChance >= 1 ? openModal("finish") : dispatch({ type: "ADVANCE" })}>{endChance >= 1 ? "Review final settlement" : endChance > 0 ? "Continue · the house may close" : "Next round"} <ArrowRight size={17} /></button></div>}
          </section>
        </div>
        {game.mode === "solo" && (game.phase === "negotiation" || game.chat.some(entry => entry.round === game.round)) && <TableTalk game={game} speaking={speaking} status={talkStatus} onSay={say} />}
        <div className="section-heading row-between"><h2>The collectors <span className="count">4</span></h2><span className="muted small">{game.mode === "solo" ? "Rival balances stay private until settlement." : "Cash is public. Knowledge is personal."}</span></div>
        <section className="players-grid" aria-label="Player accounts">{game.players.map((person, index) => { const items = ownedItems(game, person.id); const account = game.mode === "solo" && !isBot(game, person.id) ? accountNetWorth(game, person) : null; const leverage = game.loans.filter(loan => loan.playerId === person.id && loan.status === "active").reduce((sum, loan) => sum + loan.remaining, 0); return <article className="panel player-card" key={person.id}><div className="player-card-title"><span className={`avatar seat-${index}`}>{person.name.slice(0, 1).toUpperCase()}</span><div><h3>{person.name}</h3><span className="muted small">{items.length} {items.length === 1 ? "item" : "items"} in collection</span></div></div><div className="cash-balance"><span>Available cash</span><strong className={isBot(game, person.id) ? "private-cash" : undefined}>{isBot(game, person.id) ? <><LockKeyhole size={16} /> Private</> : money(person.cash)}</strong></div>{account && <div className="debt-row account-worth"><span>{account.estimated ? "Est. net worth" : "Net worth"}</span><strong>{money(account.netWorth)}</strong></div>}<div className="debt-row"><span>Auction debt</span><strong className={person.auctionDebt ? "debt-text" : ""}>{money(person.auctionDebt)}</strong></div><div className="debt-row"><span>Leverage debt</span><strong>{money(leverage)}</strong></div><div className="mini-collection">{items.length ? items.map(item => <span key={item.id} title={item.name}>#{item.lot} {item.name}{!isBot(game, person.id) ? ` · paid ${money(item.purchasePrice ?? 0)}` : ""}{activeLoan(game, item.id) ? " · Collateral" : ""}</span>) : <span className="muted">An empty shelf. For now.</span>}</div><div className="player-card-actions">{isBot(game, person.id) ? <p className="bot-status">{BOT_PROFILES[index - 1].style} bot · plays automatically</p> : <><button onClick={() => { setError(""); setAccountId(person.id); }}><Landmark size={15} /> Manage funds</button><button aria-label={`${person.name} private notebook`} onClick={() => { setError(""); setNotebook({ playerId: person.id }); }}><BookOpen size={15} /> Notebook</button></>}</div></article>; })}</section>
        <section className="panel activity-panel"><div className="panel-heading"><h2>The auction ledger</h2><span className="tag">Public record</span></div><ol className="activity-list">{game.log.slice(-8).reverse().map(entry => <li key={entry.id}><span>R{String(entry.round).padStart(2, "0")}</span><p>{entry.text}</p></li>)}</ol>{game.log.length > 8 && <details className="older-events"><summary>Show earlier entries ({game.log.length - 8})</summary><ol className="activity-list">{game.log.slice(0, -8).reverse().map(entry => <li key={entry.id}><span>R{String(entry.round).padStart(2, "0")}</span><p>{entry.text}</p></li>)}</ol></details>}</section>
      </>}
      <footer className="site-footer"><span>Mystery Auction <span className="footer-dot">·</span> A board game in the making</span><span><ShieldCheck size={14} /> {saveWarning ? "Session in this tab" : "Saved on this computer"}</span></footer>
    </main>
    {notebook && game && <PrivateNotebook game={game} {...notebook} onClose={() => setNotebook(null)} />}
    {accountId && game && <PlayerAccount game={game} player={game.players.find(player => player.id === accountId)!} dispatch={dispatch} onClose={() => setAccountId(null)} onNotebook={() => { setNotebook({ playerId: accountId }); setAccountId(null); }} />}
    {modal === "rules" && <Modal title="How to play" onClose={() => setModal(null)} wide><Rules config={config} solo={(game?.mode ?? mode) === "solo"} /></Modal>}
    {modal === "deals" && game && <Modal title="Record a table deal" onClose={() => setModal(null)}><DealControls game={game} dispatch={dispatch} onClose={() => setModal(null)} /></Modal>}
    {modal === "reset" && <Modal title="Start a fresh game?" onClose={() => setModal(null)}><p>This replaces the saved game on this computer. A new set of mysteries will be generated when you start.</p><div className="button-row"><button className="button secondary" onClick={() => setModal(null)}>Keep this game</button><button className="button primary" onClick={newGame}>Start new game</button></div></Modal>}
    {modal === "finish" && game && <Modal title="Settle the final accounts" onClose={() => setModal(null)} wide><p>Unpaid collateral will be forfeited and its loan cleared. Then every item truth is revealed and final scores are calculated.</p><div className="settlement-preview">{game.players.map(player => { const items = ownedItems(game, player.id); const forfeited = items.filter(item => activeLoan(game, item.id)); return <div key={player.id}><strong>{player.name}</strong><span>{items.length - forfeited.length} items revealed · {forfeited.length} items forfeited</span></div>; })}</div><p className="muted small">Return to the table to repay loans before settling. Settlement is final.</p><div className="button-row"><button className="button secondary" onClick={() => setModal(null)}>Back to the table</button><button className="button primary" onClick={() => { if (dispatch({ type: "ADVANCE" })) setModal(null); }}>Finish game & reveal values</button></div></Modal>}
  </ModalErrorContext.Provider>;
}
