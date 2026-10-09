<script lang="ts">
import { onMount } from 'svelte';

onMount(async () => {
  const { defineHelpdeskWidget } = await import('better-helpdesk/widget');
  defineHelpdeskWidget();
});
</script>

<svelte:head>
  <title>SvelteKit with Better Helpdesk</title>
</svelte:head>

<h1>SvelteKit with Better Helpdesk</h1>
<p>The launcher is in the corner.</p>

<helpdesk-widget api="/api/helpdesk" inbox="support"></helpdesk-widget>
