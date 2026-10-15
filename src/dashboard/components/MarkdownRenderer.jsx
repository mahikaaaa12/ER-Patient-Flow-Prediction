import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Robust, sanitized Markdown renderer styled for ERFlow's clinical design system.
 * Renders HTML/React elements natively without dangerouslySetInnerHTML.
 */
export default function MarkdownRenderer({ content, className = "" }) {
  if (!content || typeof content !== "string") {
    return null;
  }

  return (
    <div className={`prose-clinical ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: (props) => (
            <h1 className="mt-3.5 mb-2 text-[15px] font-bold tracking-tight text-navy" {...props} />
          ),
          h2: (props) => (
            <h2 className="mt-3 mb-1.5 text-[14px] font-bold tracking-tight text-navy" {...props} />
          ),
          h3: (props) => (
            <h3 className="mt-2.5 mb-1 text-[13px] font-semibold text-navy" {...props} />
          ),
          h4: (props) => (
            <h4 className="mt-2 mb-1 text-[12.5px] font-semibold text-navy-muted uppercase tracking-wider" {...props} />
          ),
          p: (props) => (
            <p className="mb-2 text-[13px] leading-relaxed text-navy-muted last:mb-0" {...props} />
          ),
          strong: (props) => (
            <strong className="font-semibold text-navy" {...props} />
          ),
          em: (props) => (
            <em className="italic text-navy-muted" {...props} />
          ),
          ul: (props) => (
            <ul className="my-2 ml-4 list-disc space-y-1 text-[13px] text-navy-muted" {...props} />
          ),
          ol: (props) => (
            <ol className="my-2 ml-4 list-decimal space-y-1 text-[13px] text-navy-muted" {...props} />
          ),
          li: (props) => (
            <li className="leading-relaxed text-[13px]" {...props} />
          ),
          code: (props) => (
            <code
              className="rounded border border-border bg-bg px-1.5 py-0.5 font-mono text-[11.5px] font-semibold text-navy"
              {...props}
            />
          ),
          pre: (props) => (
            <pre className="my-2.5 overflow-x-auto rounded-md border border-border bg-bg p-3 font-mono text-[12px] text-navy" {...props} />
          ),
          blockquote: (props) => (
            <blockquote
              className="my-2.5 rounded-r-md border-l-2 border-blue bg-blue-tint/50 px-3 py-2 text-[12.5px] text-navy italic"
              {...props}
            />
          ),
          table: (props) => (
            <div className="my-3 overflow-x-auto rounded-lg border border-border shadow-soft">
              <table className="w-full text-left text-xs border-collapse" {...props} />
            </div>
          ),
          thead: (props) => (
            <thead className="border-b border-border bg-bg text-navy font-semibold" {...props} />
          ),
          tbody: (props) => (
            <tbody className="divide-y divide-border bg-surface text-navy-muted" {...props} />
          ),
          tr: (props) => (
            <tr className="transition-colors hover:bg-bg/50" {...props} />
          ),
          th: (props) => (
            <th className="px-3 py-2 font-semibold text-navy" {...props} />
          ),
          td: (props) => (
            <td className="px-3 py-2" {...props} />
          ),
          hr: (props) => (
            <hr className="my-3 border-border" {...props} />
          ),
          a: (props) => (
            <a className="font-medium text-blue underline hover:text-blue-dark" target="_blank" rel="noopener noreferrer" {...props} />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
