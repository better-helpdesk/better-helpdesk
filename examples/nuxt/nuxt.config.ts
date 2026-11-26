export default defineNuxtConfig({
  compatibilityDate: '2026-11-26',
  vue: {
    compilerOptions: {
      // A web component the browser defines once better-helpdesk/widget
      // loads, not a Vue component to resolve.
      isCustomElement: tag => tag === 'helpdesk-widget',
    },
  },
});
