// Pyodide worker: runs Python off the main thread so input() can block
// (Atomics.wait) while the page collects the user's typed input inline.

const PYODIDE_VERSION = "0.26.4";
const PYODIDE_CDN = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

let pyodide = null;
let meta = null; // Int32Array — [0]=signal, [1]=length (-1 = cancel/EOF)
let data = null; // Uint8Array — the input bytes written by the main thread

// input() bridge: ask the page for a line, then block until it answers.
function workerInput(prompt) {
  postMessage({ type: "input", prompt: String(prompt ?? "") });
  Atomics.store(meta, 0, 0);
  Atomics.wait(meta, 0, 0); // sleeps this worker thread until the page notifies
  const len = Atomics.load(meta, 1);
  if (len < 0) return null; // user cancelled / EOF
  return new TextDecoder().decode(data.slice(0, len));
}

async function init(metaBuf, dataBuf) {
  meta = new Int32Array(metaBuf);
  data = new Uint8Array(dataBuf);
  importScripts(`${PYODIDE_CDN}pyodide.js`);
  pyodide = await self.loadPyodide({ indexURL: PYODIDE_CDN });
  pyodide.globals.set("_worker_input", workerInput);
  await pyodide.runPythonAsync(`
import builtins as _b
def _input(prompt=""):
    _r = _worker_input(str(prompt))
    if _r is None:
        raise EOFError("input was cancelled")
    return str(_r)
_b.input = _input
del _input
`);
  postMessage({ type: "ready" });
}

async function run(code) {
  pyodide.setStdout({ batched: (s) => postMessage({ type: "stdout", text: s + "\n" }) });
  pyodide.setStderr({ batched: (s) => postMessage({ type: "stderr", text: s + "\n" }) });
  try {
    await pyodide.runPythonAsync(code);
    postMessage({ type: "done" });
  } catch (e) {
    postMessage({ type: "error", text: String(e && e.message ? e.message : e) });
  } finally {
    pyodide.setStdout({});
    pyodide.setStderr({});
  }
}

onmessage = (e) => {
  const m = e.data;
  if (m.type === "init") init(m.meta, m.data);
  else if (m.type === "run") run(m.code);
};
