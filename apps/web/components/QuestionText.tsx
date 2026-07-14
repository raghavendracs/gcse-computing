import React from "react";

/**
 * Renders AI-generated coding-question text, preserving the markdown-ish
 * structure the model produces:
 * - ```python / ```pseudocode fenced code blocks → styled panels
 * - blank-line-separated paragraphs
 * - `1.` / `2.` numbered steps → ordered list
 * - `- ` / `* ` bullets → unordered list
 * - "Example:" / "Input:" / "Output:" blocks → monospace panel
 * - inline `code` → monospace chips
 * - all internal newlines preserved (never collapsed to a wall of text)
 */
export function QuestionText({ text }: { text: string }) {
  const parts = splitFencedCode(text);

  return (
    <div className="space-y-2.5 text-sm leading-relaxed" style={{ color: "var(--foreground)" }}>
      {parts.flatMap((part, i) =>
        part.type === "code"
          ? [<CodePanel key={`c${i}`} content={part.content} lang={part.lang} />]
          : renderTextBlocks(part.content, `t${i}`),
      )}
    </div>
  );
}

// ─── Fenced code extraction ──────────────────────────────────────────────────

type Part = { type: "code"; content: string; lang?: string } | { type: "text"; content: string };

function splitFencedCode(text: string): Part[] {
  const parts: Part[] = [];
  const re = /```(\w*)\n?([\s\S]*?)```/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push({ type: "text", content: text.slice(last, m.index) });
    parts.push({ type: "code", content: m[2].replace(/\s+$/, ""), lang: m[1] || undefined });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ type: "text", content: text.slice(last) });
  return parts;
}

// ─── Block-level rendering of a text span ────────────────────────────────────

function renderTextBlocks(text: string, keyBase: string): React.ReactElement[] {
  const blocks = text.split(/\n\s*\n/);
  const nodes: React.ReactElement[] = [];

  blocks.forEach((raw, bi) => {
    const block = raw.replace(/^\n+|\n+$/g, "");
    if (!block.trim()) return;
    const key = `${keyBase}-${bi}`;
    const lines = block.split("\n");
    const nonEmpty = lines.filter((l) => l.trim());

    // Ordered list — every line is "N. ..." or "N) ..."
    if (nonEmpty.length > 0 && nonEmpty.every((l) => /^\s*\d+[.)]\s+/.test(l))) {
      nodes.push(
        <ol key={key} className="list-decimal ml-5 space-y-1">
          {nonEmpty.map((l, i) => (
            <li key={i}>
              <InlineText text={l.replace(/^\s*\d+[.)]\s+/, "")} />
            </li>
          ))}
        </ol>,
      );
      return;
    }

    // Unordered list — every line is "- ..." or "* ..."
    if (nonEmpty.length > 0 && nonEmpty.every((l) => /^\s*[-*]\s+/.test(l))) {
      nodes.push(
        <ul key={key} className="list-disc ml-5 space-y-1">
          {nonEmpty.map((l, i) => (
            <li key={i}>
              <InlineText text={l.replace(/^\s*[-*]\s+/, "")} />
            </li>
          ))}
        </ul>,
      );
      return;
    }

    // Example / I-O block — monospace panel that preserves layout exactly
    if (/^\s*(example|sample|input|output)\b/i.test(lines[0]) || /^\s*(input|output)\s*:/im.test(block)) {
      nodes.push(
        <pre
          key={key}
          className="text-xs font-mono rounded-lg px-3 py-2.5 overflow-x-auto whitespace-pre-wrap"
          style={{ backgroundColor: "var(--muted)", border: "1px solid var(--border)", color: "var(--foreground)" }}
        >
          {block}
        </pre>,
      );
      return;
    }

    // Plain paragraph — preserve internal single newlines (e.g. "Output format:" lists)
    nodes.push(
      <p key={key} className="whitespace-pre-wrap">
        <InlineText text={block} />
      </p>,
    );
  });

  return nodes;
}

// ─── Code panel ──────────────────────────────────────────────────────────────

function CodePanel({ content, lang }: { content: string; lang?: string }) {
  return (
    <pre className="bg-slate-800 text-slate-100 rounded-lg px-4 py-3 text-sm font-mono overflow-x-auto whitespace-pre">
      {lang && (
        <span className="block text-xs text-slate-400 mb-2 font-sans uppercase tracking-wide">
          {lang === "pseudocode" ? "Pseudocode" : lang}
        </span>
      )}
      {content}
    </pre>
  );
}

// ─── Inline: style `backtick` code ───────────────────────────────────────────

function InlineText({ text }: { text: string }) {
  const parts = text.split(/(`[^`]+`)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("`") && p.endsWith("`") && p.length > 2 ? (
          <code
            key={i}
            className="font-mono text-xs px-1.5 py-0.5 rounded"
            style={{ backgroundColor: "var(--accent)", color: "var(--foreground)" }}
          >
            {p.slice(1, -1)}
          </code>
        ) : (
          <React.Fragment key={i}>{p}</React.Fragment>
        ),
      )}
    </>
  );
}
