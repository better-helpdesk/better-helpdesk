import { loader } from 'fumadocs-core/source';
import { applyMdxPreset } from 'fumadocs-mdx/config';
import { defineDocs } from 'fumadocs-mdx/macro';
import { createElement } from 'react';
import {
  PiBracketsCurlyBold,
  PiChatCircleTextBold,
  PiCodeBold,
  PiDatabaseBold,
  PiEnvelopeSimpleBold,
  PiFingerprintBold,
  PiGearSixBold,
  PiPaletteBold,
  PiSparkleBold,
  PiTrayBold,
} from 'react-icons/pi';

import { codeTheme } from './code-theme';

// The processed markdown is what /llms.txt, /llms-full.txt and each page's .md serve.
const docs = defineDocs({
  dir: 'content/docs',
  docs: {
    postprocess: { includeProcessedMarkdown: true },
    mdxOptions: applyMdxPreset({
      rehypeCodeOptions: { themes: { light: codeTheme, dark: codeTheme } },
    }),
  },
});

/** The topic folders' icons, named by the `icon` field of their meta.json. */
const ICONS = {
  database: PiDatabaseBold,
  identity: PiFingerprintBold,
  widget: PiChatCircleTextBold,
  inbox: PiTrayBold,
  email: PiEnvelopeSimpleBold,
  ai: PiSparkleBold,
  app: PiCodeBold,
  customize: PiPaletteBold,
  operations: PiGearSixBold,
  reference: PiBracketsCurlyBold,
};

export const source = loader({
  baseUrl: '/docs',
  source: docs.toFumadocsSource(),
  icon(name) {
    const Icon = name ? ICONS[name as keyof typeof ICONS] : undefined;
    return Icon ? createElement(Icon, { 'aria-hidden': true }) : undefined;
  },
});
