// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CodeBlock } from './code-block';
import { translator } from './i18n';
import { RichText } from './rich';

const t = translator('en');
const hostile =
  '<script>alert(1)</script>\n<img src=x onerror="alert(2)">\n</pre><b>bold</b>';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const clickCopy = () =>
  act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Copy code' }));
  });

describe('CodeBlock', () => {
  it('shows hostile code as inert text inside a message', () => {
    const { container } = render(
      <RichText
        text={`Look:\n\`\`\`\n${hostile}\n\`\`\``}
        code={text => <CodeBlock text={text} t={t} />}
      />
    );
    expect(container.querySelector('script, img, b')).toBeNull();
    expect(container.querySelector('pre')?.textContent).toBe(hostile);
  });

  it('copies the code and says so', async () => {
    let clipboard = '';
    vi.stubGlobal('navigator', {
      ...navigator,
      clipboard: {
        writeText: async (text: string) => {
          clipboard = text;
        },
      },
    });
    render(<CodeBlock text={hostile} t={t} />);
    await clickCopy();
    expect(clipboard).toBe(hostile);
    expect(screen.getByRole('status').textContent).toBe('Copied');
  });

  it('selects the code to copy by hand when the clipboard is refused', async () => {
    vi.stubGlobal('navigator', {
      ...navigator,
      clipboard: {
        writeText: () => Promise.reject(new Error('NotAllowedError')),
      },
    });
    render(<CodeBlock text="npm run build" t={t} />);
    await clickCopy();
    expect(document.getSelection()?.toString()).toBe('npm run build');
    expect(screen.getByRole('status').textContent).toBe('Press Ctrl+C to copy');
  });

  it('selects the code when there is no clipboard at all', async () => {
    vi.stubGlobal('navigator', { ...navigator, clipboard: undefined });
    render(<CodeBlock text="ls -la" t={t} />);
    await clickCopy();
    expect(document.getSelection()?.toString()).toBe('ls -la');
    expect(screen.getByRole('status').textContent).toBe('Press Ctrl+C to copy');
  });
});
