// The app's own origin. adapter-node bakes it into the build, and the helpdesk
// refuses mutations from any other origin, so ORIGIN is set for the build and
// the start alike, and both read it here.
export const origin = process.env.ORIGIN ?? 'http://localhost:5173';
