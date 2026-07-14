/**
 * In-browser Python execution via Pyodide (CPython compiled to WebAssembly).
 * Runs entirely on the user's device — no server sandbox involved. Used for the
 * interactive "Run in browser" playground where `input()` prompts the user and
 * `print()` output streams back live.
 */

// Pin a known-good Pyodide release served from jsDelivr.
const PYODIDE_VERSION = "0.26.4";
const PYODIDE_CDN = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Pyodide = any;

declare global {
  interface Window {
    loadPyodide?: (opts: { indexURL: string }) => Promise<Pyodide>;
  }
}

let pyodidePromise: Promise<Pyodide> | null = null;

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector("script[data-pyodide]")) return resolve();
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.dataset.pyodide = "1";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Could not download the Python runtime (check your connection)."));
    document.head.appendChild(s);
  });
}

/** Load Pyodide once (cached across runs) and wire interactive input(). */
export async function loadPyodideOnce(): Promise<Pyodide> {
  if (pyodidePromise) return pyodidePromise;
  pyodidePromise = (async () => {
    await loadScript(`${PYODIDE_CDN}pyodide.js`);
    if (!window.loadPyodide) throw new Error("Python runtime failed to initialise.");
    const py = await window.loadPyodide({ indexURL: PYODIDE_CDN });

    // Route Python's input() to a browser prompt so students can enter data live.
    py.globals.set("_js_prompt", (prompt: string) => window.prompt(prompt || "") ?? null);
    await py.runPythonAsync(`
import builtins as _b
def _input(prompt=""):
    _r = _js_prompt(str(prompt))
    if _r is None:
        raise EOFError("input was cancelled")
    return str(_r)
_b.input = _input
del _input
`);
    return py;
  })();
  return pyodidePromise;
}

/** True if the runtime has already been downloaded (so the UI can skip the "loading" label). */
export function isPyodideLoaded(): boolean {
  return pyodidePromise !== null;
}

/**
 * Run `code` in the browser. `onOutput` receives stdout/stderr chunks as they
 * are produced. Throws with a readable message on a Python error.
 */
export async function runPythonInBrowser(code: string, onOutput: (chunk: string) => void): Promise<void> {
  const py = await loadPyodideOnce();
  py.setStdout({ batched: (s: string) => onOutput(s + "\n") });
  py.setStderr({ batched: (s: string) => onOutput(s + "\n") });
  try {
    await py.runPythonAsync(code);
  } finally {
    // Restore defaults so a later run starts clean.
    py.setStdout({});
    py.setStderr({});
  }
}
