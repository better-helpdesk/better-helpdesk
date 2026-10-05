// Next.js bundles the global stylesheet; TypeScript 6 refuses a side-effect
// import it has no declaration for, and TypeScript 7 does not mind the hint.
declare module '*.css';
