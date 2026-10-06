"use client";

import * as React from "react";
import { useDeferredSync } from "@/components/weekly-report/NumberCell";

const STASH_PREFIX = "weekly-report-draft:";

type Stash<S> = { sig: string; state: S };

/**
 * Unsaved typing survives leaving the sheet.
 *
 * A sheet is twenty rows of invoices typed off paper, and until Save it lived
 * only in React state — so the tab strip (buttons, not links, so the unload
 * guard never saw them), the week picker, a stray back or a closed laptop threw
 * the lot away. The drafts are mirrored to localStorage and restored on the way
 * back in.
 *
 * The stash carries the SIGNATURE it was typed against and is discarded when
 * that no longer matches: the rows underneath have moved since (someone else
 * saved, a prefill ran), and replaying old drafts over them would resurrect
 * figures the server has already superseded.
 */
function readStash<S>(key: string | undefined, sig: string): S | undefined {
  if (!key || typeof window === "undefined") return undefined;
  try {
    const raw = window.localStorage.getItem(STASH_PREFIX + key);
    if (!raw) return undefined;
    const held = JSON.parse(raw) as Stash<S>;
    if (held?.sig !== sig) {
      window.localStorage.removeItem(STASH_PREFIX + key);
      return undefined;
    }
    return held.state;
  } catch {
    return undefined;
  }
}

/** Whether the drafts are now recoverable — a blocked or full store is not. */
function writeStash<S>(key: string | undefined, sig: string, state: S): boolean {
  if (!key || typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(
      STASH_PREFIX + key,
      JSON.stringify({ sig, state } satisfies Stash<S>),
    );
    return true;
  } catch {
    // A full or blocked store costs the safety net, not the sheet.
    return false;
  }
}

function clearStash(key: string | undefined) {
  if (!key || typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STASH_PREFIX + key);
  } catch {
    // ignore
  }
}

/**
 * A row key no row in the sheet is already using.
 *
 * Restored drafts bring their own `new-N` keys back with them, so a counter
 * that starts at zero on every mount would hand the next added row a key a
 * restored one already holds — two rows with one React identity, edited as one.
 */
export function freshKey(existing: Iterable<string>): string {
  const taken = new Set(existing);
  let n = taken.size + 1;
  while (taken.has(`new-${n}`)) n++;
  return `new-${n}`;
}

/**
 * Draft state for a sheet that saves in one go.
 *
 * "Has this changed" is measured against the BASELINE the drafts were seeded
 * from, never against whatever the server last sent. The difference matters:
 * a refresh landing on a clean sheet would otherwise make every row read as
 * edited the instant the new rows arrived, and a sheet that believes it is
 * dirty refuses to take the update it is being handed.
 */
export function useSheetDrafts<S>(
  signature: string,
  seed: () => S,
  /** One print per row, keyed by row: what the row would be stored as. */
  prints: (state: S) => Map<string, string>,
  readOnly = false,
  /** Stable per sheet (report + section). Omit and nothing is kept. */
  storageKey?: string,
) {
  const seedRef = React.useRef(seed);
  seedRef.current = seed;
  const printsRef = React.useRef(prints);
  printsRef.current = prints;
  const sigRef = React.useRef(signature);
  sigRef.current = signature;

  const [state, setState] = React.useState<S>(seed);
  const [baseline, setBaseline] = React.useState<Map<string, string>>(() =>
    prints(state),
  );

  /** Drafts and baseline move together — anything else is a phantom edit. */
  const commit = React.useCallback((next: S) => {
    setState(next);
    setBaseline(printsRef.current(next));
  }, []);

  // The stash can only be read once React is on the client, and the sync's
  // mount pass is the first thing to re-seed the sheet — so the restore rides
  // it rather than racing it in a second effect.
  //
  // Re-seeding ALWAYS prefers the stash, never just the first time. Strict Mode
  // mounts, runs every effect, tears down and runs them again, so a once-only
  // restore was undone by the second pass taking the plain-seed branch. It is
  // safe to replay because the stash only reads back under the signature it was
  // typed against: once the rows underneath move, there is nothing to prefer.
  const reseed = React.useCallback(() => {
    const held = readOnly ? undefined : readStash<S>(storageKey, sigRef.current);
    if (held !== undefined) {
      setState(held);
      setBaseline(printsRef.current(seedRef.current()));
      return;
    }
    commit(seedRef.current());
  }, [commit, readOnly, storageKey]);

  const reset = React.useCallback(() => {
    clearStash(storageKey);
    commit(seedRef.current());
  }, [commit, storageKey]);

  const changed = React.useMemo(() => {
    const now = printsRef.current(state);
    let n = 0;
    for (const [key, print] of now) if (baseline.get(key) !== print) n++;
    for (const key of baseline.keys()) if (!now.has(key)) n++;
    return n;
  }, [state, baseline]);

  const dirty = !readOnly && changed > 0;
  const sync = useDeferredSync(signature, reseed, dirty);

  // Clearing is for a sheet that WAS dirty and has just been saved — never for
  // the clean pass every mount starts with, which in Strict Mode ran before the
  // restore got its second chance and deleted the very drafts it was holding.
  const [kept, setKept] = React.useState(false);
  const everDirty = React.useRef(false);
  React.useEffect(() => {
    if (dirty) {
      everDirty.current = true;
      setKept(writeStash(storageKey, signature, state));
      return;
    }
    if (!everDirty.current) return;
    everDirty.current = false;
    clearStash(storageKey);
  }, [dirty, state, signature, storageKey]);

  return { state, setState, commit, reset, changed, dirty, kept, sync };
}

/**
 * The same safety net for a plain form that saves with one button — the
 * summary's typed-in figures. No row prints to diff, so "dirty" is simply
 * whether the fields still read as the server sent them.
 */
export function useStashedForm<S extends object>(
  storageKey: string | undefined,
  signature: string,
  seed: () => S,
  readOnly = false,
) {
  const seedRef = React.useRef(seed);
  seedRef.current = seed;

  const [form, setForm] = React.useState<S>(seed);
  const [baseline, setBaseline] = React.useState<string>(() => JSON.stringify(form));

  // Server figures win when they move underneath us, but never over typing
  // nobody has saved yet. Re-reading the stash each pass is what survives
  // Strict Mode's second mount.
  const dirtyRef = React.useRef(false);
  React.useEffect(() => {
    if (dirtyRef.current) return;
    const held = readOnly ? undefined : readStash<S>(storageKey, signature);
    const fresh = seedRef.current();
    setForm(held ?? fresh);
    setBaseline(JSON.stringify(fresh));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  const dirty = !readOnly && JSON.stringify(form) !== baseline;
  dirtyRef.current = dirty;

  const [kept, setKept] = React.useState(false);
  const everDirty = React.useRef(false);
  React.useEffect(() => {
    if (dirty) {
      everDirty.current = true;
      setKept(writeStash(storageKey, signature, form));
      return;
    }
    if (!everDirty.current) return;
    everDirty.current = false;
    clearStash(storageKey);
  }, [dirty, form, signature, storageKey]);

  const saved = React.useCallback(() => {
    clearStash(storageKey);
    setBaseline(JSON.stringify(form));
  }, [form, storageKey]);

  return { form, setForm, dirty, kept, saved };
}
