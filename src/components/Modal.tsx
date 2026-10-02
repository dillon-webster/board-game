"use client";

import { createContext, useContext, useEffect, useRef } from "react";
import { X } from "lucide-react";

export const ModalErrorContext = createContext("");

export default function Modal({ title, children, onClose, wide = false }: { title: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const error = useContext(ModalErrorContext);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return <dialog ref={ref} className={`modal ${wide ? "modal-wide" : ""}`} aria-labelledby="modal-title" onCancel={onClose}>
    <div className="modal-heading"><h2 id="modal-title">{title}</h2><button className="icon-button" aria-label="Close dialog" onClick={onClose} autoFocus><X size={20} /></button></div>
    {error && <p className="error-banner" role="alert">{error}</p>}
    {children}
  </dialog>;
}
