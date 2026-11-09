"use client";
/**
 * Bottom sheet on a native <dialog> (focus trap, Esc, backdrop): the swap list and the end confirmation (stream 04).
 * Children render only while open.
 */
import { useEffect, useRef, type ReactNode } from "react";

export function Sheet({ open, onClose, labelledBy, className, children }: {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      try {
        dialog.showModal();
      } catch {
        dialog.setAttribute("open", "");
      }
    } else if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className={`trk-sheet${className ? ` ${className}` : ""}`}
      aria-labelledby={labelledBy}
      onClose={() => {
        if (open) onClose();
      }}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {open ? <div className="trk-sheet-body">{children}</div> : null}
    </dialog>
  );
}
