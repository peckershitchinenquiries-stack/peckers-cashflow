"use client";

import * as React from "react";
import { useDeferredSync } from "@/components/weekly-report/NumberCell";

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
) {
  const seedRef = React.useRef(seed);
  seedRef.current = seed;
  const printsRef = React.useRef(prints);
  printsRef.current = prints;

  const [state, setState] = React.useState<S>(seed);
  const [baseline, setBaseline] = React.useState<Map<string, string>>(() =>
    prints(state),
  );

  /** Drafts and baseline move together — anything else is a phantom edit. */
  const commit = React.useCallback((next: S) => {
    setState(next);
    setBaseline(printsRef.current(next));
  }, []);

  const reset = React.useCallback(() => commit(seedRef.current()), [commit]);

  const changed = React.useMemo(() => {
    const now = printsRef.current(state);
    let n = 0;
    for (const [key, print] of now) if (baseline.get(key) !== print) n++;
    for (const key of baseline.keys()) if (!now.has(key)) n++;
    return n;
  }, [state, baseline]);

  const dirty = !readOnly && changed > 0;
  const sync = useDeferredSync(signature, reset, dirty);

  return { state, setState, commit, reset, changed, dirty, sync };
}
