import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

import { origin } from './origin';

export default defineConfig({
  plugins: [sveltekit({ adapter: adapter(), paths: { origin } })],
});
