import { Children, isValidElement, memo, type ReactElement, type ReactNode } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '../../lib/cn';
import { CodeBlock } from './CodeBlock';

function textOf(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (isValidElement<{ children?: ReactNode }>(node)) return textOf(node.props.children);
  return '';
}

const components: Components = {
  pre({ children }) {
    const child = Children.toArray(children)[0];
    if (isValidElement(child)) {
      const el = child as ReactElement<{ className?: string; children?: ReactNode }>;
      const language = /language-([\w+#.-]+)/.exec(el.props.className ?? '')?.[1];
      return <CodeBlock code={textOf(el.props.children).replace(/\n$/, '')} language={language} />;
    }
    return <pre>{children}</pre>;
  },
  a({ children, href }) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    );
  },
};

const remarkPlugins = [remarkGfm];

interface MarkdownProps {
  content: string;
  className?: string;
  streaming?: boolean;
}

export const Markdown = memo(function Markdown({ content, className, streaming }: MarkdownProps) {
  return (
    <div className={cn('prose-aether', streaming && 'streaming-caret-host', className)}>
      <ReactMarkdown remarkPlugins={remarkPlugins} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
});
