/**
 * Main-thread controller for the in-browser Python runtime (Pyodide running in
 * a Web Worker). Output streams back via callbacks; when the program calls
 * input(), the worker blocks on Atomics.wait and we surface the request to the
 * UI, then unblock it with the user's typed value via provideInput().
 *
 * Requires cross-origin isolation (SharedArrayBuffer) — see the COOP/COEP
 * headers in next.config.ts.
 */

let worker: Worker | null = null;
let readyPromise: Promise<void> | null = null;
let ready = false;

let meta: Int32Array | null = null; // [0]=signal, [1]=length (-1 = cancel/EOF)
let dataView: Uint8Array | null = null;

let onOutput: ((chunk: string) => void) | null = null;
let onInputRequest: ((prompt: string) => void) | null = null;
let runResolve: (() => void) | null = null;
let runReject: ((e: Error) => void) | null = null;

export function isPyodideReady(): boolean {
  return ready;
}

/** Spawn the worker and load Pyodide (once). Resolves when Python is ready. */
export function initPyodideWorker(): Promise<void> {
  if (readyPromise) return readyPromise;
  readyPromise = new Promise<void>((resolve, reject) => {
    try {
      if (typeof SharedArrayBuffer === "undefined" || !self.crossOriginIsolated) {
        throw new Error("This browser blocked shared memory needed to run Python here.");
      }
      const metaSab = new SharedArrayBuffer(8);
      const dataSab = new SharedArrayBuffer(64 * 1024);
      meta = new Int32Array(metaSab);
      dataView = new Uint8Array(dataSab);

      worker = new Worker("/pyodide-worker.js");
      worker.onerror = () => reject(new Error("The Python runtime failed to start."));
      worker.onmessage = (e: MessageEvent) => {
        const m = e.data;
        switch (m.type) {
          case "ready":
            ready = true;
            resolve();
            break;
          case "stdout":
          case "stderr":
            onOutput?.(m.text);
            break;
          case "input":
            onInputRequest?.(m.prompt);
            break;
          case "done": {
            const r = runResolve;
            runResolve = runReject = null;
            r?.();
            break;
          }
          case "error": {
            const j = runReject;
            runResolve = runReject = null;
            j?.(new Error(m.text));
            break;
          }
        }
      };
      worker.postMessage({ type: "init", meta: metaSab, data: dataSab });
    } catch (err) {
      readyPromise = null;
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });
  return readyPromise;
}

/** Run code in the worker. `onInputRequest` fires when the program awaits input(). */
export function runInBrowser(
  code: string,
  handlers: { onOutput: (chunk: string) => void; onInputRequest: (prompt: string) => void },
): Promise<void> {
  if (!worker) return Promise.reject(new Error("Python runtime not initialised."));
  onOutput = handlers.onOutput;
  onInputRequest = handlers.onInputRequest;
  return new Promise<void>((resolve, reject) => {
    runResolve = resolve;
    runReject = reject;
    worker!.postMessage({ type: "run", code });
  });
}

/** Unblock a pending input() with the user's value, or `null` to signal EOF/cancel. */
export function provideInput(value: string | null): void {
  if (!meta || !dataView) return;
  if (value === null) {
    Atomics.store(meta, 1, -1);
  } else {
    const bytes = new TextEncoder().encode(value);
    const len = Math.min(bytes.length, dataView.length);
    dataView.set(bytes.subarray(0, len));
    Atomics.store(meta, 1, len);
  }
  Atomics.store(meta, 0, 1);
  Atomics.notify(meta, 0);
}
