// Small presentational pieces shared by the finance pages.
//
// These wrap the class names from finance.css rather than introducing a second
// styling vocabulary, so a page reads much like the Jinja template it replaces.

import { cloneElement, isValidElement, useEffect, useId, useRef } from "react";
import type { ReactElement, ReactNode } from "react";
import { createPortal } from "react-dom";
import type { Decimal } from "../lib/money";
import { fmtMoney, fmtPercent, money } from "../lib/money";

// --- page furniture ---------------------------------------------------------

export function PageHead({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="page-head">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {subtitle && <p className="subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="button-row">{actions}</div>}
    </div>
  );
}

export function SectionHead({
  title,
  caption,
  aside,
}: {
  title: string;
  caption?: string;
  aside?: ReactNode;
}) {
  return (
    <div className="section-head">
      <div>
        <h2>{title}</h2>
        {caption && <div className="section-caption">{caption}</div>}
      </div>
      {aside}
    </div>
  );
}

export function Card({
  children,
  pad = true,
  className = "",
  as: Tag = "article",
}: {
  children: ReactNode;
  pad?: boolean;
  className?: string;
  as?: "article" | "section" | "div";
}) {
  return <Tag className={`card${pad ? " card-pad" : ""} ${className}`.trim()}>{children}</Tag>;
}

export function Metric({
  label,
  value,
  note,
  notePositive = false,
  icon,
}: {
  label: ReactNode;
  value: ReactNode;
  note?: ReactNode;
  notePositive?: boolean;
  icon?: string;
}) {
  return (
    <article className="card metric">
      <span className="metric-label">{label}</span>
      <div className="metric-value">{value}</div>
      {note && <div className={`metric-note${notePositive ? " positive" : ""}`}>{note}</div>}
      {icon && (
        <svg className="metric-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d={icon} />
        </svg>
      )}
    </article>
  );
}

/** The circled-i note the original used for advisory copy. */
export function Advisory({ children, style }: { children: ReactNode; style?: React.CSSProperties }) {
  return (
    <div className="advisory" style={style}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v5m0-8h.01" />
      </svg>
      <span>{children}</span>
    </div>
  );
}

export function Tag({
  children,
  tone,
  small = false,
}: {
  children: ReactNode;
  tone?: "gold" | "green";
  small?: boolean;
}) {
  return <span className={`tag${tone ? ` ${tone}` : ""}${small ? " small" : ""}`}>{children}</span>;
}

export function Empty({ children, colSpan }: { children: ReactNode; colSpan?: number }) {
  if (colSpan) {
    return (
      <tr>
        <td colSpan={colSpan} className="empty">
          {children}
        </td>
      </tr>
    );
  }
  return <p className="empty">{children}</p>;
}

export function ProgressRow({
  title,
  value,
  percent,
  leftDetail,
  rightDetail,
  danger = false,
}: {
  title: ReactNode;
  value?: ReactNode;
  percent: Decimal | number;
  leftDetail?: ReactNode;
  rightDetail?: ReactNode;
  danger?: boolean;
}) {
  const width = typeof percent === "number" ? percent : percent.toNumber();
  return (
    <div className="progress-row">
      <div className="progress-meta">
        <span className="progress-title">{title}</span>
        {value && <span className="progress-value">{value}</span>}
      </div>
      <div className="progress-track">
        <div
          className={`progress-fill${danger ? " danger-fill" : ""}`}
          style={{ width: `${Math.max(0, Math.min(100, width))}%` }}
        />
      </div>
      {(leftDetail || rightDetail) && (
        <div className="progress-detail">
          <span>{leftDetail}</span>
          <span>{rightDetail}</span>
        </div>
      )}
    </div>
  );
}

/** A labelled cell in the five-part cash equation. */
export function EquationPart({
  label,
  value,
  result = false,
}: {
  label: ReactNode;
  value: ReactNode;
  result?: boolean;
}) {
  return (
    <div className={`equation-part${result ? " equation-result" : ""}`}>
      <small>{label}</small>
      <strong>{value}</strong>
    </div>
  );
}

// --- money display ----------------------------------------------------------

/** Money with the app's colour rules: green for income, red for negative. */
export function Money({
  value,
  income = false,
  signed = false,
  className = "",
}: {
  value: Decimal | string | number;
  income?: boolean;
  signed?: boolean;
  className?: string;
}) {
  const amount = money(value);
  const negative = amount.isNegative();
  const tone = income ? " income" : negative ? " danger" : "";
  const prefix = signed && !negative && !amount.isZero() ? "+" : "";
  return <span className={`amount${tone} ${className}`.trim()}>{prefix + fmtMoney(amount)}</span>;
}

export function Percent({ value, places = 1 }: { value: Decimal | number; places?: number }) {
  return <>{fmtPercent(value, places)}</>;
}

// --- modal ------------------------------------------------------------------

/**
 * The original used a native <dialog> opened by a data attribute. React state
 * drives it here instead, but the visual treatment and the Escape/backdrop
 * behaviour are the same.
 */
export function Modal({
  open,
  onClose,
  eyebrow,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  eyebrow?: string;
  title: string;
  children: ReactNode;
}) {
  const headingId = useId();
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    // The page behind a modal should not scroll away under it.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="finance-modal-backdrop finance-root"
      ref={backdropRef}
      onMouseDown={(event) => {
        if (event.target === backdropRef.current) onClose();
      }}
    >
      <div className="finance-modal" role="dialog" aria-modal="true" aria-labelledby={headingId}>
        <div className="dialog-head">
          <div>
            {eyebrow && <p className="eyebrow">{eyebrow}</p>}
            <h2 id={headingId}>{title}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="dialog-body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

// --- forms ------------------------------------------------------------------

export function Field({
  label,
  children,
  full = false,
  hint,
}: {
  label: ReactNode;
  children: ReactNode;
  full?: boolean;
  hint?: ReactNode;
}) {
  const id = useId();
  // Thread the generated id onto the control so the label points at it, without
  // every caller having to pass one. A control that already has an id keeps it.
  const control = isValidElement(children)
    ? cloneElement(children as ReactElement<{ id?: string }>, {
        id: (children.props as { id?: string }).id ?? id,
      })
    : children;

  return (
    <div className={`field${full ? " full" : ""}`}>
      <label htmlFor={id}>{label}</label>
      {control}
      {hint && <span className="small-text muted">{hint}</span>}
    </div>
  );
}

export function FormActions({ children }: { children: ReactNode }) {
  return <div className="form-actions">{children}</div>;
}

export function Button({
  children,
  variant,
  small = false,
  type = "button",
  ...rest
}: {
  children: ReactNode;
  variant?: "secondary" | "gold";
  small?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const className = ["button", variant, small ? "small" : ""].filter(Boolean).join(" ");
  return (
    <button className={className} type={type} {...rest}>
      {children}
    </button>
  );
}

/** A full-width table inside a horizontally scrollable wrapper. */
export function TableCard({
  head,
  children,
}: {
  head: ReactNode;
  children: ReactNode;
}) {
  return (
    <article className="card">
      <div className="table-wrap">
        <table>
          <thead>{head}</thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </article>
  );
}
