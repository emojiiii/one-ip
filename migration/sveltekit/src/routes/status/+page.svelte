<script module lang="ts">
  import { messageCatalog } from '../../lib/message-catalog';

  const catalog = messageCatalog("status", "sites");
  const indicatorKeys = new Map([
    ['none', 'status.operational'],
    ['operational', 'status.operational'],
    ['minor', 'status.minorOutage'],
    ['major', 'status.majorOutage'],
    ['major_outage', 'status.majorOutage'],
    ['critical', 'status.criticalOutage'],
    ['maintenance', 'status.maintenance'],
    ['under_maintenance', 'status.maintenance'],
    ['degraded_performance', 'status.degradedPerformance'],
    ['partial_outage', 'status.partialOutage']
  ]);
</script>

<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import ArrowUpRight from '@lucide/svelte/icons/arrow-up-right';
  import Activity from '@lucide/svelte/icons/activity';
  import RefreshCw from '@lucide/svelte/icons/refresh-cw';
  import X from '@lucide/svelte/icons/x';
  import ToolHeading from '../../lib/ToolHeading.svelte';
  import { localeFromPath } from '../../lib/i18n';
  import { fetchStatusSummary, type StatusSummary } from '../../lib/status-summary';
  import services from './services.json';

  type Result = StatusSummary & {
    incidents?: { id: string; name: string; status: string; updated_at?: string }[];
    components?: { id: string; name: string; status: string }[];
    checkedAt?: string;
  };
  type State = { data?: StatusSummary; loading: boolean; error?: boolean };
  const groups = ['全部', 'AI', 'VPS', '云服务', '开发', '社区'];
  const language = $derived(localeFromPath(page.url.pathname));
  let filter = $state('全部');
  let detailId = $state<string | null>(null);
  let detailData = $state<Result>();
  let detailError = $state(false);
  let detailPending = $state(false);
  let detailController: AbortController | undefined;
  let iconObserver: IntersectionObserver | undefined;
  let states = $state<Record<string, State>>({});
  let dialog: HTMLDialogElement;
  function t(key: string, values: readonly unknown[] = []) {
    return catalog.t(key, values, language);
  }
  const rows = $derived(services.filter((service) => filter === '全部' || service.group === filter));
  const detail = $derived(services.find((service) => service.id === detailId));
  const sections = $derived([
    rows.filter((service) => !states[service.id]?.error && ['minor', 'major', 'critical', 'maintenance'].includes(states[service.id]?.data?.status.indicator ?? '')),
    rows.filter((service) => !states[service.id]?.error && states[service.id]?.data?.status.indicator === 'none'),
    rows.filter((service) => states[service.id]?.error || !['minor', 'major', 'critical', 'maintenance', 'none'].includes(states[service.id]?.data?.status.indicator ?? ''))
  ]);
  const pending = $derived(Object.values(states).some((state) => state.loading));
  const sectionNames = $derived([
    t('status.incidentsMaintenance'),
    t('status.operational'),
    t('status.unknown')
  ]);
  const tones = ['issue', 'healthy', 'unknown'];
  const integrated = services.filter((service) => service.url).map((service) => service.id);

  function visibleIcon(node: HTMLImageElement) {
    iconObserver ??= new IntersectionObserver((entries, observer) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const image = entry.target as HTMLImageElement;
        image.src = image.dataset.icon!;
        observer.unobserve(image);
      }
    }, { rootMargin: '96px' });
    iconObserver.observe(node);
    return { destroy: () => iconObserver?.unobserve(node) };
  }

  function iconUrl(service: (typeof services)[number]) {
    const iconHost = service.icon?.match(/^https:\/\/icons\.duckduckgo\.com\/ip3\/([^/?#]+)\.ico$/)?.[1];
    const host = iconHost ?? new URL(service.page).hostname;
    return `/api/icons/${encodeURIComponent(host === 'www.githubstatus.com' ? 'github.com' : host)}`;
  }

  function groupLabel(group: string) {
    if (group === '全部') return t('status.groups.all');
    if (group === '云服务') return t('status.groups.cloud');
    if (group === '开发') return t('status.groups.development');
    if (group === '社区') return t('status.groups.community');
    return group;
  }
  function serviceName(service: (typeof services)[number]) {
    return service.nameKey ? t(service.nameKey) : service.name;
  }
  function indicatorLabel(indicator?: string) {
    return t(indicatorKeys.get(indicator ?? '') ?? 'status.pendingConfirmation');
  }
  function stateLabel(id: string, integrated: boolean) {
    const state = states[id];
    if (!integrated) return t('status.notIntegrated');
    if (!state || state.loading && !state.data) return t('status.checking');
    if (state.error) return t(state.data ? 'status.updateFailed' : 'status.lookupFailed');
    return indicatorLabel(state.data?.status.indicator);
  }
  function readUrl() {
    const params = new URLSearchParams(location.search);
    const group = params.get('group');
    filter = group && groups.includes(group) ? group : '全部';
    const id = params.get('service');
    const service = services.find((entry) => entry.id === id);
    if (detailId !== (service?.id ?? null)) {
      detailId = service?.id ?? null;
      detailController?.abort();
      detailData = undefined;
      detailError = false;
      detailPending = false;
      if (service?.url) void loadDetail(service.id);
    }
    if (detailId && !dialog.open) {
      void tick().then(() => { if (detailId && !dialog.open) dialog.showModal(); });
    } else if (!detailId && dialog.open) {
      dialog.close();
    }
  }
  async function loadDetail(id: string) {
    const active = new AbortController();
    detailController = active;
    detailError = false;
    detailPending = true;
    try {
      const response = await fetch(`/api/status/${encodeURIComponent(id)}`, {
        signal: AbortSignal.any([active.signal, AbortSignal.timeout(12_000)]),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data: Result = await response.json();
      if (!active.signal.aborted) detailData = data;
    } catch {
      if (!active.signal.aborted) detailError = true;
    } finally {
      if (!active.signal.aborted) detailPending = false;
    }
  }
  async function setParam(key: string, value: string | null, replace = false) {
    const url = new URL(location.href);
    if (value) url.searchParams.set(key, value); else url.searchParams.delete(key);
    await goto(url, { shallow: true, replace, state: page.state });
    readUrl();
  }
  async function refresh(signal: AbortSignal) {
    if (pending) return;
    for (const id of integrated) states[id] = { ...states[id], loading: true, error: undefined };
    const batches: string[][] = [];
    for (let i = 0; i < integrated.length; i += 12) batches.push(integrated.slice(i, i + 12));
    async function fetchBatch(ids: string[]) {
      try {
        const summary = await fetchStatusSummary(ids, signal);
        if (signal.aborted) return;
        for (const id of ids) {
          const data = summary[id];
          states[id] = data ? { data, loading: false } : { ...states[id], loading: false, error: true };
        }
      } catch {
        if (!signal.aborted) for (const id of ids) states[id] = { ...states[id], loading: false, error: true };
      }
    }
    for (let i = 0; i < batches.length && !signal.aborted; i += 2) {
      await Promise.all(batches.slice(i, i + 2).map(fetchBatch));
    }
  }
  let controller = $state<AbortController>();
  onMount(() => {
    readUrl();
    window.addEventListener('popstate', readUrl);
    const active = new AbortController();
    controller = active;
    void refresh(active.signal);
    const timer = window.setInterval(() => { if (!document.hidden) void refresh(active.signal); }, 120000);
    return () => {
      active.abort();
      detailController?.abort();
      iconObserver?.disconnect();
      clearInterval(timer);
      window.removeEventListener('popstate', readUrl);
    };
  });
</script>

<svelte:head><title>{t('status.title')} · One IP</title></svelte:head>
<div class="status-page">
  <ToolHeading title={t('status.title')}>
    {#snippet icon()}<Activity />{/snippet}
    <button class="ui-button refresh" disabled={pending || !controller} aria-busy={pending} onclick={() => { if (controller) void refresh(controller.signal); }}>
      <RefreshCw size={14} aria-hidden="true" /> {pending ? t('status.refreshing') : t('status.refreshStatus')}
    </button>
  </ToolHeading>
  <div class="summary">
    {#each sections as section, i}
      <div class={tones[i]}>
        <span><i class="dot" aria-hidden="true"></i>{sectionNames[i]}</span>
        <strong>{section.length}</strong>
      </div>
    {/each}
  </div>
  <nav class="filters" aria-label={t('status.filterServices')}>
    {#each groups as group}
      <button class:active={filter === group} aria-pressed={filter === group} onclick={() => setParam('group', group === '全部' ? null : group)}>{groupLabel(group)}</button>
    {/each}
  </nav>
  {#each sections as section, i}
    {#if section.length}
      <section class="list {tones[i]}">
        <h2><span class="dot" aria-hidden="true"></span>{sectionNames[i]} <small>{section.length}</small></h2>
        {#each section as service (service.id)}
          {@const name = serviceName(service)}
          <div class="row">
            <button class="service" onclick={() => setParam('service', service.id)} aria-label={t('status.viewStatusDetails', [name])}>
              <span class="logo" aria-hidden="true">
                <span>{name.slice(0, 1)}</span>
                <img use:visibleIcon data-icon={iconUrl(service)} alt="" width="20" height="20" decoding="async" onerror={(event) => { event.currentTarget.setAttribute('hidden', ''); }} />
              </span>
              <span class="name"><strong>{name}</strong><small>{groupLabel(service.group)}</small></span>
              <span class="status" data-indicator={states[service.id]?.error ? undefined : states[service.id]?.data?.status.indicator}>{stateLabel(service.id, Boolean(service.url))}</span>
            </button>
            <a href={service.page} target="_blank" rel="noreferrer" title={service.statusSource ?? t('status.officialStatus')}>
              <span class="source">{service.statusSource ?? t('status.officialStatus').replace(/\s*↗$/, '')}</span>
              <ArrowUpRight size={14} aria-hidden="true" />
            </a>
          </div>
        {/each}
      </section>
    {/if}
  {/each}
  <details class="ui-panel severity-guide">
    <summary>{t('status.severity.title')}</summary>
    <p>{t('status.severity.description')}</p>
    <dl>
      <div><dt class="status" data-indicator="minor">{indicatorLabel('minor')}</dt><dd>{t('status.severity.minor')}</dd></div>
      <div><dt class="status" data-indicator="major">{indicatorLabel('major')}</dt><dd>{t('status.severity.major')}</dd></div>
      <div><dt class="status" data-indicator="critical">{indicatorLabel('critical')}</dt><dd>{t('status.severity.critical')}</dd></div>
      <div><dt class="status" data-indicator="maintenance">{indicatorLabel('maintenance')}</dt><dd>{t('status.severity.maintenance')}</dd></div>
    </dl>
  </details>
  <p class="hint">{t('status.checksAutomaticallyEvery2MinutesUnknownFailedQueries')}</p>
</div>
<dialog bind:this={dialog} aria-labelledby="service-detail-title" onclose={() => { if (detailId) setParam('service', null, true); }}>
  {#if detail}
    <div class="dialog-heading"><h2 id="service-detail-title">{t('status.namedServiceDetails', [serviceName(detail)])}</h2><button class="ui-button ghost" onclick={() => dialog.close()} aria-label={t('common.close')}><X size={16} aria-hidden="true" /></button></div>
    <p>{detail.noteKey ? t(detail.noteKey) : (detailData?.status.description ?? states[detail.id]?.data?.status.description ?? '')}</p>
    <p>{detailData ? indicatorLabel(detailData.status.indicator) : stateLabel(detail.id, Boolean(detail.url))} · {groupLabel(detail.group)}</p>
    {#if detailPending}<p role="status">{t('status.loadingDetails')}</p>{/if}
    {#if detailError}<p role="alert">{t('status.lookupFailed')}</p><button class="ui-button" onclick={() => { if (detail) void loadDetail(detail.id); }}>{t('status.refreshStatus')}</button>{/if}
    {#if detailData?.fetchedAt}<p>{t('status.lastSuccessfulUpdate', [new Date(detailData.fetchedAt).toLocaleString(language)])}</p>{/if}
    {#if detailData?.components?.length}
      <h3>{t('status.serviceComponents')}</h3>
      {#each detailData.components as component (component.id)}<p class="detail-row"><span>{component.name}</span><span>{indicatorLabel(component.status)}</span></p>{/each}
    {/if}
    <h3>{t('status.currentIncidents')}</h3>
    {#if detailData?.incidents}
      {#each detailData.incidents as incident (incident.id)}<p>{incident.name} · {incident.status}</p>{:else}<p>{t('status.theSourceReportedNoCurrentIncidents')}</p>{/each}
    {:else if detailData}<p>{t('status.sourceProvidesAggregateStatusSeeSourcePageIncident')}</p>{/if}
    <a href={detail.page} target="_blank" rel="noreferrer">{detail.statusSource ? `${detail.statusSource} ↗` : t('status.viewOfficialStatusPage')}</a>
  {/if}
</dialog>

<style>
  .status-page { display: grid; gap: .9rem; }
  .dialog-heading, .detail-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: .75rem;
  }
  button { cursor: pointer; }
  button:disabled { cursor: wait; opacity: .62; }
  .refresh { flex: none; }
  .issue { --status-tone: var(--danger); }
  .healthy { --status-tone: var(--success); }
  .unknown { --status-tone: var(--muted-foreground); }
  .summary, .list { background: var(--card); border-radius: var(--radius); }
  .summary {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    padding: .55rem;
    gap: .3rem;
  }
  .summary > div { padding: .85rem clamp(.55rem, 2vw, 1.2rem); }
  .summary > div + div { border-inline-start: 1px solid var(--border); }
  .summary span { display: flex; align-items: center; gap: .42rem; color: var(--muted-foreground); font-size: .8rem; line-height: 1.3; }
  .summary strong {
    display: block;
    margin-top: .45rem;
    font-size: clamp(1.6rem, 4vw, 2.2rem);
    letter-spacing: -.045em;
    font-variant-numeric: tabular-nums;
    line-height: 1.1;
    color: var(--status-tone);
  }
  .filters { display: flex; align-items: center; gap: .25rem; overflow: auto; padding: .25rem 0; }
  .filters button {
    padding: .38rem .68rem;
    border: 0;
    border-radius: .5rem;
    background: transparent;
    color: var(--muted-foreground);
    font: inherit;
    font-size: .8rem;
    white-space: nowrap;
  }
  .filters button:hover { background: var(--muted); }
  .filters button.active { background: var(--primary-soft); color: var(--primary); font-weight: 650; }
  .list { padding: 1rem 1.15rem .4rem; min-width: 0; }
  .list h2 { display: flex; align-items: center; gap: .45rem; margin: 0 0 .55rem; font-size: .94rem; }
  .list h2 small { color: var(--muted-foreground); font-size: .75rem; font-weight: 500; }
  .dot { width: .45rem; height: .45rem; flex: none; border-radius: 50%; background: var(--status-tone); }
  .row { display: flex; align-items: center; gap: .65rem; }
  .row + .row { border-top: 1px solid color-mix(in srgb, var(--border) 65%, transparent); }
  .row > a {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: .2rem;
    flex: none;
    min-width: 1.75rem;
    min-height: 1.75rem;
    padding: .35rem .2rem;
    color: var(--muted-foreground);
    font-size: .75rem;
    text-decoration: none;
  }
  .row > a:hover { color: var(--primary); }
  .service {
    display: flex;
    align-items: center;
    gap: .6rem;
    flex: 1;
    min-width: 0;
    padding: .64rem .18rem;
    border: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    text-align: start;
  }
  .service:hover strong { color: var(--primary); }
  .logo {
    position: relative;
    display: grid;
    place-items: center;
    width: 1.45rem;
    height: 1.45rem;
    flex: none;
    border-radius: .35rem;
    background: var(--muted);
    color: var(--muted-foreground);
    font-size: .68rem;
    font-weight: 650;
  }
  .logo img { position: absolute; inset: 0; width: 100%; height: 100%; border-radius: inherit; background: var(--card); object-fit: contain; }
  .logo img:not([src]) { visibility: hidden; }
  .name { display: flex; align-items: baseline; gap: .45rem; flex: 1; min-width: 0; }
  .name strong { font-size: .85rem; font-weight: 600; overflow-wrap: anywhere; }
  .name small { color: var(--muted-foreground); font-size: .72rem; }
  .status { --badge-tone: var(--muted-foreground); padding: .14rem .42rem; border-radius: .38rem; background: color-mix(in srgb, var(--badge-tone) 10%, transparent); color: var(--badge-tone); font-size: .75rem; font-weight: 600; text-align: end; }
  .status[data-indicator='none'] { --badge-tone: var(--success); }
  .status[data-indicator='minor'] { --badge-tone: var(--warning); }
  .status[data-indicator='major'] { --badge-tone: color-mix(in srgb, var(--danger) 55%, var(--warning)); }
  .status[data-indicator='critical'] { --badge-tone: var(--danger); }
  .status[data-indicator='maintenance'] { --badge-tone: var(--primary); }
  .severity-guide { font-size: .82rem; }
  .severity-guide summary { font-weight: 600; }
  .severity-guide p, .severity-guide dd { color: var(--muted-foreground); }
  .severity-guide dl { display: grid; gap: .5rem; margin: 0; }
  .severity-guide dl div { display: flex; align-items: baseline; gap: .6rem; }
  .severity-guide dt { flex: none; }
  .severity-guide dd { margin: 0; }
  .hint { margin: .05rem 0 0; color: var(--muted-foreground); font-size: .75rem; }
  dialog {
    width: min(36rem, calc(100% - 2rem));
    max-height: 85dvh;
    padding: 1rem;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--card);
    color: var(--foreground);
    box-shadow: 0 16px 48px #0003;
  }
  dialog::backdrop { background: #11182770; }
  .dialog-heading { margin-bottom: .7rem; }
  .dialog-heading h2 { margin: 0; font-size: 1rem; }
  .dialog-heading button { padding-inline: .45rem; }
  dialog p, dialog a { font-size: .82rem; line-height: 1.55; overflow-wrap: anywhere; }
  dialog h3 { margin: 1rem 0 .4rem; font-size: .85rem; }
  .detail-row { padding-bottom: .35rem; border-bottom: 1px solid var(--border); }
  @media (max-width: 600px) {
    .summary { gap: .2rem; padding: .25rem; }
    .summary > div { padding: .65rem .45rem; }
    .summary span { font-size: .72rem; }
    .list { padding-inline: .7rem; }
    .name { flex-direction: column; gap: .05rem; }
    .row { gap: .35rem; }
    .source { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
  }
</style>
