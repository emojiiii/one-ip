<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { updated } from '$app/state';
  import { dev, version } from '$app/env';
  import { resolve } from '$app/paths';
  import type { Locale } from './i18n';
  import { translateShell } from './shell-messages';
  import { hasValidUpdate } from './update-version';

  let { language }: { language: Locale } = $props();
  let open = $state(false);
  let available = false;
  let checking = false;
  let active = false;
  let snoozedUntil = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let retry: ReturnType<typeof setTimeout> | undefined;
  const controller = new AbortController();

  function t(key: string) {
    return translateShell(key, [], language);
  }

  async function confirmUpdate() {
    if (checking || available || !active || document.visibilityState === 'hidden') return;
    clearTimeout(retry);
    checking = true;
    const confirmed = await hasValidUpdate(resolve('_app/version.json'), version, AbortSignal.any([controller.signal, AbortSignal.timeout(10_000)]));
    checking = false;
    if (!active) return;
    if (!confirmed) { retry = setTimeout(() => { void confirmUpdate(); }, 60_000); return; }
    available = true;
    if (Date.now() >= snoozedUntil) open = true;
  }

  $effect(() => {
    if (updated.current) untrack(() => { void confirmUpdate(); });
  });

  function remindLater() {
    open = false;
    snoozedUntil = Date.now() + 30 * 60_000;
    clearTimeout(timer);
    timer = setTimeout(() => { if (active && available) open = true; }, 30 * 60_000);
  }

  function reload() {
    const url = new URL(location.href);
    url.searchParams.set('t', Date.now().toString());
    location.replace(url.href);
  }

  onMount(() => {
    if (dev) return;
    active = true;
    const onVisibility = () => { if (document.visibilityState === 'visible' && updated.current) void confirmUpdate(); };
    document.addEventListener('visibilitychange', onVisibility);
    if (updated.current) void confirmUpdate(); else void updated.check();
    return () => { active = false; controller.abort(); clearTimeout(timer); clearTimeout(retry); document.removeEventListener('visibilitychange', onVisibility); };
  });
</script>

{#if open}
  <aside role="alert" aria-live="polite" aria-atomic="true" aria-label={t('update.available')}>
    <strong>{t('update.available')}</strong>
    <p>{t('update.description')}</p>
    <div><button onclick={remindLater}>{t('update.later')}</button><button class="primary" onclick={reload}>{t('update.now')}</button></div>
  </aside>
{/if}

<style>
  aside { position: fixed; z-index: 50; inset-inline-end: 16px; bottom: 16px; width: min(23rem, calc(100% - 32px)); padding: 16px; border: 1px solid var(--color-border); border-radius: 12px; background: var(--color-card); color: inherit; box-shadow: 0 8px 28px #0002; }
  strong { font-size: .9rem; } p { margin: .35rem 0 .8rem; color: var(--color-muted-foreground); font-size: .8rem; } aside div { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; } button { cursor: pointer; padding: .5rem; border: 1px solid var(--color-border); border-radius: 6px; background: var(--color-card); color: inherit; font: inherit; font-size: .8rem; } .primary { background: var(--color-primary); color: var(--color-card); }
</style>
