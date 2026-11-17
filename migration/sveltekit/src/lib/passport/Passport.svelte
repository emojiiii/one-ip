<script lang="ts">
  import { onMount } from 'svelte';
  import ContactRound from '@lucide/svelte/icons/contact-round';
  import Download from '@lucide/svelte/icons/download';
  import Share2 from '@lucide/svelte/icons/share-2';
  import RefreshCw from '@lucide/svelte/icons/refresh-cw';
  import ToolHeading from '../ToolHeading.svelte';
  import { localizedPath, type Locale } from '../i18n';
  import type { Geo } from '../ip/types';
  import { getGeo, getMyIp } from '../../routes/leak/webrtc/home-api';
  import { countryFlag } from './flag';
  import { travelerProfile } from './traveler';
  import { passportReputation } from './reputation';
  import { getPassportText, passportFormat } from './locales';
  import type { RoutingSummary } from './routing';

  let { locale }: { locale: Locale } = $props();

  const text = $derived(getPassportText(locale).ui);
  let geo = $state<Geo>();
  let networkState = $state<'loading' | 'ready' | 'failed'>('loading');
  let browser = $state('');
  let system = $state('');
  let browserLanguage = $state('');
  let timezone = $state('');
  let screenSize = $state('');
  let processors = $state('');
  let error = $state('');
  let sharingAvailable = $state(false);
  let siteAddress = $state('');
  let flag = $state<string>();
  let siteOrigin = $state('');
  let profile = $state<Awaited<ReturnType<typeof travelerProfile>>>();
  let profileState = $state<'loading' | 'ready' | 'failed'>('loading');
  let scoreKnown = $state(false);
  let typeKnown = $state(false);
  let routing = $state<RoutingSummary>();
  let routingState = $state<'loading' | 'ready' | 'failed'>('loading');
  let controller: AbortController;

  const place = $derived(networkState === 'loading' ? text.loading : geo?.country_code && /^[A-Za-z]{2}$/.test(geo.country_code) ? new Intl.DisplayNames([locale], { type: 'region' }).of(geo.country_code.toUpperCase()) || geo.country || geo.country_code : geo?.country || text.unknown);
  const provider = $derived(networkState === 'loading' ? text.loading : geo?.isp || text.unknown);
  const displayBadges = $derived(profile ? [...profile.badges, ...(!scoreKnown ? [{ id: 'reputation-unknown', label: text.unknownReputation, detail: text.unknownReputationDetail }] : [])] : []);
  const cardLoading = $derived(networkState === 'loading' || profileState === 'loading' || routingState === 'loading');
  const exitRelation = $derived(routing?.comparison === 'same' ? text.sameExit : routing?.comparison === 'different' ? text.differentExit : text.unknownExit);
  const probeSummary = $derived(routing
    ? `${text.domesticProbe} ${routing.domestic.status === 'observed' ? (routing.domestic.countryCode || routing.domestic.country || text.observedRegionUnknown) : text.unknown} · ${text.overseasProbe} ${routing.overseas.status === 'observed' ? (routing.overseas.countryCode || routing.overseas.country || text.observedRegionUnknown) : text.unknown} · ${exitRelation}`
    : routingState === 'failed' ? text.routingFailed : text.routingLoading);
  const sitesSummary = $derived(routing ? passportFormat(text.sitesSummary, { observed: routing.sites.observed, attempted: routing.sites.attempted, total: routing.sites.total, unavailable: routing.sites.unavailable, notAttempted: routing.sites.notAttempted, unsupported: routing.sites.unsupported }) : '');
  const familySummary = $derived(routing ? passportFormat(text.familySummary, { ipv4Observed: routing.sites.ipv4Observed, ipv4Exits: routing.sites.ipv4Exits, ipv6Observed: routing.sites.ipv6Observed, ipv6Exits: routing.sites.ipv6Exits }) : '');
  const groupsSummary = $derived(routing ? passportFormat(text.groupsSummary, { domestic: routing.sites.domesticMatches, overseas: routing.sites.overseasMatches, both: routing.sites.bothMatches, other: routing.sites.otherMatches, unclassified: routing.sites.unclassified }) : '');

  function browserName(ua: string) {
    if (/Edg(?:e|A|iOS)?\//.test(ua)) return 'Microsoft Edge';
    if (/OPR\//.test(ua)) return 'Opera';
    if (/Firefox\/|FxiOS\//.test(ua)) return 'Firefox';
    if (/Chrome\/|CriOS\//.test(ua)) return 'Chrome';
    if (/Safari\//.test(ua)) return 'Safari';
    return '';
  }
  function systemName(ua: string) {
    if (/iPhone|iPad|iPod/.test(ua)) return 'iOS / iPadOS';
    if (/Android/.test(ua)) return 'Android';
    if (/Windows/.test(ua)) return 'Windows';
    if (/Mac OS X|Macintosh/.test(ua)) return 'macOS';
    if (/Linux/.test(ua)) return 'Linux';
    return '';
  }
  async function refresh() {
    controller?.abort();
    controller = new AbortController();
    const signal = controller.signal;
    geo = undefined;
    flag = undefined;
    profile = undefined;
    scoreKnown = false;
    typeKnown = false;
    routing = undefined;
    routingState = 'loading';
    profileState = 'loading';
    networkState = 'loading';
    error = '';
    let reputation: Awaited<ReturnType<typeof passportReputation>> | undefined;
    let routingResult: RoutingSummary | undefined;
    let baseReady = false;
    let profileRevision = 0;
    async function updateProfile() {
      const revision = ++profileRevision;
      const currentRouting = routingResult;
      try {
        const nextProfile = await travelerProfile({ countryCode: geo?.country_code, timeZone: timezone, language: browserLanguage, locale, ...reputation, routing: currentRouting });
        if (signal.aborted || revision !== profileRevision) return;
        profile = nextProfile;
        profileState = 'ready';
        if (currentRouting) {
          routing = currentRouting;
          routingState = 'ready';
        }
      } catch {
        if (!signal.aborted && revision === profileRevision) {
          profileState = 'failed';
          if (currentRouting) {
            routing = currentRouting;
            routingState = 'ready';
          }
        }
      }
    }
    void import('./routing')
      .then(({ collectRouting }) => collectRouting(signal))
      .then((result) => {
        if (signal.aborted) return;
        routingResult = result;
        if (baseReady) void updateProfile();
      })
      .catch(() => {
        if (!signal.aborted) routingState = 'failed';
      });
    try {
      const exit = await getMyIp(AbortSignal.any([signal, AbortSignal.timeout(5000)]));
      const reputationRequest = exit.ip ? passportReputation(exit.ip, signal).catch(() => undefined) : Promise.resolve(undefined);
      geo = exit;
      if (exit.ip && (!exit.country || !exit.isp)) {
        try {
          const details = await getGeo(exit.ip, signal);
          geo = { ...exit, ...details, country: details.country || exit.country, country_code: details.country_code || exit.country_code, isp: details.isp || exit.isp };
        } catch {
          signal.throwIfAborted();
        }
      }
      try {
        const nextFlag = await countryFlag(geo.country_code);
        signal.throwIfAborted();
        flag = nextFlag;
      } catch {
        signal.throwIfAborted();
        error = text.flagFailed;
      }
      reputation = await reputationRequest;
      signal.throwIfAborted();
      scoreKnown = reputation?.reputationScore !== undefined;
      typeKnown = reputation?.exitType !== undefined;
      networkState = 'ready';
    } catch {
      if (!signal.aborted) networkState = 'failed';
    }
    if (signal.aborted) return;
    baseReady = true;
    await updateProfile();
  }
  onMount(() => {
    const ua = navigator.userAgent;
    browser = browserName(ua);
    system = systemName(ua);
    browserLanguage = navigator.language;
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    screenSize = `${window.screen.width} × ${window.screen.height}`;
    processors = navigator.hardwareConcurrency ? String(navigator.hardwareConcurrency) : '';
    siteAddress = window.location.host;
    siteOrigin = window.location.origin;
    sharingAvailable = typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [new File([''], 'passport.png', { type: 'image/png' })] });
    void refresh();
    return () => controller.abort();
  });

  let passportArt: SVGSVGElement;

  function short(value: string, limit: number) {
    const chars = Array.from(value);
    return chars.length > limit ? `${chars.slice(0, limit - 1).join('')}…` : value;
  }

  function coverTitleLines(value: string) {
    const title = value.trim();
    if (Array.from(title).length <= 15) return [title];
    const separators = [...title.matchAll(/[\s，、,;；。—]/gu)]
      .map((match) => ({ index: match.index!, length: match[0].length, keep: !/\s/u.test(match[0]) }))
      .filter(({ index, length }) => index > 3 && index + length < title.length - 3);
    if (!separators.length) return [title];
    const middle = title.length / 2;
    const split = separators.reduce((best, current) =>
      Math.abs(current.index - middle) < Math.abs(best.index - middle) ? current : best);
    return [title.slice(0, split.index + (split.keep ? split.length : 0)).trim(), title.slice(split.index + split.length).trim()];
  }

  const coverTitle = $derived(profile?.title || (profileState === 'loading' ? text.travelerLoading : text.travelerFailed));
  const coverLines = $derived(coverTitleLines(coverTitle));

  function descriptionLines(value: string) {
    const chars = Array.from(value);
    if (chars.length <= 70) return [value];
    const first = chars.slice(0, 70).join('');
    const breakAt = first.lastIndexOf(' ');
    const splitAt = breakAt > 30 ? breakAt : 70;
    return [chars.slice(0, splitAt).join('').trim(), short(chars.slice(splitAt).join('').trim(), 80)];
  }

  function badgeLines(value: string) {
    const chars = Array.from(value);
    if (chars.length <= 25) return [value];
    const first = chars.slice(0, 25).join('');
    const breakAt = first.lastIndexOf(' ');
    const splitAt = breakAt > 12 ? breakAt : 25;
    return [chars.slice(0, splitAt).join('').trim(), short(chars.slice(splitAt).join('').trim(), 25)];
  }

  function siteResult(site: RoutingSummary['sites']['details'][number]) {
    if (site.status === 'unavailable') return text.siteUnavailable;
    if (site.status === 'unsupported') return text.siteUnsupported;
    if (site.status === 'not-attempted') return text.siteNotAttempted;
    const names = { domestic: text.routeDomestic, overseas: text.routeOverseas, both: text.routeBoth, other: text.routeOther, unknown: text.routeUnknown };
    return `${names[site.route]}${site.family ? ` · IPv${site.family}` : ''}`;
  }

  function siteName(name: string) {
    if (locale === 'zh-CN') return name;
    const names: Record<string, string> = {
      '网易': 'NetEase',
      '字节跳动': 'ByteDance',
      'Cloudflare中国': `Cloudflare (${new Intl.DisplayNames([locale], { type: 'region' }).of('CN')})`,
    };
    return names[name] || name;
  }

  async function imageBlob(): Promise<Blob> {
    await document.fonts.ready;
    const svg = new XMLSerializer().serializeToString(passportArt);
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = 1400;
      canvas.height = 1520;
      canvas.getContext('2d')!.drawImage(image, 0, 0);
      return await new Promise((resolve, reject) => canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error('Canvas export failed')), 'image/png',
      ));
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  async function saveCard() {
    error = '';
    try {
      const blob = await imageBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'one-ip-passport.png';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { error = text.saveFailed; }
  }
  async function shareCard() {
    error = '';
    try {
      const file = new File([await imageBlob()], 'one-ip-passport.png', { type: 'image/png' });
      if (navigator.canShare({ files: [file] })) await navigator.share({ title: text.title, url: new URL(localizedPath('/passport', locale), window.location.origin).href, files: [file] });
      else error = text.shareFailed;
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) error = text.shareFailed;
    }
  }
  const xShareUrl = $derived(siteOrigin ? `https://twitter.com/intent/tweet?${new URLSearchParams({
    text: text.xPostText.replace('{title}', profile?.title || text.traveler),
    url: new URL(localizedPath('/passport', locale), siteOrigin).href,
  })}` : '');
</script>

<svelte:head><title>{text.title} · One IP</title></svelte:head>

<div class="passport-page">
  <ToolHeading title={text.title} description={text.description}>
    {#snippet icon()}<ContactRound />{/snippet}
  </ToolHeading>
  <div class="layout">
    <article class="passport" aria-label={text.title}>
      <svg bind:this={passportArt} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1400 1520" direction="ltr" role="img" aria-label={`${text.title} · ${text.location}: ${place} · ${text.network}: ${provider} · ${text.browser}: ${browser || text.unknown} · ${text.device}: ${system || text.unknown} · ${text.language}: ${browserLanguage || text.unknown} · ${text.timezone}: ${timezone || text.unknown} · ${text.screen}: ${screenSize || text.unknown} · ${text.processors}: ${processors || text.unknown} · ${text.routing}: ${probeSummary} · ${sitesSummary} · ${familySummary} · ${groupsSummary} · ${text.traveler}: ${profile?.title || (profileState === 'loading' ? text.travelerLoading : text.travelerFailed)}${profile ? ` · ${profile.description} · ${profile.basis} · ${displayBadges.map(badge => `${badge.label}: ${badge.detail}`).join(' · ')}` : ''}`}>
        <defs>
          <linearGradient id="passport-background" x2="1" y2="1"><stop stop-color="#d9c8b5"/><stop offset="1" stop-color="#b59f8e"/></linearGradient>
          <linearGradient id="passport-cover" x2="1" y2="1"><stop stop-color="#5d283b"/><stop offset=".55" stop-color="#43202f"/><stop offset="1" stop-color="#321723"/></linearGradient>
          <linearGradient id="passport-paper" x2="1" y2="1"><stop stop-color="#fbf7ec"/><stop offset="1" stop-color="#eee4d1"/></linearGradient>
          <linearGradient id="passport-fold"><stop stop-color="#2d1720" stop-opacity=".3"/><stop offset=".5" stop-color="#6d4c45" stop-opacity=".14"/><stop offset="1" stop-color="#6d4c45" stop-opacity="0"/></linearGradient>
          <pattern id="passport-grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="#9d815f" stroke-opacity=".085" stroke-width="1"/></pattern>
          <clipPath id="passport-clip"><rect x="62" y="60" width="1276" height="1400" rx="18"/></clipPath>
        </defs>
        <rect width="1400" height="1520" fill="url(#passport-background)"/>
        <rect x="64" y="72" width="1278" height="1400" rx="19" fill="#38241c" opacity=".18"/>
        <g clip-path="url(#passport-clip)">
          <rect x="62" y="60" width="442" height="1400" fill="url(#passport-cover)"/>
          <rect x="504" y="60" width="834" height="1400" fill="url(#passport-paper)"/>
          <rect x="504" y="60" width="834" height="1400" fill="url(#passport-grid)"/>
          <rect x="487" y="60" width="45" height="1400" fill="url(#passport-fold)"/>
          <rect x="82" y="80" width="400" height="1360" rx="4" fill="none" stroke="#c6a274" stroke-opacity=".5"/>
          <rect x="91" y="89" width="382" height="1342" rx="2" fill="none" stroke="#c6a274" stroke-opacity=".22"/>
          <g fill="#dfc6a0" font-family="Georgia, 'Times New Roman', serif" text-anchor="middle">
            <text x="282" y="164" font-size="19" letter-spacing="5">ONE IP</text>
            <text x="282" y="194" font-size="10" letter-spacing="3.1">THE INTERNET TRAVEL CLUB</text>
            <text x="282" y="585" font-size="33" letter-spacing="4">PASSPORT</text>
            <text x="282" y="619" font-size="12" letter-spacing="3">DIGITAL EDITION</text>
          </g>
          <g transform="translate(282 378)" fill="none" stroke="#dfc6a0" stroke-width="2" opacity=".88">
            <circle r="99"/><circle r="89"/><circle r="65"/><ellipse rx="32" ry="65"/><path d="M-65 0H65 M-56 -32H56 M-56 32H56 M0 -65V65"/>
            <path d="M-112 -7 L-102 -7 M102 -7 L112 -7 M-112 7 L-102 7 M102 7 L112 7"/>
            <path d="M-28 123 L28 123 M-18 130 L18 130"/>
          </g>
          <g aria-hidden="true">
            <path d="M170 763 C211 707 248 827 298 773 S370 735 397 758" fill="none" stroke="#dfc6a0" stroke-width="2" stroke-dasharray="3 8" opacity=".68"/>
            <g transform="translate(160 770) rotate(-13)" fill="none" stroke="#dfc6a0" opacity=".8">
              <circle r="32" stroke-width="1.5"/><circle r="26" stroke-width=".8"/><circle r="16" stroke-width="1.2"/><ellipse rx="7" ry="16"/><path d="M-16 0H16 M0 -16V16"/>
            </g>
            <g transform="translate(400 759) rotate(13)" fill="none" stroke="#dfc6a0" opacity=".8">
              <circle r="29" stroke-width="1.5"/><circle r="23" stroke-width=".8"/><path d="M0 -15 L4 -4 L15 0 L4 4 L0 15 L-4 4 L-15 0 L-4 -4Z" stroke-width="1.3"/>
            </g>
            <g fill="#dfc6a0" opacity=".75"><circle cx="233" cy="755" r="2"/><circle cx="337" cy="754" r="2"/><path d="M271 720v12m-6-6h12 M344 807v10m-5-5h10" stroke="#dfc6a0" stroke-width="1"/></g>
            <rect x="112" y="861" width="340" height="196" rx="11" fill="#794459" fill-opacity=".34" stroke="#dfc6a0" stroke-opacity=".65" stroke-width="1.5"/>
            <rect x="121" y="870" width="322" height="178" rx="6" fill="none" stroke="#dfc6a0" stroke-opacity=".25"/>
            <g text-anchor="middle" font-family="system-ui, sans-serif" fill="#f0dabc" direction={locale === 'ar' ? 'rtl' : 'ltr'}>
              <text x="282" y="905" font-size="11" font-weight="650" letter-spacing="1" textLength={Array.from(text.traveler).length > 26 ? 260 : undefined} lengthAdjust="spacingAndGlyphs">{text.traveler}</text>
              <path d="M237 921H327" stroke="#dfc6a0" stroke-opacity=".45"/>
              {#each coverLines as line, index}
                <text x="282" y={coverLines.length === 1 ? 982 : 970 + index * 34} font-size="23" font-weight="700" textLength={Array.from(line).length > (['zh-CN', 'ja', 'ko'].includes(locale) ? 13 : 23) ? 305 : undefined} lengthAdjust="spacingAndGlyphs">{line}</text>
              {/each}
            </g>
            <g transform="translate(282 1166) rotate(-9)" fill="none" stroke="#dfc6a0" opacity=".55">
              <circle r="46" stroke-width="1.5" stroke-dasharray="3 4"/><circle r="36" stroke-width="1"/>
              <path d="M-18 2 C-10 -12 -3 14 6 0 S19 -10 25 -3 M-3 -19v38 M-19 0h38" stroke-width="1.2"/>
            </g>
            <g transform="translate(252 1280)" fill="none" stroke="#dfc6a0" stroke-width="1.5" opacity=".65">
              <rect width="60" height="39" rx="6"/><circle cx="30" cy="19.5" r="10"/><path d="M0 19.5h20m20 0h20"/>
            </g>
          </g>
          <text x="282" y="1370" text-anchor="middle" fill="#dfc6a0" fill-opacity=".65" font-family="Georgia, 'Times New Roman', serif" font-size="10" letter-spacing="2">ONE IP · DIGITAL PASSPORT</text>
          <g fill="#71594c" font-family="system-ui, sans-serif" font-size="13" font-weight="600" letter-spacing="2.2">
            <text x="565" y="130">ONE IP / DIGITAL PASSPORT</text><text x="1275" y="130" text-anchor="end">EST. FOR THE INTERNET</text>
          </g>
          <path d="M565 150 H1275" stroke="#9a7864" stroke-opacity=".4"/>
          <text x="565" y="204" fill="#aa5f4c" font-family="system-ui, sans-serif" font-size="12" font-weight="700" letter-spacing="2.4">NETWORK TRAVEL DOCUMENT</text>
          <text x="565" y="258" fill="#302b2a" font-family="Georgia, 'Times New Roman', serif" font-size="48" font-weight="700">{text.name}</text>
          <text x="565" y="297" fill="#776a5f" font-family="system-ui, sans-serif" font-size="15">{text.mark}</text>
          <g transform="translate(1152 259) rotate(-12)" fill="none" stroke="#ae6c59" opacity=".65">
            <circle r="72" stroke-width="2"/><circle r="62" stroke-width="1"/><circle r="37" stroke-width="1.5"/><ellipse rx="17" ry="37" stroke-width="1"/><path d="M-37 0H37 M0 -37V37" stroke-width="1"/>
            <text y="-46" text-anchor="middle" fill="#ae6c59" stroke="none" font-family="system-ui, sans-serif" font-size="8" font-weight="700" letter-spacing="1">ONE IP • NETWORK</text>
            <text y="53" text-anchor="middle" fill="#ae6c59" stroke="none" font-family="system-ui, sans-serif" font-size="8" font-weight="700" letter-spacing="1">DIGITAL TRAVELER</text>
          </g>
          <path d="M565 325 H1275" stroke="#9a7864" stroke-opacity=".35"/>
          <g font-family="system-ui, sans-serif">
            <text x="565" y="367" fill="#9b6c5b" font-size="13" font-weight="650" letter-spacing="1.6">{text.location.toUpperCase()}</text>
            {#if flag}<image href={flag} x="565" y="382" width="62" height="42" preserveAspectRatio="xMidYMid meet"/>{/if}
            <text x={flag ? 645 : 565} y="414" fill="#342c2a" font-family="Georgia, 'Times New Roman', serif" font-size="38" font-weight="700" textLength={Array.from(place).length > 25 ? (flag ? 590 : 670) : undefined} lengthAdjust="spacingAndGlyphs">{short(place, 42)}</text>
            <text x="565" y="458" fill="#9b6c5b" font-size="13" font-weight="650" letter-spacing="1.6">{text.network.toUpperCase()}</text>
            <text x="565" y="492" fill="#453c37" font-size="24" textLength={Array.from(provider).length > 34 ? 610 : undefined} lengthAdjust="spacingAndGlyphs">{short(provider, 52)}</text>
          </g>
          <path d="M565 524 H1275" stroke="#9a7864" stroke-opacity=".35"/>
          <g font-family="system-ui, sans-serif">
            <g fill="#9b6c5b" font-size="12" font-weight="650" letter-spacing="1"><text x="565" y="562">{text.browser.toUpperCase()}</text><text x="805" y="562">{text.device.toUpperCase()}</text><text x="1045" y="562">{text.language.toUpperCase()}</text><text x="565" y="636">{text.timezone.toUpperCase()}</text><text x="805" y="636">{text.screen.toUpperCase()}</text><text x="1045" y="636">{text.processors.toUpperCase()}</text></g>
            <g fill="#453c37" font-size="21" font-weight="600">
              <text x="565" y="594" textLength={Array.from(browser).length > 18 ? 210 : undefined} lengthAdjust="spacingAndGlyphs">{short(browser || text.unknown, 26)}</text>
              <text x="805" y="594" textLength={Array.from(system).length > 18 ? 210 : undefined} lengthAdjust="spacingAndGlyphs">{short(system || text.unknown, 26)}</text>
              <text x="1045" y="594" textLength={Array.from(browserLanguage).length > 18 ? 210 : undefined} lengthAdjust="spacingAndGlyphs">{short(browserLanguage || text.unknown, 26)}</text>
              <text x="565" y="668" textLength={Array.from(timezone).length > 18 ? 210 : undefined} lengthAdjust="spacingAndGlyphs">{short(timezone || text.unknown, 26)}</text>
              <text x="805" y="668">{screenSize || text.unknown}</text>
              <text x="1045" y="668">{processors || text.unknown}</text>
            </g>
          </g>
          <path d="M565 704 H1275" stroke="#9a7864" stroke-opacity=".35"/>
          <text x="565" y="735" fill="#9b6c5b" font-family="system-ui, sans-serif" font-size="12" font-weight="650" letter-spacing="1">{text.routing.toUpperCase()}</text>
          <text x="565" y="765" fill="#453c37" font-family="system-ui, sans-serif" font-size="14" font-weight="600" textLength={Array.from(probeSummary).length > 65 ? 710 : undefined} lengthAdjust="spacingAndGlyphs">{short(probeSummary, 100)}</text>
          {#if routing}
            <text x="565" y="791" fill="#806f60" font-family="system-ui, sans-serif" font-size="13" textLength={Array.from(sitesSummary).length > 70 ? 710 : undefined} lengthAdjust="spacingAndGlyphs">{short(sitesSummary, 110)}</text>
            <text x="565" y="817" fill="#806f60" font-family="system-ui, sans-serif" font-size="13" textLength={Array.from(familySummary).length > 70 ? 710 : undefined} lengthAdjust="spacingAndGlyphs">{short(familySummary, 100)}</text>
            <text x="565" y="843" fill="#806f60" font-family="system-ui, sans-serif" font-size="13" textLength={Array.from(groupsSummary).length > 70 ? 710 : undefined} lengthAdjust="spacingAndGlyphs">{short(groupsSummary, 110)}</text>
          {/if}
          <path d="M565 868 H1275" stroke="#9a7864" stroke-opacity=".35"/>
          <text x="565" y="900" fill="#9b6c5b" font-family="system-ui, sans-serif" font-size="12" font-weight="650" letter-spacing="1">{text.traveler.toUpperCase()}</text>
          <text x="565" y="940" fill="#342c2a" font-family="Georgia, 'Times New Roman', serif" font-size="30" font-weight="700" textLength={Array.from(profile?.title || '').length > 30 ? 710 : undefined} lengthAdjust="spacingAndGlyphs">{short(profile?.title || (profileState === 'loading' ? text.travelerLoading : text.travelerFailed), 44)}</text>
          {#if profile}
            <text x="565" y="975" fill="#453c37" font-family="system-ui, sans-serif" font-size="16">{#each descriptionLines(profile.description) as line, index}<tspan x="565" dy={index ? 23 : 0} textLength={Array.from(line).length > 65 ? 710 : undefined} lengthAdjust="spacingAndGlyphs">{line}</tspan>{/each}</text>
            <text x="565" y="1033" fill="#8a7b6b" font-family="system-ui, sans-serif" font-size="13" textLength={Array.from(profile.basis).length > 80 ? 710 : undefined} lengthAdjust="spacingAndGlyphs">{short(profile.basis, 105)}</text>
          {/if}
          <path d="M565 1054 H1275" stroke="#9a7864" stroke-opacity=".35"/>
          {#if displayBadges.length}
            <text x="565" y="1084" fill="#9b6c5b" font-family="system-ui, sans-serif" font-size="12" font-weight="650" letter-spacing="1">{text.badges}</text>
            {#each displayBadges as badge, index (badge.id)}
              <g transform={`translate(${565 + (index % 2) * 365} ${1102 + Math.floor(index / 2) * 82})`} font-family="system-ui, sans-serif">
                <rect width="345" height="74" rx="7" fill="#fffaf0" fill-opacity=".65" stroke="#b3947c" stroke-opacity=".38"/>
                <text x="13" y="24" fill="#664938" font-size="15" font-weight="700" textLength={Array.from(badge.label).length > 25 ? 317 : undefined} lengthAdjust="spacingAndGlyphs">{short(badge.label, 34)}</text>
                <text x="13" y="44" fill="#806f60" font-size="11">{#each badgeLines(badge.detail) as line, lineIndex}<tspan x="13" dy={lineIndex ? 15 : 0}>{line}</tspan>{/each}</text>
              </g>
            {/each}
          {/if}
          <path d="M565 1360 H1275" stroke="#9a7864" stroke-opacity=".35"/>
          <text x="565" y="1390" fill="#71594c" font-family="system-ui, sans-serif" font-size="12" font-weight="650" letter-spacing="1">ONE IP / {short(siteAddress, 33)}</text>
          <text x="565" y="1419" fill="#8a7b6b" font-family="system-ui, sans-serif" font-size="12">{text.footer}</text>
          <path d="M565 1442 H1275" stroke="#aa8f77" stroke-opacity=".36" stroke-dasharray="3 5"/>
        </g>
      </svg>
      <dl class="mobile-details" aria-hidden="true">
        <div><dt>{text.location}</dt><dd>{#if flag}<img src={flag} alt="" width="24" height="16" /> {/if}{place}</dd></div>
        <div><dt>{text.network}</dt><dd>{provider}</dd></div>
        <div><dt>{text.browser}</dt><dd>{browser || text.unknown}</dd></div>
        <div><dt>{text.device}</dt><dd>{system || text.unknown}</dd></div>
        <div><dt>{text.language}</dt><dd>{browserLanguage || text.unknown}</dd></div>
        <div><dt>{text.timezone}</dt><dd>{timezone || text.unknown}</dd></div>
        <div><dt>{text.screen}</dt><dd>{screenSize || text.unknown}</dd></div>
        <div><dt>{text.processors}</dt><dd>{processors || text.unknown}</dd></div>
      </dl>
      <div class="mobile-routing" aria-hidden="true">
        <span>{text.routing}</span>
        <strong>{probeSummary}</strong>
        {#if routing}<p>{sitesSummary}</p><p>{familySummary}</p><p>{groupsSummary}</p>{/if}
      </div>
      <div class="mobile-profile" aria-hidden="true">
        <span>{text.traveler}</span>
        <strong>{profile?.title || (profileState === 'loading' ? text.travelerLoading : text.travelerFailed)}</strong>
        {#if profile}
          <p>{profile.description}</p><small>{profile.basis}</small>
          {#if displayBadges.length}<div class="mobile-badges">{#each displayBadges as badge (badge.id)}<div><strong>{badge.label}</strong><small>{badge.detail}</small></div>{/each}</div>{/if}
        {/if}
      </div>
    </article>
    <div class="controls">
      <div class="actions">
        <button class="ui-button primary" type="button" onclick={saveCard} disabled={cardLoading}><Download size={16} aria-hidden="true" />{text.save}</button>
        {#if sharingAvailable}<button class="ui-button" type="button" onclick={shareCard} disabled={cardLoading}><Share2 size={16} aria-hidden="true" />{text.share}</button>{/if}
        {#if xShareUrl && !cardLoading}<a class="ui-button" href={xShareUrl} target="_blank" rel="noopener noreferrer" aria-describedby="x-share-hint">{text.shareX}</a>{:else}<button class="ui-button" type="button" disabled>{text.shareX}</button>{/if}
        <button class="ui-button" type="button" onclick={refresh} disabled={networkState === 'loading' || profileState === 'loading'}><RefreshCw size={16} aria-hidden="true" />{text.refresh}</button>
      </div>
      <p id="x-share-hint">{text.shareXHint}</p>
      <p>{text.footer}</p>
      <p>{text.source}</p>
      <p>{text.routeInfo}</p>
      {#if scoreKnown || typeKnown}<p>{text.reputationSource}</p>{/if}
      {#if networkState === 'failed'}<p role="status">{text.failed}</p>{/if}
      {#if profileState === 'failed'}<p role="status">{text.travelerFailed}</p>{/if}
      {#if error}<p role="alert">{error}</p>{/if}
      {#if routing}
        <details class="route-details">
          <summary>{text.routeDetails}</summary>
          <ul>{#each routing.sites.details as site (site.name)}<li><span dir="auto">{siteName(site.name)}</span><span>{siteResult(site)}</span></li>{/each}</ul>
        </details>
      {/if}
    </div>
  </div>
</div>

<style>
  .passport-page { display:grid; gap:18px; }
  .layout { display:grid; justify-items:center; gap:20px; }
  .passport { width:min(100%, 940px); overflow:hidden; border-radius:10px; background:#c8b6a4; box-shadow:0 18px 45px #35271d28; }
  .passport svg { display:block; width:100%; height:auto; }
  .mobile-details { display:none; }
  .mobile-routing { display:none; }
  .mobile-profile { display:none; }
  .controls { width:min(100%, 940px); }
  .actions { display:flex; flex-wrap:wrap; gap:8px; }
  .actions :is(button, a) { display:inline-flex; align-items:center; gap:7px; }
  .controls p { margin:10px 0 0; color:var(--muted-foreground); font-size:12px; line-height:1.5; }
  .controls p[role=alert] { color:var(--danger); }
  .route-details { margin-top:12px; font-size:13px; }
  .route-details summary { cursor:pointer; color:var(--primary); }
  .route-details ul { list-style:none; margin:8px 0 0; padding:0; display:grid; gap:6px; }
  .route-details li { display:flex; justify-content:space-between; gap:12px; padding:7px 9px; border:1px solid var(--border); border-radius:var(--control-radius); }
  .route-details li span:last-child { color:var(--muted-foreground); text-align:end; }
  @media (max-width: 600px) {
    .mobile-details { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:14px; margin:0; padding:18px; background:#f8f2e7; color:#453c37; }
    .mobile-details div { min-width:0; }
    .mobile-details dt { color:#936856; font-size:11px; }
    .mobile-details dd { margin:4px 0 0; font-size:13px; font-weight:600; overflow-wrap:anywhere; }
    .mobile-details dd img { vertical-align:middle; object-fit:contain; }
    .mobile-details div:nth-child(-n+2) { grid-column:1 / -1; }
    .mobile-routing { display:grid; gap:7px; padding:18px; background:#f8f2e7; color:#453c37; border-top:1px solid #9a786440; }
    .mobile-routing span { color:#936856; font-size:11px; }
    .mobile-routing strong { font-size:13px; line-height:1.5; overflow-wrap:anywhere; }
    .mobile-routing p { margin:0; color:#71594c; font-size:12px; line-height:1.5; overflow-wrap:anywhere; }
    .mobile-profile { display:grid; gap:7px; padding:18px; background:#f8f2e7; color:#453c37; border-top:1px solid #9a786440; }
    .mobile-profile span { color:#936856; font-size:11px; }
    .mobile-profile strong { font-size:18px; }
    .mobile-profile p { margin:0; font-size:13px; line-height:1.5; }
    .mobile-profile small { color:#8a7b6b; font-size:11px; line-height:1.5; overflow-wrap:anywhere; }
    .mobile-badges { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; margin-top:5px; }
    .mobile-badges div { display:grid; gap:4px; min-width:0; padding:10px; border:1px solid #b3947c61; border-radius:7px; background:#fffaf0a6; }
    .mobile-badges strong { font-size:13px; overflow-wrap:anywhere; }
  }
</style>
