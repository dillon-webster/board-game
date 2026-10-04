"use client";

import { useState } from "react";
import { MessageCircle, Send } from "lucide-react";
import { CHAT_MAX_LENGTH, type GameState } from "@/types/game";

export type TalkStatus = "unknown" | "live" | "offline";

export default function TableTalk({ game, speaking, status, onSay }: { game: GameState; speaking: string[]; status: TalkStatus; onSay: (text: string) => void }) {
  const [text, setText] = useState("");
  const entries = game.chat.filter(entry => entry.round === game.round);
  const nameOf = (id: string) => game.players.find(player => player.id === id)?.name ?? "Someone";
  const seat = (id: string) => game.players.findIndex(player => player.id === id);
  return <section className="panel table-talk" aria-label="Table talk">
    <div className="panel-heading"><h2><MessageCircle size={18} /> Table talk</h2><span className="tag">{status === "offline" ? "Offline lines" : status === "live" ? "Live" : "Bluffing allowed"}</span></div>
    <ol className="chat-list">
      {entries.length === 0 && <li className="muted small">The room is quiet. Say something to the collectors.</li>}
      {entries.map(entry => <li key={entry.id} className={entry.speakerId === game.players[0].id ? "own" : undefined}>
        <span className={`avatar small-avatar seat-${seat(entry.speakerId)}`}>{nameOf(entry.speakerId)[0]}</span>
        <p><strong>{nameOf(entry.speakerId)}</strong>{entry.text}</p>
      </li>)}
      {speaking.map(id => <li key={`typing-${id}`} className="typing" role="status"><span className={`avatar small-avatar seat-${seat(id)}`}>{nameOf(id)[0]}</span><p>{nameOf(id)} is thinking…</p></li>)}
    </ol>
    {game.phase === "negotiation" ? <form className="chat-form" onSubmit={event => { event.preventDefault(); if (text.trim()) { onSay(text); setText(""); } }}>
      <input aria-label="Say something to the table" value={text} maxLength={CHAT_MAX_LENGTH} onChange={event => setText(event.target.value)} placeholder="Bluff, probe, or needle a rival…" />
      <button className="button primary" type="submit" aria-label="Send" disabled={!text.trim()}><Send size={16} /></button>
    </form> : <p className="muted small chat-closed">Table talk opens during negotiation.</p>}
    {status === "offline" && <p className="muted small chat-closed">Add ANTHROPIC_API_KEY to .env.local and restart the dev server for live Claude-voiced bots.</p>}
  </section>;
}
