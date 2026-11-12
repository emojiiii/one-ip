<script lang="ts">
  import ResultValue from './ResultValue.svelte';
  import { fieldLabel, hasResultValue, valueText } from './result-format';
  import { t } from './locale';
  let { value, depth = 0 }: { value: unknown; depth?: number } = $props();
  const entries = $derived(value !== null && typeof value === 'object' ? Object.entries(value).filter(([, child]) => hasResultValue(child)) : []);
</script>

{#if typeof value === 'string' && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(value)}
  <img src={value} alt={t('browser.results.drawingSampleGeneratedByThisCheck')} />
{:else if value === null || typeof value !== 'object'}
  <span>{valueText(value)}</span>
{:else if !entries.length}
  <span>{Array.isArray(value) ? t('browser.results.emptyList0Items') : t('browser.results.noEntries0Items')}</span>
{:else if depth >= 4}
  <pre>{JSON.stringify(value, null, 2)}</pre>
{:else}
  <dl class:nested={depth > 0}>{#each entries as [key, child]}<div><dt>{Array.isArray(value) ? t('browser.results.itemNumber', [Number(key) + 1]) : fieldLabel(key)}</dt><dd><ResultValue value={child} depth={depth + 1} /></dd></div>{/each}</dl>
{/if}

<style>
  dl { margin: .15rem 0; padding: .15rem .55rem; border-radius: .45rem; background: var(--muted); }
  .nested { margin-top: .25rem; padding: .1rem .45rem; border-inline-start: 1px solid var(--border); }
  dl > div { padding: .4rem 0; }
  dl > div + div { border-top: 1px solid var(--border); }
  dt { color: var(--muted-foreground); font-size: .73rem; }
  dd, span { overflow-wrap: anywhere; font-size: .8rem; }
  dd { margin: .2rem 0 0; }
  img { display: block; max-width: 100%; max-height: 12rem; border: 1px solid var(--border); border-radius: .35rem; background: white; }
  pre { max-height: 24rem; overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; font-size: .76rem; }
</style>
