import type { Metadata } from 'next';

import './demo.css';

export const metadata: Metadata = {
  title: 'Harbor — better-helpdesk demo',
  description:
    'A pretend shipping product with better-helpdesk installed: the widget in the corner, the agent inbox at /helpdesk.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <a className="skip" href="#main">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
