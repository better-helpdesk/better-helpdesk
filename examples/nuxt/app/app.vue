<script setup lang="ts">
useHead({ title: 'Nuxt with Better Helpdesk' });

onMounted(async () => {
  const { defineHelpdeskWidget } = await import('better-helpdesk/widget');
  defineHelpdeskWidget();
});
</script>

<template>
  <h1>Nuxt with Better Helpdesk</h1>
  <p>The launcher is in the corner.</p>
  <helpdesk-widget api="/api/helpdesk" inbox="support" />
</template>
