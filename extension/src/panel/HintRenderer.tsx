import { useState } from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";
import hljs from "highlight.js/lib/core";
import bash from "highlight.js/lib/languages/bash";
import c from "highlight.js/lib/languages/c";
import cpp from "highlight.js/lib/languages/cpp";
import csharp from "highlight.js/lib/languages/csharp";
import go from "highlight.js/lib/languages/go";
import java from "highlight.js/lib/languages/java";
import javascript from "highlight.js/lib/languages/javascript";
import kotlin from "highlight.js/lib/languages/kotlin";
import php from "highlight.js/lib/languages/php";
import python from "highlight.js/lib/languages/python";
import ruby from "highlight.js/lib/languages/ruby";
import rust from "highlight.js/lib/languages/rust";
import scala from "highlight.js/lib/languages/scala";
import sql from "highlight.js/lib/languages/sql";
import swift from "highlight.js/lib/languages/swift";
import typescript from "highlight.js/lib/languages/typescript";

hljs.registerLanguage("bash", bash);
hljs.registerLanguage("c", c);
hljs.registerLanguage("cpp", cpp);
hljs.registerLanguage("csharp", csharp);
hljs.registerLanguage("go", go);
hljs.registerLanguage("java", java);
hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("kotlin", kotlin);
hljs.registerLanguage("php", php);
hljs.registerLanguage("python", python);
hljs.registerLanguage("ruby", ruby);
hljs.registerLanguage("rust", rust);
hljs.registerLanguage("scala", scala);
hljs.registerLanguage("sql", sql);
hljs.registerLanguage("swift", swift);
hljs.registerLanguage("typescript", typescript);

marked.setOptions({ breaks: true });

type Block =
  | { kind: "text"; content: string }
  | { kind: "code"; lang: string; content: string; streaming?: boolean };

const CLOSED_FENCE_RE = /```(\w*)\n([\s\S]*?)```/g;
// Matches a fence opener with no closing ``` anywhere after it — the tail end
// of a still-streaming response. `\w*\n?` allows for the language tag and
// newline still arriving one token at a time.
const OPEN_FENCE_RE = /```(\w*)\n?([\s\S]*)$/;

function parseBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = CLOSED_FENCE_RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      blocks.push({ kind: "text", content: text.slice(lastIndex, match.index) });
    }
    blocks.push({ kind: "code", lang: match[1] || "plaintext", content: match[2].replace(/\n$/, "") });
    lastIndex = CLOSED_FENCE_RE.lastIndex;
  }

  const remainder = text.slice(lastIndex);
  const openMatch = remainder.match(OPEN_FENCE_RE);
  if (openMatch) {
    const beforeFence = remainder.slice(0, openMatch.index);
    if (beforeFence) blocks.push({ kind: "text", content: beforeFence });
    blocks.push({ kind: "code", lang: openMatch[1] || "plaintext", content: openMatch[2], streaming: true });
  } else if (remainder) {
    blocks.push({ kind: "text", content: remainder });
  }

  return blocks;
}

function highlight(code: string, lang: string): { html: string; language: string } {
  if (hljs.getLanguage(lang)) {
    const result = hljs.highlight(code, { language: lang });
    return { html: result.value, language: lang };
  }
  const auto = hljs.highlightAuto(code);
  return { html: auto.value, language: auto.language ?? "plaintext" };
}

function CodeBlock({ lang, content, streaming }: { lang: string; content: string; streaming?: boolean }) {
  const [copied, setCopied] = useState(false);
  const { html, language } = highlight(content, lang);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div className="code-block">
      <div className="code-block-header">
        <span className="code-block-lang">{streaming ? `${language} …` : language}</span>
        {!streaming && (
          <button type="button" className="code-block-copy" onClick={handleCopy}>
            {copied ? "Copied" : "Copy"}
          </button>
        )}
      </div>
      <pre>
        <code className="hljs" dangerouslySetInnerHTML={{ __html: html }} />
      </pre>
    </div>
  );
}

function TextBlock({ content }: { content: string }) {
  if (!content.trim()) return null;
  const rawHtml = marked.parse(content, { async: false }) as string;
  const safeHtml = DOMPurify.sanitize(rawHtml);
  return <div className="hint-md" dangerouslySetInnerHTML={{ __html: safeHtml }} />;
}

/** Renders streamed hint text: fenced ```lang code blocks become syntax-highlighted, copyable editor-style blocks; everything else is parsed as markdown (headers, bold, lists, inline code) via marked + sanitized with DOMPurify. */
export function HintRenderer({ text }: { text: string }) {
  const blocks = parseBlocks(text);
  return (
    <div className="hint-text">
      {blocks.map((block, i) =>
        block.kind === "code" ? (
          <CodeBlock key={i} lang={block.lang} content={block.content} streaming={block.streaming} />
        ) : (
          <TextBlock key={i} content={block.content} />
        )
      )}
    </div>
  );
}
