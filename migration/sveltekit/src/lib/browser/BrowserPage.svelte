<script lang="ts">
  import { page } from '$app/state';
  import { onMount } from 'svelte';
  import { localeFromPath, localizedPath } from '../i18n';
  import RefreshCw from '@lucide/svelte/icons/refresh-cw';
  import Monitor from '@lucide/svelte/icons/monitor';
  import Fingerprint from '@lucide/svelte/icons/fingerprint';
  import ScanLine from '@lucide/svelte/icons/scan-line';
  import ShieldCheck from '@lucide/svelte/icons/shield-check';
  import ToolHeading from '../ToolHeading.svelte';
  import { t as translate } from './locale';
  import { environmentRows, type BrowserNavigator } from './environment';
  import { automationChecks, consistencyChecks, fingerprint } from './collect';
  import { collectDeepDiagnostics, type DiagnosticResult } from './deep-diagnostics';
  import { fieldLabel, fingerprintSummary, hasResultValue, moduleReport, parseDetail } from './result-format';
  import ResultValue from './ResultValue.svelte';
  import WebRtc from '../../routes/leak/webrtc/+page.svelte';
  import type { Check } from './consistency';

  let { mode }: { mode: 'environment' | 'fingerprint' | 'checks' | 'privacy' } = $props();
  const icons = { environment: Monitor, fingerprint: Fingerprint, checks: ScanLine, privacy: ShieldCheck };
  const ModeIcon = $derived(icons[mode]);
  let ready = $state(false);
  let rows = $state<[string, string | number][]>([]);
  let fp = $state<Awaited<ReturnType<typeof fingerprint>>>();
  let previous = $state<Awaited<ReturnType<typeof fingerprint>>>();
  let checks = $state<Check[]>([]);
  let automation = $state<Check[]>([]);
  let deep = $state<DiagnosticResult>();
  let reports = $derived(deep?.modules.map(module => ({ ...module, report: moduleReport(module.name, parseDetail(module.detail)) })) ?? []);
  let flagged = $derived(reports.filter(module => module.report.signal));
  let unavailable = $derived(reports.filter(module => module.report.unavailable));
  let readErrors = $derived(reports.find(module => module.name === 'errors' && module.report.status === t('common.readErrorsFound')));
  let permissions = $state<[string, string][]>([]);
  let message = $state('');
  let error = $state('');
  let busy = $state(false);
  let deepBusy = $state(false);
  let algorithm = $state<'modern' | 'tls'>('modern');
  let tls = $state<{ ja3: string | null; ja4: string | null; tlsVersion: string | null; tlsCipher: string | null }>();
  let controller: AbortController | undefined;

  async function refreshPermissions() {
    permissions = await Promise.all((['geolocation', 'camera', 'microphone', 'notifications'] as const).map(async name => {
      try { return [name, (await navigator.permissions.query({ name: name as PermissionName })).state] as [string, string]; }
      catch { return [name, t('browser.queryUnsupported')] as [string, string]; }
    }));
  }
  async function run() {
    busy = true; error = '';
    try {
      if (mode === 'environment') rows = environmentRows();
      if (mode === 'fingerprint') {
        if (algorithm === 'modern') { const next = await fingerprint(); previous = fp; fp = next; }
        else {
          const response = await fetch('/api/browser/tls-fingerprint', { cache: 'no-store' });
          if (!response.ok) throw new Error(t('browser.tlsFingerprintRequestFailedPleaseRetry'));
          tls = await response.json();
        }
      }
      if (mode === 'checks') { checks = await consistencyChecks(); automation = automationChecks(); }
      if (mode === 'privacy') await refreshPermissions();
    } catch (cause) { error = cause instanceof Error ? cause.message : String(cause); }
    finally { busy = false; }
  }
  async function runDeep() {
    controller?.abort(); const active = new AbortController(); controller = active;
    deepBusy = true; deep = undefined;
    try { deep = await collectDeepDiagnostics(active.signal); }
    catch (cause) { if (!active.signal.aborted) error = cause instanceof Error ? cause.message : String(cause); }
    finally { if (!active.signal.aborted) deepBusy = false; }
  }
  async function media(kind: 'camera' | 'microphone') {
    busy = true; message = t('browser.awaitingPermission');
    try {
      const stream = await navigator.mediaDevices.getUserMedia(kind === 'camera' ? { video: true } : { audio: true });
      stream.getTracks().forEach(track => track.stop());
      message = t('browser.permissionGrantedTheMediaStreamWasClosedImmediately');
    } catch { message = t('browser.mediaAccessWasGrantedDeviceUnavailable'); }
    finally { busy = false; await refreshPermissions(); }
  }
  function locate() {
    busy = true; message = t('browser.awaitingLocationPermission');
    navigator.geolocation.getCurrentPosition(position => {
      message = t('browser.latitudeLongitudeAccuracyApproximatelyMeters', [position.coords.latitude.toFixed(5), position.coords.longitude.toFixed(5), Math.round(position.coords.accuracy)]);
      busy = false; void refreshPermissions();
    }, () => { message = t('browser.locationResultPermissionMayHaveBeenDeniedLocation'); busy = false; void refreshPermissions(); }, { timeout: 10000, maximumAge: 0 });
  }
  function navigation() {
    return [
      { path: 'environment', label: t('common.environment') },
      { path: 'fingerprint', label: t('common.fingerprint') },
      { path: 'checks', label: t('common.environmentChecks') },
      { path: 'privacy', label: t('common.permissionsPrivacy') }
    ];
  }
  const locale = $derived(localeFromPath(page.url.pathname));
  function t(key: string, values: readonly unknown[] = []) {
    return translate(key, values, locale);
  }
  const tabs = $derived(navigation());
  const title = $derived(tabs.find(tab => tab.path === mode)!.label);
  onMount(() => {
    ready = true;
    void run();
    if (mode === 'checks') void runDeep();
    return () => controller?.abort();
  });
</script>

<svelte:head><title>{title} · One IP</title></svelte:head>

{#snippet facts(items: [string, string | number][], firstWide = false)}
  <dl class="facts">
    {#each items as [name, value], index}
      <div class:wide={firstWide && index === 0}><dt>{name}</dt><dd>{value}</dd></div>
    {/each}
  </dl>
{/snippet}

{#snippet checkTable(heading: string, items: Check[])}
  <section class="ui-panel panel">
    <h2>{heading}</h2>
    <div class="check-list">
      {#each items as check}
        <div class="check-row">
          <h3>{check.name}</h3>
          <span class="ui-badge verdict" class:good={check.status === 'consistent' || check.status === 'not-detected'} class:warn={check.status === 'different' || check.status === 'detected'}>
            {t('browser.check.' + (check.status === 'not-detected' ? 'notDetected' : check.status))}
          </span>
          <p>{check.detail}</p>
        </div>
      {/each}
    </div>
  </section>
{/snippet}

<div class="browser-tool">
  <ToolHeading {title}>
    {#snippet icon()}<ModeIcon />{/snippet}
    <button class="ui-button" type="button" onclick={run} disabled={!ready || busy} aria-busy={busy}><RefreshCw size={14} aria-hidden="true" /> {t(busy ? 'common.checking' : 'common.runAgain')}</button>
  </ToolHeading>
  <nav aria-label={t('common.environmentChecks')}>
    {#each tabs as tab}
      <a href={localizedPath('/browser/' + tab.path, locale)} aria-current={mode === tab.path ? 'page' : undefined}>{tab.label}</a>
    {/each}
  </nav>
  {#if error}<p class="error" role="alert">{error}</p>{/if}
  {#if !ready || (busy && mode === 'checks' && !checks.length && !automation.length)}
    <p class="ui-panel pending" role="status">{t('common.checking')}</p>
  {:else if mode === 'checks'}
    {@render checkTable(t('common.consistency'), checks)}
    {@render checkTable(t('common.automation'), automation)}
    <section class="ui-panel panel">
      <div class="heading"><h2>{t('browser.deep.deepBrowserDiagnostics')}</h2><button class="ui-button" type="button" onclick={runDeep} disabled={deepBusy} aria-busy={deepBusy}>{t(deepBusy ? 'common.checking' : 'common.runAgain')}</button></div>
      {#if deep}
        <p class="notice" class:warn={flagged.length > 0} role="status">{flagged.length ? t('browser.deep.modulesWithSignals', [flagged.length]) : unavailable.length || readErrors ? t('browser.deep.completedChecksFoundUnusualSignalsButResultsIncomplete') : t('browser.deep.noUnusualSignalsFoundInThisCheck')}</p>
        <p>{flagged.length ? flagged.map(module => fieldLabel(module.name)).join('、') + t('browser.deep.multipleModulesReportSameCauseTheseNecessarilyIndependent') : t('browser.deep.conclusionCoversChecksPerformedProofBrowserAuthenticitySecurity')}</p>
        {#if readErrors}<p>{readErrors.report.summary}</p>{/if}
        {#if unavailable.length}<p>{t('browser.deep.unableToCheck')}{unavailable.map(module => fieldLabel(module.name)).join('、')}</p>{/if}
        <p class="technical">{deep.duration} ms · {deep.commit.slice(0, 12)}</p>
        {#each reports as module}
          <details>
            <summary><strong>{fieldLabel(module.name)}</strong><span>{module.report.status} · {module.report.summary}</span></summary>
            {#if module.report.issues.length}<ul>{#each module.report.issues as issue}<li>{issue}</li>{/each}</ul>{/if}
            <ResultValue value={parseDetail(module.detail)} />
            <details class="raw"><summary><strong>{t('browser.results.viewRawJson')}</strong></summary><pre>{module.detail}</pre></details>
          </details>
        {/each}
      {/if}
    </section>
  {:else}
    <section class="ui-panel panel" aria-label={title}>
      {#if mode === 'environment'}
        {@render facts(rows, true)}
    {:else if mode === 'fingerprint'}
      <label class="algorithm">{t('browser.algorithm')} <select class="ui-input" bind:value={algorithm} onchange={run} disabled={busy}><option value="modern">FingerprintJS (5.3.0)</option><option value="tls">JA3 / JA4</option></select></label>
      {#if algorithm === 'modern' && fp}
        {@render facts([['FingerprintJS', fp.visitorId], [t('browser.fingerprintjsVersion'), fp.version], [t('browser.comparedWithPreviousResult'), previous ? t(previous.visitorId === fp.visitorId ? 'browser.same' : 'browser.changed') : t('browser.noPreviousResult')]], true)}
        <p>{t('browser.matchingIdentifiersDoProveSameDeviceFingerprintCaptcha')}</p>
        <h2 class="fingerprint-heading">{t('browser.fingerprintComponents')}</h2>
        {#each fp.components.filter(component => hasResultValue(parseDetail(component.detail))) as component}
          {@const before = previous?.components.find(item => item.name === component.name)}
          <details>
            <summary><strong>{fieldLabel(component.name)}</strong><span>{fingerprintSummary(component.name, parseDetail(component.detail))}</span>{#if before}<span class="ui-badge comparison">{t(before.value === component.value ? 'browser.same' : 'browser.change')}</span>{/if}</summary>
            <p>{t('browser.results.fingerprintSummary')}: {component.value}</p>
            <ResultValue value={parseDetail(component.detail)} />
            <details class="raw"><summary><strong>{t('browser.results.viewRawJson')}</strong></summary><pre>{component.detail}</pre></details>
          </details>
        {/each}
      {:else if algorithm === 'tls' && tls}
        {@render facts(Object.entries(tls).map(([key, value]) => [key, value ?? t('browser.notProvidedByPlatform')]))}
      {:else if busy}
        <p role="status">{t('common.checking')}</p>
      {/if}
    {:else}
      {@render facts([
        ...permissions,
        [t('browser.secureContext'), isSecureContext ? t('common.yes') : t('common.no')],
        ['WebGPU', 'gpu' in navigator ? t('browser.apiSupported') : t('common.unsupported')],
        ['IndexedDB', 'indexedDB' in window ? t('browser.apiSupported') : t('common.unsupported')],
        ['Service Worker', 'serviceWorker' in navigator ? t('browser.apiSupported') : t('common.unsupported')],
        ['DNT', navigator.doNotTrack ?? t('browser.notSet')],
        ['GPC', String((navigator as BrowserNavigator).globalPrivacyControl ?? t('common.notProvided'))]
      ])}
      <div class="actions">
        <button class="ui-button" type="button" disabled={busy || !navigator.geolocation} onclick={locate}>{t('browser.testLocation')}</button>
        <button class="ui-button" type="button" disabled={busy || !navigator.mediaDevices?.getUserMedia} onclick={() => media('camera')}>{t('browser.testCameraPermission')}</button>
        <button class="ui-button" type="button" disabled={busy || !navigator.mediaDevices?.getUserMedia} onclick={() => media('microphone')}>{t('browser.testMicrophonePermission')}</button>
      </div>
      <p role="status">{message || t('browser.permissionsRequestedAfterClickingMediaStreamsCloseAfter')}</p>
      {/if}
    </section>
    {#if mode === 'privacy'}<WebRtc embedded />{/if}
  {/if}
</div>

<style>
  .browser-tool { display: grid; gap: .9rem; }
  .heading, .actions { display: flex; align-items: center; flex-wrap: wrap; gap: .5rem; }
  .heading { justify-content: space-between; }
  h2, h3 { margin: 0; }
  h2 { font-size: 1rem; }
  h3 { font-size: .82rem; font-weight: 600; overflow-wrap: anywhere; }
  nav { display: flex; gap: .25rem; padding: .25rem; overflow-x: auto; width: fit-content; max-width: 100%; border-radius: .75rem; background: var(--card); }
  nav a {
    padding: .45rem .8rem;
    border-radius: .45rem;
    color: var(--muted-foreground);
    font-size: .8rem;
    white-space: nowrap;
    text-decoration: none;
  }
  nav a:hover { background: var(--muted); }
  nav a[aria-current='page'] { background: var(--primary-soft); color: var(--primary); font-weight: 650; }
  .panel { min-width: 0; padding: clamp(1rem, 2vw, 1.2rem); }
  .panel > p, .pending, .error { font-size: .8rem; line-height: 1.6; overflow-wrap: anywhere; }
  .panel > p { margin: .65rem 0 0; color: var(--muted-foreground); }
  .pending, .error { margin: 0; }
  .pending { color: var(--muted-foreground); }
  .error { padding: .65rem .85rem; border-radius: .5rem; color: var(--danger); background: color-mix(in srgb, var(--danger) 9%, var(--card)); }
  .facts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .3rem 1rem; margin: 0; }
  .facts > div { min-width: 0; padding: .58rem .1rem; border-bottom: 1px solid color-mix(in srgb, var(--border) 65%, transparent); }
  .facts .wide { grid-column: 1 / -1; margin-bottom: .25rem; padding: .72rem .9rem; border: 0; border-radius: .65rem; background: var(--muted); }
  dt { color: var(--muted-foreground); font-size: .73rem; overflow-wrap: anywhere; }
  dd { margin: .22rem 0 0; font-size: .85rem; font-weight: 550; overflow-wrap: anywhere; }
  .wide dd, .technical { font-family: ui-monospace, monospace; }
  .actions { margin-top: .75rem; }
  .algorithm { display: flex; align-items: center; flex-wrap: wrap; gap: .55rem; margin-bottom: .75rem; color: var(--muted-foreground); font-size: .8rem; }
  .algorithm select { width: auto; }
  .fingerprint-heading { margin: .85rem 0 .35rem; }
  .check-list { margin-top: .4rem; }
  .check-row { display: grid; grid-template-columns: minmax(7rem, .8fr) minmax(5rem, .6fr) minmax(0, 1.6fr); align-items: start; gap: .65rem; padding: .65rem 0; }
  .check-row + .check-row, details { border-top: 1px solid color-mix(in srgb, var(--border) 65%, transparent); }
  .check-row p { margin: 0; color: var(--muted-foreground); font-size: .8rem; overflow-wrap: anywhere; }
  .verdict { justify-self: start; color: var(--muted-foreground); }
  .verdict.good { color: var(--success); background: color-mix(in srgb, var(--success) 10%, var(--card)); }
  .verdict.warn, .panel > .notice.warn { color: var(--warning); background: color-mix(in srgb, var(--warning) 10%, var(--card)); }
  .notice { padding: .5rem .6rem; border-radius: .42rem; background: var(--muted); font-weight: 550; }
  details { margin-top: .1rem; }
  details p, details ul { color: var(--muted-foreground); font-size: .8rem; overflow-wrap: anywhere; }
  summary {
    display: grid;
    grid-template-columns: minmax(6rem, .75fr) minmax(0, 1.25fr) auto auto;
    gap: .55rem;
    align-items: baseline;
    padding: .5rem .1rem;
    cursor: pointer;
    list-style: none;
    font-size: .8rem;
    overflow-wrap: anywhere;
  }
  summary::-webkit-details-marker { display: none; }
  summary::after { grid-column: -2; content: '›'; color: var(--muted-foreground); justify-self: end; }
  details[open] > summary::after { transform: rotate(90deg); }
  summary:hover strong { color: var(--primary); }
  summary > span:not(.comparison) { color: var(--muted-foreground); }
  summary > strong { font-weight: 550; }
  .comparison { justify-self: end; }
  .raw summary { grid-template-columns: 1fr auto; }
  pre { max-height: 24rem; overflow: auto; padding: .65rem; border-radius: .4rem; background: var(--muted); white-space: pre-wrap; overflow-wrap: anywhere; font-size: .76rem; }
  @media (max-width: 580px) {
    nav a { padding-inline: .6rem; }
    .facts { column-gap: .65rem; }
    .check-row { grid-template-columns: minmax(0, 1fr) auto; gap: .25rem .55rem; }
    .check-row p { grid-column: 1 / -1; }
    summary { grid-template-columns: minmax(0, 1fr) auto auto; }
    summary > span:not(.comparison) { grid-column: 1 / 2; grid-row: 2; }
  }
</style>
