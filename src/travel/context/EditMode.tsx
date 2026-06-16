// Cosmetic password gate for the Travel editor.
// See supabase/travel_setup.sql for the security note — this protects the UI,
// not the database.

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";

const STORAGE_KEY = "travel-edit-unlocked";
const PASSWORD =
  (import.meta.env.VITE_TRAVEL_PASSWORD as string | undefined) ?? "";

interface EditModeValue {
  unlocked: boolean;
  unlock: (attempt: string) => boolean;
  lock: () => void;
  // True when a password has been configured at build time.
  configured: boolean;
}

const EditModeContext = createContext<EditModeValue | null>(null);

export function EditModeProvider({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });

  const unlock = (attempt: string): boolean => {
    if (PASSWORD && attempt === PASSWORD) {
      setUnlocked(true);
      try {
        sessionStorage.setItem(STORAGE_KEY, "1");
      } catch {
        /* ignore */
      }
      return true;
    }
    return false;
  };

  const lock = () => {
    setUnlocked(false);
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  };

  const value = useMemo<EditModeValue>(
    () => ({ unlocked, unlock, lock, configured: Boolean(PASSWORD) }),
    [unlocked]
  );

  return (
    <EditModeContext.Provider value={value}>
      {children}
    </EditModeContext.Provider>
  );
}

export function useEditMode(): EditModeValue {
  const ctx = useContext(EditModeContext);
  if (!ctx)
    throw new Error("useEditMode must be used within an EditModeProvider");
  return ctx;
}
