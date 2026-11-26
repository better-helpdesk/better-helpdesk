import node from '@astrojs/node';
import react from '@astrojs/react';
import { defineConfig } from 'astro/config';

export default defineConfig({
  // Every page and endpoint runs on the server: the helpdesk routes take
  // requests, and the pages read the role cookie.
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  // Renders HelpdeskAdmin, a React component, as an island.
  integrations: [react()],
});
