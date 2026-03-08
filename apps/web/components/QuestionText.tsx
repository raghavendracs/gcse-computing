import React from "react";

/**
 * Renders AI-generated question text with:
 * - ```python / ```pseudocode code blocks styled as formatted panels
 * - (a) (b) (c) sub-questions visually separated
 * - [N marks] labels styled as badges
 * - Inline `code` with monospace styling
 */
export function QuestionText({ text }: { text: string }) {
  const segments = parseQuestionText(text);

  return (
    <div className="space-y-3 leading-relaxed">
      {segments.map((seg, i) => {
        if (seg.type === "code") {
          return (
            <pre
              key={i}
              className="bg-slate-800 text-slate-100 rounded-lg px-4 py-3 text-sm font-mono overflow-x-auto whitespace-pre-wrap"
            >
              {seg.lang && (
                <span className="block text-xs text-slate-400 mb-2 font-sans uppercase tracking-wide">
                  {seg.lang === "pseudocode" ? "Pseudocode" : "Python"}
                </span>
              )}
              {seg.content}
            </pre>
          );
        }

        if (seg.type === "part") {
          return (
            <div key={i} className="flex gap-3 items-start">
              <span className="font-bold text-slate-700 shrink-0 text-sm">({seg.label})</span>
              <span className="text-slate-800 text-sm flex-1">
                <InlineText text={seg.content} />
                {seg.marks && (
                  <span className="ml-2 text-xs font-semibold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                    {seg.marks} {seg.marks === 1 ? "mark" : "marks"}
                  </span>
                )}
              </span>
            </div>
          );
        }

        // plain paragraph
        return seg.content.trim() ? (
          <p key={i} className="text-slate-800 text-sm">
            <InlineText text={seg.content} />
          </p>
        ) : null;
      })}
    </div>
  );
}

/** Render inline: strip [N marks] labels and style `backtick` code */
function InlineText({ text }: { text: string }) {
  // Remove trailing [N marks] — already shown as badge
  const cleaned = text.replace(/\[\d+\s*marks?\]/gi, "").trim();

  // Split on `inline code`
  const parts = cleaned.split(/(`[^`]+`)/g);

  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("`") && p.endsWith("`") ? (
          <code
            key={i}
            className="bg-slate-100 text-slate-800 font-mono text-xs px-1.5 py-0.5 rounded"
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

type Segment =
  | { type: "code"; content: string; lang?: string }
  | { type: "part"; label: string; content: string; marks?: number }
  | { type: "text"; content: string };

function parseQuestionText(text: string): Segment[] {
  const segments: Segment[] = [];

  // Split by fenced code blocks first
  const codeBlockRe = /```(\w*)\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = codeBlockRe.exec(text)) !== null) {
    // Text before the code block
    if (match.index > lastIndex) {
      segments.push(...parseTextSegments(text.slice(lastIndex, match.index)));
    }
    segments.push({ type: "code", content: match[2].trim(), lang: match[1] || undefined });
    lastIndex = match.index + match[0].length;
  }

  // Remaining text after last code block
  if (lastIndex < text.length) {
    segments.push(...parseTextSegments(text.slice(lastIndex)));
  }

  return segments;
}

function parseTextSegments(text: string): Segment[] {
  const lines = text.split("\n");
  const segments: Segment[] = [];
  let pendingText: string[] = [];

  const flushText = () => {
    const joined = pendingText.join(" ").trim();
    if (joined) segments.push({ type: "text", content: joined });
    pendingText = [];
  };

  for (const line of lines) {
    // Match (a), (b), (c) ... (z) sub-questions
    const partMatch = line.match(/^\s*\(([a-z])\)\s*(.*)/i);
    if (partMatch) {
      flushText();
      const content = partMatch[2];
      const marksMatch = content.match(/\[(\d+)\s*marks?\]/i);
      segments.push({
        type: "part",
        label: partMatch[1].toLowerCase(),
        content,
        marks: marksMatch ? parseInt(marksMatch[1], 10) : undefined,
      });
    } else {
      pendingText.push(line);
    }
  }

  flushText();
  return segments;
}
