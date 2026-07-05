import { useState } from "react";
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

type Block = { kind: "text"; content: string } | { kind: "code"; lang: string; content: string };

function parseBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  const fenceRegex = /```(\w*)\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = fenceRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      blocks.push({ kind: "text", content: text.slice(lastIndex, match.index) });
    }
    blocks.push({ kind: "code", lang: match[1] || "plaintext", content: match[2].replace(/\n$/, "") });
    lastIndex = fenceRegex.lastIndex;
  }
  if (lastIndex < text.length) {
    blocks.push({ kind: "text", content: text.slice(lastIndex) });
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

function CodeBlock({ lang, content }: { lang: string; content: string }) {
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
        <span className="code-block-lang">{language}</span>
        <button type="button" className="code-block-copy" onClick={handleCopy}>
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre>
        <code className="hljs" dangerouslySetInnerHTML={{ __html: html }} />
      </pre>
    </div>
  );
}

/** Renders streamed hint text, splitting fenced ```lang code blocks into syntax-highlighted, copyable editor-style blocks and leaving the rest as plain prose. */
export function HintRenderer({ text }: { text: string }) {
  const blocks = parseBlocks(text);
  return (
    <div className="hint-text">
      {blocks.map((block, i) =>
        block.kind === "code" ? (
          <CodeBlock key={i} lang={block.lang} content={block.content} />
        ) : (
          block.content.trim() && <p key={i}>{block.content.trim()}</p>
        )
      )}
    </div>
  );
}
