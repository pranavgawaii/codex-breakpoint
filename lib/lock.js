import { ConflictError } from "./errors.js";

/**
 * Serializes mutating investigation operations in this server process.
 *
 * Breakpoint is intentionally single-tenant and local, so a queue is
 * unnecessary: a second concurrent action receives a clear 409 instead of
 * corrupting the read-modify-write JSON store or starting overlapping test
 * runs.
 */

/** @typedef {{ operation: string | null, startedAt: number | null }} LockState */

const globalLock = /** @type {typeof globalThis & { __breakpointOperationLock?: LockState }} */ (globalThis);

/** @type {LockState} */
const state = globalLock.__breakpointOperationLock ?? (globalLock.__breakpointOperationLock = {
  operation: null,
  startedAt: null,
});

/**
 * @template T
 * @param {string} operation
 * @param {() => Promise<T>} work
 * @returns {Promise<T>}
 */
export async function runExclusive(operation, work) {
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

/** @returns {string | null} */
export function currentOperation() {
  return state.operation;
}
