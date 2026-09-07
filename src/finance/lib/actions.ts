// Running mutations, and the automatic upkeep the FastAPI app did per request.
//
// The Python had an HTTP middleware that, on every GET, backfilled due payroll
// and earmarked any paycheck that had landed but was not yet planned. There is
// no server here to hook into, so the equivalent runs once after the dataset
// first loads - see useAutoSync. Both operations are idempotent, which is what
// made the middleware safe on every page view and makes this safe on remount.

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { FINANCE_QUERY_KEY, useFinanceData, type FinanceData } from "./data";
import { syncAllocations } from "./allocation";
import {
  backfillScheduledPaychecks,
  recordRetirementContribution,
  updateRetirementContribution,
} from "./paychecks";

/** What a page gets back for driving a form: a runner plus its state. */
export interface ActionRunner {
  run: (action: (data: FinanceData) => Promise<string | void>) => Promise<void>;
  busy: boolean;
  message: string | null;
  error: string | null;
  clear: () => void;
}

/**
 * Run a mutation against the loaded dataset, then refetch.
 *
 * The action receives the current snapshot and may mutate it in place as it
 * writes - the ported services rely on that to mirror SQLAlchemy's session
 * semantics. The refetch afterwards is what makes the UI authoritative again.
 */
export function useAction(): ActionRunner {
  const client = useQueryClient();
  const { data } = useFinanceData();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (action: (data: FinanceData) => Promise<string | void>) => {
      if (!data || busy) return;
      setBusy(true);
      setError(null);
      setMessage(null);
      try {
        const result = await action(data);
        if (typeof result === "string") setMessage(result);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : String(caught));
      } finally {
        // Refetch even on failure: a multi-step action can fail partway, and
        // showing stale rows next to an error is worse than showing the truth.
        await client.invalidateQueries({ queryKey: FINANCE_QUERY_KEY });
        setBusy(false);
      }
    },
    [client, data, busy],
  );

  const clear = useCallback(() => {
    setMessage(null);
    setError(null);
  }, []);

  return { run, busy, message, error, clear };
}

/**
 * Backfill due payroll and plan any unplanned paycheck, once per mount.
 *
 * Runs only after the dataset has loaded, and only when there is something to
 * do, so the common case costs nothing beyond the checks themselves.
 */
export function useAutoSync(): { syncing: boolean; syncError: string | null } {
  const client = useQueryClient();
  const { data } = useFinanceData();
  const started = useRef(false);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  useEffect(() => {
    if (!data || started.current) return;
    started.current = true;

    let cancelled = false;
    void (async () => {
      setSyncing(true);
      try {
        const settings = data.settings;
        let changed = false;

        const payroll = await backfillScheduledPaychecks(data, settings);
        if (payroll.changed) {
          for (const paycheck of payroll.created) {
            await recordRetirementContribution(data, paycheck);
          }
          for (const paycheck of payroll.updated) {
            await updateRetirementContribution(data, paycheck);
          }
          changed = true;
        }

        const allocations = await syncAllocations(data, settings);
        if (allocations.changed) changed = true;

        if (changed && !cancelled) {
          await client.invalidateQueries({ queryKey: FINANCE_QUERY_KEY });
        }
      } catch (caught) {
        if (!cancelled) {
          setSyncError(caught instanceof Error ? caught.message : String(caught));
        }
      } finally {
        if (!cancelled) setSyncing(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [data, client]);

  return { syncing, syncError };
}
