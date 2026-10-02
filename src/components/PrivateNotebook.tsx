"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff, LockKeyhole, NotebookPen } from "lucide-react";
import { SLOTS, type GameState } from "@/types/game";
import { calculateItemValue, money } from "@/lib/valuation";
import Modal from "./Modal";

export default function PrivateNotebook({ game, playerId, itemId, onClose }: { game: GameState; playerId: string; itemId?: string; onClose: () => void }) {
  const [revealed, setRevealed] = useState(false);
  const player = game.players.find(player => player.id === playerId)!;
  const knownItems = game.items.filter(item => player.knowledge[item.id] && (!itemId || item.id === itemId));
  useEffect(() => {
    const hide = () => setRevealed(false);
    window.addEventListener("blur", hide);
    document.addEventListener("visibilitychange", hide);
    return () => { window.removeEventListener("blur", hide); document.removeEventListener("visibilitychange", hide); };
  }, []);

  return <Modal title={`${player.name}’s private notebook`} onClose={onClose} wide>
    {!revealed ? <div className="privacy-gate">
      <span className="large-icon"><LockKeyhole size={30} /></span>
      <p className="eyebrow">For {player.name} only</p>
      <h3>A little inside information.</h3>
      <p>{game.mode === "solo" ? "Your clues and appraisal results are yours alone. Computer opponents only use their own notes." : <>Pass the computer to {player.name}. Make sure the other players look away before revealing your notes.</>}</p>
      <button className="button primary" onClick={() => setRevealed(true)}><Eye size={17} /> Reveal my private notes</button>
    </div> : <>
      <div className="notice"><EyeOff size={18} /><span>{game.mode === "solo" ? "Your private information · hidden from the bots." : "Private information · close this notebook before passing the computer."}</span></div>
      {knownItems.length === 0 && <div className="empty-state"><NotebookPen size={28} /><p>No clues or appraisals yet.</p></div>}
      <div className="notebook-content">
        {knownItems.map(item => {
          const knowledge = player.knowledge[item.id];
          const fullyKnown = SLOTS.every(slot => knowledge.appraisedSlots.includes(slot));
          return <section className="notebook-item" key={item.id}>
            <p className="eyebrow">Lot {String(item.lot).padStart(2, "0")}</p><h3>{item.name}</h3>
            {item.ownerId !== player.id && <p className="muted small">You retain these notes even though you do not own this item.</p>}
            {SLOTS.map(slot => {
              const appraised = knowledge.appraisedSlots.includes(slot);
              const clues = knowledge.clues[slot];
              if (!appraised && !clues.length) return null;
              return <div className="knowledge-slot" key={slot}>
                <div className="row-between"><h4>{slot}</h4><span className="tag">{appraised ? "Appraised" : "Clue"}</span></div>
                {clues.map((clue, i) => <p key={i} className="clue-text">“{clue}”</p>)}
                {appraised && <div className="truth"><p>{item.hidden[slot].truth}</p><strong>{item.hidden[slot].valueModifier >= 0 ? "+" : ""}{money(item.hidden[slot].valueModifier)}</strong></div>}
              </div>;
            })}
            {fullyKnown && <div className="total-line"><span>Exact item value</span><strong>{money(calculateItemValue(item))}</strong></div>}
          </section>;
        })}
      </div>
      <button className="button primary full-width" onClick={onClose}><EyeOff size={17} /> Hide notes & return to the table</button>
    </>}
  </Modal>;
}
