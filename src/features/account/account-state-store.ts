import { create } from "zustand";
import { parseAccountState } from "@/domain/account-state";

/**
 * What the header knows about the visitor (M5b-2b, ADR 0028). Not persisted: it is asked from /api/account/state after
 * the page loads (the pages themselves stay static and cacheable) and again when a session may have started or ended.
 * `unknown` is the state before the first answer and after a failed one; the header then shows a plain link to /account,
 * which works for both a signed-in and a signed-out visitor.
 */
export type AccountStateStore = {
  status: "unknown" | "signed-out" | "signed-in";
  name: string;
  initial: string;
  /** Ask the server. Calls that overlap are merged, and one that arrives while another is in flight runs after it. */
  refresh: () => Promise<void>;
};

let running: Promise<void> | null = null;
let again = false;

export const useAccountStateStore = create<AccountStateStore>()((set) => ({
  status: "unknown",
  name: "",
  initial: "",
  refresh: () => {
    if (running) {
      again = true;
      return running;
    }
    running = (async () => {
      do {
        again = false;
        try {
          const res = await fetch("/api/account/state", {
            cache: "no-store",
            credentials: "same-origin",
          });
          const state = res.ok ? parseAccountState(await res.json()) : null;
          if (state === null) continue; // keep what is shown: a failed check says nothing about the session
          if (state.signedIn)
            set({ status: "signed-in", name: state.name, initial: state.initial });
          else set({ status: "signed-out", name: "", initial: "" });
        } catch {
          // offline or aborted: same as a failed check
        }
      } while (again);
    })().finally(() => {
      running = null;
    });
    return running;
  },
}));
