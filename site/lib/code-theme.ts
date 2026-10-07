/**
 * The marketing site's code colours (the .tk-* rules in site.css) as a Shiki
 * theme. Shiki writes inline colours, so these repeat the hex values of
 * app/tokens.css rather than reading them.
 */
export const codeTheme = {
  name: 'better-helpdesk',
  type: 'dark' as const,
  colors: {
    'editor.background': '#0b0d0c',
    'editor.foreground': '#a7b1ab',
  },
  tokenColors: [
    { settings: { foreground: '#a7b1ab' } },
    {
      scope: ['comment', 'punctuation.definition.comment'],
      settings: { foreground: '#8b948f', fontStyle: 'italic' },
    },
    {
      scope: [
        'keyword',
        'storage',
        'storage.type',
        'storage.modifier',
        'constant.language',
        'markup.inserted',
      ],
      settings: { foreground: '#9ad9b8' },
    },
    {
      scope: [
        'string',
        'string.template',
        'punctuation.definition.string',
        'markup.inline.raw',
      ],
      settings: { foreground: '#f1d27a' },
    },
    {
      scope: [
        'entity.name.function',
        'support.function',
        'entity.name.command',
      ],
      settings: { foreground: '#b9d4ff' },
    },
    {
      scope: [
        'entity.name.type',
        'entity.name.class',
        'support.class',
        'support.type',
        'entity.name.tag',
        'markup.heading',
      ],
      settings: { foreground: '#eef3f0' },
    },
    {
      scope: [
        'constant.numeric',
        'constant.character.escape',
        'markup.deleted',
      ],
      settings: { foreground: '#f0907f' },
    },
  ],
};
