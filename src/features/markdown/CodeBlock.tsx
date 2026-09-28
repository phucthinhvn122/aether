import { memo, useMemo } from 'react';
import { CopyButton } from '../../components/CopyButton';
import { cn } from '../../lib/cn';
import { highlightCode } from './highlight';

interface CodeBlockProps {
  code: string;
  language?: string;
  className?: string;
  showHeader?: boolean;
}

export const HighlightedCode = memo(function HighlightedCode({ code, language }: { code: string; language?: string }) {
  const html = useMemo(() => highlightCode(code, language), [code, language]);
  return (
    <pre className="overflow-x-auto p-4 font-mono text-[13px] leading-relaxed">
      {html ? <code className="hljs" dangerouslySetInnerHTML={{ __html: html }} /> : <code className="hljs">{code}</code>}
    </pre>
  );
});

export function CodeBlock({ code, language, className, showHeader = true }: CodeBlockProps) {
  return (
    <div className={cn('not-prose my-4 overflow-hidden rounded-xl border border-line bg-code font-sans', className)}>
      {showHeader && (
        <div className="flex items-center justify-between border-b border-line/70 py-0.5 pl-4 pr-1">
          <span className="font-mono text-xs text-ink-faint">{language || 'text'}</span>
          <CopyButton text={code} showLabel />
        </div>
      )}
      <HighlightedCode code={code} language={language} />
    </div>
  );
}
