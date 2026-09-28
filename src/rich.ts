// Kept in one file with the renderer so hosts can import it on its own
// (`better-helpdesk/rich`) under any module resolution.
export {
  type Block,
  type Inline,
  parseInline,
  parseRich,
  plainText,
  safeHref,
} from './ui/rich';
