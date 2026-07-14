"use client";
import "@xterm/xterm/css/xterm.css";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

export interface TerminalHandle {
  write: (s: string) => void;
  writeln: (s: string) => void;
  clear: () => void;
  focus: () => void;
  /** Begin reading one line from the terminal; the typed line is delivered via onLine. */
  readLine: () => void;
}

interface Props {
  /** Called with the finished line (no trailing newline) when the user presses Enter during readLine. */
  onLine: (line: string) => void;
}

/**
 * A real terminal (xterm.js) for the in-browser Python runner. Output is written
 * with write(); when the program needs input, the parent calls readLine() and the
 * user types directly in the terminal — backspace, cursor, and scrollback all work.
 */
export const BrowserTerminal = forwardRef<TerminalHandle, Props>(function BrowserTerminal({ onLine }, ref) {
  const elRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const termRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fitRef = useRef<any>(null);
  const readingRef = useRef(false);
  const lineRef = useRef("");
  const onLineRef = useRef(onLine);
  onLineRef.current = onLine;

  useEffect(() => {
    let disposed = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let term: any = null;
    let onResize: (() => void) | null = null;

    (async () => {
      const [{ Terminal }, { FitAddon }] = await Promise.all([
        import("@xterm/xterm"),
        import("@xterm/addon-fit"),
      ]);
      if (disposed || !elRef.current) return;

      term = new Terminal({
        convertEol: true, // "\n" from Python → newline in the terminal
        cursorBlink: true,
        fontSize: 13,
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
        theme: { background: "#0f172a", foreground: "#e2e8f0", cursor: "#34d399" },
      });
      const fit = new FitAddon();
      term.loadAddon(fit);
      term.open(elRef.current);
      fit.fit();
      termRef.current = term;
      fitRef.current = fit;

      term.writeln("\x1b[2mPython console — press Run to execute your code.\x1b[0m");

      term.onData((data: string) => {
        if (!readingRef.current) return; // ignore keystrokes unless we're reading input()
        for (const ch of data) {
          if (ch === "\r") {
            const line = lineRef.current;
            lineRef.current = "";
            readingRef.current = false;
            term.write("\r\n");
            onLineRef.current(line);
          } else if (ch === "\x7f") {
            // Backspace
            if (lineRef.current.length > 0) {
              lineRef.current = lineRef.current.slice(0, -1);
              term.write("\b \b");
            }
          } else if (ch >= " ") {
            lineRef.current += ch;
            term.write(ch);
          }
        }
      });

      onResize = () => { try { fit.fit(); } catch { /* ignore */ } };
      window.addEventListener("resize", onResize);
    })();

    return () => {
      disposed = true;
      if (onResize) window.removeEventListener("resize", onResize);
      termRef.current = null;
      fitRef.current = null;
      if (term) term.dispose();
    };
  }, []);

  useImperativeHandle(ref, () => ({
    write: (s: string) => termRef.current?.write(s),
    writeln: (s: string) => termRef.current?.writeln(s),
    clear: () => termRef.current?.clear(),
    focus: () => termRef.current?.focus(),
    readLine: () => {
      readingRef.current = true;
      lineRef.current = "";
      termRef.current?.focus();
    },
  }), []);

  return <div ref={elRef} className="w-full" style={{ height: 260, padding: 8, backgroundColor: "#0f172a" }} />;
});

export default BrowserTerminal;
