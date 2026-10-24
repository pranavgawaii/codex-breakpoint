import { ConflictError } from "./errors";

interface LockState {
  operation: string | null;
  startedAt: number | null;
}

const globalLock = globalThis as typeof globalThis & {
  __breakpointOperationLock?: LockState;
};

const state: LockState =
  globalLock.__breakpointOperationLock ?? (globalLock.__breakpointOperationLock = {
    operation: null,
    startedAt: null
  });

/**
 * Serializes mutating investigation operations in this server process.
 *
 * The demo is intentionally single-tenant and local, so a queue is unnecessary:
 * a second concurrent action receives a clear 409 instead of corrupting the
 * read-modify-write JSON store or starting overlapping test runs.
 */
export async function runExclusive<T>(operation: string, work: () => Promise<T>): Promise<T> {
  if (state.operation) {
    throw new ConflictError(
      `Another investigation action (${state.operation}) is still running. Wait for it to finish before starting ${operation}.`
    );
  }

  state.operation = operation;
  state.startedAt = Date.now();

  try {
    return await work();
  } finally {
    state.operation = null;
    state.startedAt = null;
  }
}

export function currentOperation(): string | null {
  return state.operation;
}
