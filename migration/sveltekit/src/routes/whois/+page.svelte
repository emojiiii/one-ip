<script module lang="ts">
  import { messageCatalog } from '../../lib/message-catalog';

  const catalog = messageCatalog("whois");
</script>

<script lang="ts">
  import { page } from "$app/state";
  import { localeFromPath } from "../../lib/i18n";
  import { localizeApiMessage } from '../leak/webrtc/locale';
  import { onMount } from 'svelte';
  import { pushState } from '$app/navigation';
  import Search from '@lucide/svelte/icons/search';
  import FileSearch from '@lucide/svelte/icons/file-search';
  import ToolHeading from '../../lib/ToolHeading.svelte';

  type Registration = {
    source: string;
    query: string;
    data: {
      ldhName?: string; name?: string; handle?: string; objectClassName?: string;
      country?: string; startAddress?: string; endAddress?: string; status?: string[];
      events?: { eventAction: string; eventDate: string }[];
      nameservers?: { ldhName?: string }[];
      entities?: { handle?: string; roles?: string[] }[];
    };
  };
  type Entry = { query: string; data: Registration; savedAt: number };
  const historyKey = 'ip-tools:whois-history:v1';
  const language = $derived(localeFromPath(page.url.pathname));
  let input = $state('');
  let query = $state('');
  let entries = $state<Entry[]>([]);
  let result = $state<Registration | null>(null);
  let savedAt = $state<number | null>(null);
  let error = $state('');
  let busy = $state(false);
  let controller: AbortController | null = null;
  const data = $derived(result?.data);
  const faqs = [
    ['whois.whatCanILookUp', 'whois.faq.supportedQueriesAnswer'],
    ['whois.whatIsTheDifferenceBetweenWhoisAndRdap', 'whois.faq.rdapAnswer'],
    ['whois.whyDidTheLookupFailOrReturnNothing', 'whois.faq.lookupFailureAnswer'],
    ['whois.whyIsRegistrantOrCountryInformationMissing', 'whois.faq.missingFieldsAnswer'],
    ['whois.whatDoDomainStatusAndNameServersMean', 'whois.faq.registrationStatusAnswer'],
    ['whois.doRecentLookupsUpdateAutomatically', 'whois.faq.lookupHistoryAnswer']
  ];

  function t(key: string, values: readonly unknown[] = []) {
    return catalog.t(key, values, language);
  }

  function localize(message: string) {
    if (language === 'zh-CN') return message;
    if (message === 'RDAP · 注册局实时数据') return t('api.rdapRegistryData');
    const status = message.match(/^外部数据源暂不可用 \((\d{3})\)$/);
    if (status) return t('api.upstreamUnavailable', [status[1]]);
    return message;
  }

  function cached(value: string) {
    return entries.find((entry) => entry.query.toLowerCase() === value.toLowerCase());
  }

  async function run(value: string) {
    controller?.abort();
    const current = new AbortController();
    controller = current;
    busy = true;
    error = '';
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL ?? '/api'}/whois/lookup/${encodeURIComponent(value)}`, {
        signal: AbortSignal.any([current.signal, AbortSignal.timeout(12000)]),
        referrerPolicy: 'no-referrer'
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(typeof payload?.error === 'string'
          ? await localizeApiMessage(localize(payload.error), language)
          : t('api.requestFailed', [response.status]));
      }
      const next: Registration = await response.json();
      if (current.signal.aborted) return;
      result = next;
      const now = Date.now();
      savedAt = now;
      entries = [{ query: value, data: next, savedAt: now }, ...entries.filter((entry) => entry.query.toLowerCase() !== value.toLowerCase())].slice(0, 10);
      try { localStorage.setItem(historyKey, JSON.stringify(entries)); } catch { /* Storage may be unavailable or full. */ }
    } catch (cause) {
      if (!current.signal.aborted) error = cause instanceof Error ? cause.message : String(cause);
    } finally {
      if (controller === current) busy = false;
    }
  }

  function select(value: string, refresh = false) {
    query = value;
    input = value;
    error = '';
    const url = new URL(window.location.href);
    url.searchParams.set('q', value);
    if (url.href !== window.location.href) pushState(url, {});
    const entry = cached(value);
    result = entry?.data ?? null;
    savedAt = entry?.savedAt ?? null;
    if (refresh || !entry) void run(value);
    else { controller?.abort(); busy = false; }
  }

  function submit(event: SubmitEvent) {
    event.preventDefault();
    const value = input.trim();
    if (!value) { error = t('lookup.enterAQuery'); return; }
    if (value.length > 253) { error = t('lookup.inputIsTooLong'); return; }
    select(value, value === query);
  }

  onMount(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(historyKey) ?? '[]');
      entries = Array.isArray(stored) ? stored.filter((item) => typeof item?.query === 'string' && item.data && Number.isFinite(item.savedAt)).slice(0, 10) : [];
    } catch { /* Storage may be unavailable or contain invalid data. */ }
    const restore = () => {
      const value = new URLSearchParams(window.location.search).get('q') ?? '';
      if (value) select(value);
      else { controller?.abort(); busy = false; input = ''; query = ''; result = null; savedAt = null; error = ''; }
    };
    restore();
    window.addEventListener('popstate', restore);
    return () => { controller?.abort(); window.removeEventListener('popstate', restore); };
  });
</script>

<svelte:head><title>{t('common.whoisLookup')}</title></svelte:head>

<div class="whois">
  <ToolHeading title={t('common.whoisLookup')}>
    {#snippet icon()}<FileSearch />{/snippet}
  </ToolHeading>
  <section class="lookup">
    <form onsubmit={submit} aria-busy={busy}>
      <input class="ui-input" dir="auto" bind:value={input} aria-label={t('whois.enterADomainIpAddressOrAsNumber')} placeholder={t('whois.enterADomainIpAddressOrAsNumber')} autocapitalize="none" autocorrect="off" spellcheck="false" />
      <button class="ui-button primary" type="submit" disabled={busy}><Search size={15} aria-hidden="true" /> {busy ? t('common.lookingUp') : t('common.lookup')}</button>
    </form>
    <div class="history">
      <span>{t(entries.length ? 'common.recentLookups' : 'common.suggestedLookups')}</span>
      {#each entries.length ? entries.map((entry) => entry.query) : ['qq.com', '1.1.1.1', 'AS15169'] as value}
        <button type="button" class:active={value.toLowerCase() === query.toLowerCase()} onclick={() => select(value, value === query)}>{value}</button>
      {/each}
    </div>
    {#if savedAt}<p class="timestamp">{t('common.savedResult')} {new Date(savedAt).toLocaleString(language)}{t('common.runTheLookupToUpdate')}</p>{/if}
  </section>
  {#if error}<p class="error" role="alert">{error}</p>{/if}
  {#if busy}<p class="pending" role="status">{t('whois.queryingTheRegistry')}</p>{/if}
  {#if data}
    <div class="report">
      <h2>{data.ldhName ?? data.name ?? query}</h2>
      <div class="grid">
      <section><h3>{t('whois.basicInformation')}</h3><dl>
        {#each [[t('whois.queryProtocol'), result?.source ? localize(result.source) : undefined], [t('whois.objectType'), data.objectClassName], [t('whois.identifier'), data.handle], [t('common.countryRegion'), data.country], [t('whois.addressRange'), data.startAddress ? `${data.startAddress} – ${data.endAddress}` : undefined]] as [label, value]}
          {#if value}<div><dt>{label}</dt><dd>{value}</dd></div>{/if}
        {/each}
      </dl></section>
      {#if data.events?.length}<section><h3>{t('whois.registrationDates')}</h3><dl>{#each data.events as event}<div><dt>{event.eventAction}</dt><dd>{new Date(event.eventDate).toLocaleString(language)}</dd></div>{/each}</dl></section>{/if}
      {#if data.status?.length}<section><h3>{t('whois.domainStatus')}</h3><div class="tags">{#each data.status as status}<span>{status}</span>{/each}</div></section>{/if}
      {#if data.nameservers?.length}<section><h3>{t('whois.nameServers')}</h3><div class="tags">{#each data.nameservers as server}<span>{server.ldhName}</span>{/each}</div></section>{/if}
      {#each data.entities ?? [] as entity}<section><h3>{entity.roles?.join(' / ') ?? t('whois.registeredEntities')}</h3><dl><div><dt>{t('whois.identifier')}</dt><dd>{entity.handle ?? t('whois.privacyProtection')}</dd></div></dl></section>{/each}
      </div>
      <details class="raw"><summary>{t('whois.viewRawRdapData')}</summary><pre>{JSON.stringify(data, null, 2)}</pre></details>
    </div>
  {/if}
  <section class="questions">
    <h2>{t('whois.faq.title')}</h2>
    {#each faqs as [question, answer]}
      <details><summary>{t(question)}</summary><p class="faq">{t(answer)}</p></details>
    {/each}
  </section>
</div>

<style>
  .whois { display: grid; gap: .9rem; }
  h2 { margin: 0; font-size: 1.25rem; letter-spacing: -.02em; overflow-wrap: anywhere; }
  h3 { margin: 0 0 .65rem; font-size: .875rem; }
  form { display: flex; align-items: stretch; gap: .55rem; }
  input { flex: 1; min-height: 2.75rem; background: var(--muted); border-color: transparent; }
  button { cursor: pointer; }
  form button { padding-inline: .95rem; }
  form button:disabled { opacity: .65; cursor: wait; }
  .lookup, .report, .questions {
    min-width: 0;
    padding: clamp(1rem, 2.4vw, 1.4rem);
    border-radius: var(--radius);
    background: var(--card);
  }
  .history {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: .35rem;
    margin-top: .85rem;
    color: var(--muted-foreground);
    font-size: .75rem;
  }
  .history button, .tags span {
    max-width: 100%;
    padding: .25rem .55rem;
    border: 0;
    border-radius: .45rem;
    background: var(--muted);
    color: var(--foreground);
    font: inherit;
    overflow-wrap: anywhere;
  }
  .history button:is(:hover, .active) {
    color: var(--primary);
    background: color-mix(in srgb, var(--primary) 12%, var(--card));
  }
  .timestamp { margin: .5rem 0 0; color: var(--muted-foreground); font-size: .75rem; }
  .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: start; gap: .7rem; margin-top: .95rem; }
  .grid section { min-width: 0; padding: .85rem 1rem; border-radius: .75rem; background: var(--muted); }
  dl, dd { margin: 0; }
  dl > div { display: grid; grid-template-columns: minmax(6rem, 36%) minmax(0, 1fr); gap: .6rem; padding: .42rem 0; font-size: .8rem; overflow-wrap: anywhere; }
  dd { font-weight: 550; }
  dt { color: var(--muted-foreground); }
  .tags { display: flex; flex-wrap: wrap; gap: .35rem; font-size: .78rem; }
  .tags span { background: var(--card); }
  .questions h2 { margin: 0 0 .4rem; font-size: 1rem; }
  .questions details + details { border-top: 1px solid color-mix(in srgb, var(--border) 70%, transparent); }
  summary { display: flex; align-items: center; justify-content: space-between; gap: .75rem; padding: .68rem 0; color: var(--foreground); cursor: pointer; list-style: none; font-size: .85rem; font-weight: 550; }
  summary::-webkit-details-marker { display: none; }
  summary::after { content: ''; width: .43rem; height: .43rem; margin-inline-end: .2rem; border: solid var(--muted-foreground); border-width: 0 1.5px 1.5px 0; transform: rotate(45deg); flex: none; }
  details[open] > summary::after { transform: rotate(225deg); }
  summary:hover { color: var(--primary); }
  .raw { margin-top: .75rem; }
  pre {
    max-height: 26rem;
    overflow: auto;
    padding: .65rem;
    border-radius: .4rem;
    background: var(--muted);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    font-size: .76rem;
  }
  .faq { margin: 0 0 .65rem; color: var(--muted-foreground); white-space: pre-line; font-size: .82rem; line-height: 1.65; }
  .error, .pending { margin: 0; padding: .55rem .75rem; border-radius: .45rem; font-size: .8rem; }
  .error { background: color-mix(in srgb, var(--danger) 9%, var(--card)); color: var(--danger); }
  .pending { background: var(--card); color: var(--muted-foreground); }
  @media (max-width: 580px) {
    .grid { grid-template-columns: 1fr; }
    .lookup, .grid section, .questions, .report { padding: .85rem; }
    input { font-size: 1rem; }
  }
</style>
