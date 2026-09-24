"use client";

import * as React from "react";

/**
 * The one numeric input every weekly-report sheet types into.
 *
 * It is a TEXT field, not `<input type="number">`. A number input reports an
 * empty string for every intermediate a decimal passes through — "12." on the
 * way to "12.5", "-" on the way to a credit — so a controlled grid saw the cell
 * emptied mid-keystroke and fought the typing. It also answers the mouse wheel
 * and the arrow keys, silently retyping money on a grid navigated by keyboard.
 * Filtering the characters ourselves keeps what the manager typed exactly as
 * they typed it.
 */
const NUMERIC = /^-?\d*\.?\d*$/;

/** What the manager meant, before it is judged: a comma decimal, a stray space. */
function normalise(raw: string, integer: boolean, allowNegative: boolean): string {
  let v = raw.replace(/\s|£|,/g, (m) => (m === "," ? "." : ""));
  if (integer) v = v.replace(/\./g, "");
  if (!allowNegative) v = v.replace(/-/g, "");
  return v;
}

/**
 * Focus a money field and its whole value is selected, so the first keystroke
 * replaces it instead of typing into the existing digits. The mouse-up guard is
 * load-bearing: the click that focused the field would otherwise collapse the
 * selection to a caret before the manager types.
 */
export function useSelectOnFocus() {
  const armed = React.useRef(false);
  return {
    onFocus: (e: React.FocusEvent<HTMLInputElement>) => {
      armed.current = true;
      e.currentTarget.select();
    },
    onMouseUp: (e: React.MouseEvent<HTMLInputElement>) => {
      if (!armed.current) return;
      armed.current = false;
      e.preventDefault();
    },
    onBlur: () => {
      armed.current = false;
    },
  };
}

export function NumberCell({
  value,
  onValueChange,
  onCommit,
  integer = false,
  allowNegative = false,
  className,
  ...props
}: Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "onChange" | "value" | "type" | "step" | "min" | "max"
> & {
  value: string;
  onValueChange: (value: string) => void;
  onCommit?: () => void;
  /** Whole numbers only — delivery counts have no decimal half. */
  integer?: boolean;
  allowNegative?: boolean;
}) {
  const select = useSelectOnFocus();

  return (
    <input
      {...props}
      type="text"
      inputMode={integer ? "numeric" : "decimal"}
      autoComplete="off"
      className={className}
      value={value}
      onFocus={(e) => {
        select.onFocus(e);
        props.onFocus?.(e);
      }}
      onMouseUp={(e) => {
        select.onMouseUp(e);
        props.onMouseUp?.(e);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        props.onKeyDown?.(e);
      }}
      onChange={(e) => {
        const next = normalise(e.target.value, integer, allowNegative);
        // A rejected keystroke leaves the cell exactly as it was rather than
        // blanking it, which is what a number input did with "12e".
        if (next === "" || NUMERIC.test(next)) onValueChange(next);
      }}
      onBlur={(e) => {
        select.onBlur();
        onCommit?.();
        props.onBlur?.(e);
      }}
    />
  );
}

function holdsFocus(el: HTMLElement | null): boolean {
  return !!el && typeof document !== "undefined" && el.contains(document.activeElement);
}

/**
 * Server data wins — but never over unsaved typing.
 *
 * The grids batch their writes now, so between the first keystroke and Save the
 * drafts are the only copy of what the manager has entered. A refresh landing in
 * that window (another tab's save, a prefill, a revalidate) must not re-seed
 * them. `blocked` holds the update until the sheet is clean and unfocused.
 */
export function useDeferredSync(signature: string, apply: () => void, blocked = false) {
  const ref = React.useRef<HTMLDivElement>(null);
  const applyRef = React.useRef(apply);
  applyRef.current = apply;
  const blockedRef = React.useRef(blocked);
  blockedRef.current = blocked;
  const pending = React.useRef(false);

  React.useEffect(() => {
    if (blockedRef.current || holdsFocus(ref.current)) {
      pending.current = true;
      return;
    }
    applyRef.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  // Focus moving between two cells fires blur before the next focus lands, so
  // the check has to wait a tick to know whether the grid was really left.
  const onBlurCapture = React.useCallback(() => {
    window.setTimeout(() => {
      if (!pending.current || blockedRef.current || holdsFocus(ref.current)) return;
      pending.current = false;
      applyRef.current();
    }, 0);
  }, []);

  return { ref, onBlurCapture };
}
