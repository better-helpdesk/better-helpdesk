// No imports: the agent UI's browser bundle reads it too.
/** What the AI may do, each switched on or off in the agent UI's settings. */
export const AI_FEATURES = [
  'classify',
  'title',
  'summary',
  'duplicates',
  'draft',
  'rewrite',
] as const;
export type AiFeature = (typeof AI_FEATURES)[number];
export type AiSettings = Record<AiFeature, boolean>;
