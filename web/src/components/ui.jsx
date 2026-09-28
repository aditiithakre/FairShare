import { useEffect } from "react";

export const initials = (name) =>
  (name || "?").trim().split(/\s+/).map((word) => word[0]).slice(0, 2).join("").toUpperCase() || "?";

export function Avatar({ name, size }) {
  const style = size ? { width: size, height: size, fontSize: size * 0.38 } : undefined;
  return <div className="avatar" style={style}>{initials(name)}</div>;
}

export function Dialog({ title, children, onClose, footer }) {
  useEffect(() => {
    const onKey = (event) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="scrim" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="dialog" role="dialog" aria-modal="true" aria-label={title}>
        <div className="dialog-head">
          <h3>{title}</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="dialog-body">{children}</div>
        {footer ? <div className="dialog-foot">{footer}</div> : null}
      </div>
    </div>
  );
}

export function Confirm({ title, body, confirmLabel, onConfirm, onClose }) {
  return (
    <Dialog
      title={title}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-quiet" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => { onConfirm(); onClose(); }}>{confirmLabel}</button>
        </>
      }
    >
      <p style={{ margin: 0, color: "var(--ink-2)", fontSize: 14 }}>{body}</p>
    </Dialog>
  );
}
