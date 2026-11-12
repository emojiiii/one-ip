<script lang="ts">
  import { page } from '$app/state';
  import { onMount } from 'svelte';
  import { localeFromPath, localizedPath } from '../../lib/i18n';
  import { legacyDestination } from '../../lib/legacy';
  import { translateShell } from '../../lib/shell-messages';

  let missing = $state(false);
  const locale = $derived(localeFromPath(page.url.pathname));
  onMount(() => {
    const target = legacyDestination(new URL(location.href));
    if (target) location.replace(target);
    else missing = true;
  });
</script>

{#if missing}
  <section class="ui-panel missing">
    <span aria-hidden="true">404</span>
    <h1 class="page-title">{translateShell('missing.title', [], locale)}</h1>
    <a href={localizedPath("/", locale)} class="ui-button primary">{translateShell('missing.overview', [], locale)}</a>
  </section>
{/if}

<style>
  .missing { display: grid; justify-items: center; gap: .6rem; padding: 2rem 1rem; }
  .missing span { color: var(--muted-foreground); font-size: .8rem; font-variant-numeric: tabular-nums; }
  h1 { margin: 0; }
  a { margin-top: .2rem; text-decoration: none; }
</style>
