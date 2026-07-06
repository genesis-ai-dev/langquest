import { CodeBlock, type Theme } from '@react-email/components';

const urlTheme = {
  base: {
    color: '#3c4149',
    backgroundColor: '#fbfbfb',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    padding: '16px',
    margin: '0 0 24px',
    maxWidth: '100%',
    boxSizing: 'border-box',
    fontFamily:
      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    fontSize: '13px',
    lineHeight: '1.5',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
    overflowWrap: 'anywhere'
  }
} satisfies Theme;

interface UrlCopyBoxProps {
  url: string;
}

export const UrlCopyBox = ({ url }: UrlCopyBoxProps) => (
  <CodeBlock
    code={url}
    language="markup"
    theme={urlTheme}
    fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
  />
);
