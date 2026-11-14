<script lang="ts">
  import { page } from "$app/state";
  import { localeFromPath, localizedPath } from "../lib/i18n";
  import { onMount } from "svelte";
  import Globe from "@lucide/svelte/icons/globe";
  import Router from "@lucide/svelte/icons/router";
  import RefreshCw from "@lucide/svelte/icons/refresh-cw";
  import type { HttpEgress } from "./leak/webrtc/http-egress";
  import { getBrowserIp, getGeo } from "./leak/webrtc/home-api";
  import { trace } from "./leak/webrtc/network";
  import { getDomesticIp, homeExitCards } from "../lib/ip/home";
  import { translateHome } from "../lib/ip/home-messages";
  import type { CoffeeIp } from "../lib/ip/coffee";
  import { ipScoreColor } from "../lib/ip/ip-score";
  import CountryFlag from "../lib/ip/CountryFlag.svelte";
  import CopyAddressButton from "../lib/ip/CopyAddressButton.svelte";
  import LocationMap from "../lib/ip/LocationMap.svelte";
  import HomeConnectivity from "../lib/ip/HomeConnectivity.svelte";
  import HomeStatus from "../lib/ip/HomeStatus.svelte";
  import SplitResults from "./unlock/sites/SplitResults.svelte";
  import type { Geo } from "./leak/webrtc/types";

  const locale = $derived(localeFromPath(page.url.pathname));
  let hidden = $state(false);
  let egress = $state<HttpEgress>();
  let domestic = $state<Geo>();
  let pending = $state(true);
  let pendingDomestic = $state(true);
  let reputation = $state<Partial<Record<string, CoffeeIp>>>({});
  let refresh = $state(0);
  let controller: AbortController;
  const exitLabels = $derived({ domestic: t("domestic"), overseas: t("overseas") });

  function t(key: string) {
    return translateHome(key, [], locale);
  }

  function loadReputation(ip: string, signal: AbortSignal) {
    if (Object.hasOwn(reputation, ip)) return;
    reputation[ip] = undefined;
    void import("../lib/ip/lookup")
      .then(({ lookupIp }) =>
        lookupIp(ip, AbortSignal.any([signal, AbortSignal.timeout(3000)])),
      )
      .then(({ coffee }) => {
        if (!signal.aborted) reputation[ip] = coffee;
      })
      .catch(() => {
        /* The exit card remains usable without reputation data. */
      });
  }

  async function detectDomestic(signal: AbortSignal): Promise<Geo> {
    const geo = await getDomesticIp(signal);
    try {
      return { ...geo, ...(await getGeo(geo.ip, signal)), ip: geo.ip };
    } catch {
      signal.throwIfAborted();
      return geo;
    }
  }
  async function detectOverseas(signal: AbortSignal): Promise<Geo> {
    const ipv4Trace = async (host: string) => {
      const geo = await trace(host, signal);
      if (geo.ip.includes(":")) throw new Error("Expected IPv4");
      return geo;
    };
    const attempts = [
      getBrowserIp(4, signal),
      ipv4Trace("chatgpt.com"),
      ipv4Trace("www.cloudflare.com"),
      ipv4Trace("1.1.1.1"),
    ];
    attempts.forEach((attempt) => attempt.catch(() => undefined));
    let lastError: unknown;
    for (const attempt of attempts) {
      try {
        return await attempt;
      } catch (error) {
        signal.throwIfAborted();
        lastError = error;
      }
    }
    throw lastError;
  }
  async function locate(geo: Geo, signal: AbortSignal): Promise<Geo> {
    try {
      return { ...geo, ...(await getGeo(geo.ip, signal)), ip: geo.ip };
    } catch {
      signal.throwIfAborted();
      return geo;
    }
  }
  async function detectEgress(signal: AbortSignal): Promise<HttpEgress> {
    const [ipv4, ipv6] = await Promise.all([
      detectOverseas(signal)
        .then((geo) => locate(geo, signal))
        .catch(() => {
          signal.throwIfAborted();
          return null;
        }),
      getBrowserIp(6, signal)
        .then((geo) => locate(geo, signal))
        .catch(() => {
          signal.throwIfAborted();
          return null;
        }),
    ]);
    return { ipv4, ipv6 };
  }
  function run() {
    controller?.abort();
    refresh++;
    const run = new AbortController();
    controller = run;
    pending = true;
    pendingDomestic = true;
    egress = undefined;
    domestic = undefined;
    reputation = {};
    void detectEgress(run.signal)
      .then((value) => {
        if (run.signal.aborted) return;
        egress = value;
        if (value.ipv4) loadReputation(value.ipv4.ip, run.signal);
      })
      .catch((error) => {
        if (!run.signal.aborted) throw error;
      })
      .finally(() => {
        if (!run.signal.aborted) pending = false;
      });
    void detectDomestic(run.signal)
      .then((value) => {
        if (run.signal.aborted) return;
        domestic = value;
        loadReputation(value.ip, run.signal);
      })
      .catch(() => {})
      .finally(() => {
        if (!run.signal.aborted) pendingDomestic = false;
      });
  }
  onMount(() => {
    try {
      hidden =
        JSON.parse(localStorage.getItem("ip-tools:hide-ip") ?? "false") ===
        true;
    } catch {
      /* Storage may be unavailable. */
    }
    const syncPrivacy = (event?: Event) => {
      if (event instanceof CustomEvent && typeof event.detail === "boolean") {
        hidden = event.detail;
        return;
      }
      try {
        hidden =
          JSON.parse(localStorage.getItem("ip-tools:hide-ip") ?? "false") ===
          true;
      } catch {
        /* Storage may be unavailable. */
      }
    };
    window.addEventListener("storage", syncPrivacy);
    window.addEventListener("ip-privacy-changed", syncPrivacy);
    run();
    return () => {
      controller.abort();
      window.removeEventListener("storage", syncPrivacy);
      window.removeEventListener("ip-privacy-changed", syncPrivacy);
    };
  });
</script>

<svelte:head
  ><title>{t("title")} · One IP</title><meta
    name="description"
    content={t("description")}
  /></svelte:head
>
<div class="overview">
  <header class="heading">
    <h1>{t("title")}</h1>
    <button
      class="ui-button primary refresh"
      onclick={run}
      aria-busy={pendingDomestic || pending}
      ><RefreshCw size={14} aria-hidden="true" /> {t("refresh")}</button
    >
  </header>
  <div class="exits">
    {#each homeExitCards(domestic, egress?.ipv4, pendingDomestic, pending, exitLabels) as exit (exit.label)}
      {@const coffee = exit.geo ? reputation[exit.geo.ip] : undefined}
      {@const score = coffee?.trust_score}
      {@const local = exit.label === exitLabels.domestic}
      <article class="ui-panel exit" class:local>
        <header class="exit-label">
          <div class="exit-icon">
            {#if local}<Router
                size={19}
                strokeWidth={1.7}
                aria-hidden="true"
              />{:else}<Globe
                size={19}
                strokeWidth={1.7}
                aria-hidden="true"
              />{/if}
          </div>
          <h2>{exit.label.replace(/ IPv4$/, "")}</h2>
          <span class="protocol">IPv4</span>
        </header>
        <div class="exit-tags">
          {#if coffee?.company_type}<span class="tag"
              >{coffee.company_type}</span
            >{/if}
          {#if coffee?.is_public_service}<span class="tag"
              >{t("public")}</span
            >
          {:else if coffee?.isResidential}<span class="tag"
              >{t("residential")}</span
            >
          {:else if coffee?.is_datacenter}<span class="tag"
              >{t("datacenter")}</span
            >{/if}
        </div>
        {#if exit.geo}
          {@const geo = exit.geo}
          <div class="exit-data">
            <div>
              <div class="address-line">
                <CountryFlag code={geo.country_code ?? coffee?.countryCode} />
                <a class="address" dir="ltr" href={localizedPath(`/ip/${encodeURIComponent(geo.ip)}`, locale)}
                  >{hidden ? "••••••••" : geo.ip}</a
                >
                <CopyAddressButton ip={geo.ip} {locale} />
              </div>
              <p class="location">
                {[geo.country, geo.region, geo.city]
                  .filter(Boolean)
                  .filter((name, index, names) => names.indexOf(name) === index)
                  .join(" · ") || "—"}
              </p>
              <p class="provider">
                {[geo.isp, geo.asn ? `AS${geo.asn}` : undefined]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            {#if score != null && score >= 0 && score <= 100}
              <div class="score" style:color={ipScoreColor(score)}>
                <strong>{score}</strong>
                <span>{t("score")}</span>
                <div class="score-track" aria-hidden="true">
                  <i style:width={`${score}%`}></i>
                </div>
              </div>
            {/if}
          </div>
        {:else}
          <div class="placeholder" role="status" aria-label={t("loading")}>
            <span></span><span></span><span></span>
          </div>
        {/if}
      </article>
    {:else}
      <p class="ui-panel empty" role="status">{t("unknown")}</p>
    {/each}
  </div>
  <div class="network-panels">
    <HomeConnectivity {locale} {refresh} />
    <SplitResults {refresh} summary />
  </div>
  <HomeStatus {locale} {refresh} />
  {#if domestic?.latitude != null && domestic.longitude != null}
    {#key `${domestic.ip}:${egress?.ipv4?.ip}:${egress?.ipv6?.ip}`}<LocationMap
        geo={domestic}
        others={[egress?.ipv4, egress?.ipv6].filter((geo): geo is Geo => !!geo)}
        {locale}
      />{/key}
  {:else if egress?.ipv4?.latitude != null && egress.ipv4.longitude != null}
    {#key `${egress.ipv4.ip}:${egress.ipv6?.ip}`}<LocationMap
        geo={egress.ipv4}
        others={egress.ipv6 ? [egress.ipv6] : []}
        {locale}
      />{/key}
  {/if}
  <section class="ui-panel guide" aria-labelledby="guide-title">
    <h2 id="guide-title">{t("guide.title")}</h2>
    <div class="guide-questions">
      <section>
        <h3>{t("guide.exitsQuestion")}</h3>
        <p>{t("guide.exitsAnswer")}</p>
      </section>
      <section>
        <h3>{t("guide.locationQuestion")}</h3>
        <p>{t("guide.locationAnswer")} <a href="https://developers.cloudflare.com/network/ip-geolocation/#accuracy-and-limitations" target="_blank" rel="noreferrer">{t("guide.locationSource")}</a></p>
      </section>
      <section>
        <h3>{t("guide.latencyQuestion")}</h3>
        <p>{t("guide.latencyAnswer")}</p>
      </section>
    </div>
    <p class="sources">
      {t("guide.sources")}
      <a href="https://ipquery.io/" target="_blank" rel="noreferrer">IPQuery</a>,
      <a href="https://ipwho.is/" target="_blank" rel="noreferrer">ipwho.is</a>,
      <a href="https://ip.net.coffee/" target="_blank" rel="noreferrer">Net.Coffee</a>.
    </p>
  </section>
</div>

<style>
  .overview {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 16px;
  }
  .heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
    margin: 5px 0 3px;
  }
  h1 {
    margin: 0;
    color: var(--foreground);
    font-size: clamp(1.55rem, 3.2vw, 2rem);
    line-height: 1.2;
    letter-spacing: -0.045em;
    font-weight: 720;
  }
  .exits {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr));
    gap: 16px;
  }
  .network-panels {
    display: grid;
    grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
    gap: 16px;
  }
  .guide {
    padding: 20px;
  }
  .guide h2 {
    margin: 0 0 16px;
    font-size: 1rem;
  }
  .guide-questions {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr));
    gap: 16px 24px;
  }
  .guide h3 {
    margin: 0 0 6px;
    font-size: 0.85rem;
  }
  .guide p {
    margin: 0;
    color: var(--muted-foreground);
    font-size: 0.8rem;
    line-height: 1.6;
  }
  .guide .sources {
    margin-top: 16px;
  }
  .guide a {
    color: var(--primary);
  }
  .exit {
    min-height: 186px;
    border: 1px solid var(--border);
    padding: 18px 20px;
    background: linear-gradient(
      145deg,
      color-mix(in srgb, var(--primary-soft) 54%, var(--card)),
      var(--card) 56%
    );
  }
  .exit.local {
    background: linear-gradient(
      145deg,
      color-mix(in srgb, #168b92 9%, var(--card)),
      var(--card) 56%
    );
  }
  .exit-label {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
    margin-bottom: 14px;
  }
  .exit-icon {
    display: grid;
    width: 36px;
    height: 36px;
    place-items: center;
    flex: 0 0 auto;
    border-radius: 11px;
    background: var(--primary-soft);
    color: var(--primary);
  }
  .local .exit-icon {
    background: color-mix(in srgb, #168b92 15%, var(--card));
    color: color-mix(in srgb, #168b92 73%, var(--foreground));
  }
  .exit-label h2 {
    color: var(--foreground);
    font-size: 0.9rem;
    font-weight: 650;
    margin: 0;
  }
  .protocol {
    margin-inline-start: auto;
    font:
      600 0.68rem/1.4 ui-monospace,
      monospace;
    color: var(--muted-foreground);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 2px 6px;
  }
  .exit-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    margin-bottom: 6px;
  }
  .exit-tags:empty {
    display: none;
  }
  .tag {
    font-size: 0.66rem;
    font-weight: 550;
    border-radius: 999px;
    padding: 1px 7px;
    background: color-mix(in srgb, var(--primary) 12%, transparent);
    color: var(--primary);
    overflow-wrap: anywhere;
  }
  .exit-data {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 10px;
  }
  .address-line {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 7px;
  }
  .address {
    font-family: ui-monospace, "Cascadia Mono", Consolas, monospace;
    font-size: clamp(1.25rem, 2.7vw, 1.8rem);
    font-weight: 700;
    letter-spacing: -0.06em;
    line-height: 1.2;
    font-variant-numeric: tabular-nums;
    text-decoration: none;
    color: var(--foreground);
    overflow-wrap: anywhere;
  }
  .address:hover {
    color: var(--primary);
  }
  .location,
  .provider,
  .empty {
    color: var(--muted-foreground);
    overflow-wrap: anywhere;
  }
  .location {
    margin: 4px 0 0;
    font-size: 0.8rem;
  }
  .provider {
    margin: 3px 0 0;
    font-size: 0.72rem;
  }
  .provider:empty {
    display: none;
  }
  .score {
    display: grid;
    gap: 4px;
    justify-items: start;
    min-width: 77px;
    padding-inline-start: 12px;
    border-inline-start: 1px solid var(--border);
    font-size: 0.72rem;
  }
  .score strong {
    font-size: clamp(1.9rem, 3.8vw, 2.65rem);
    line-height: 1;
    font-weight: 720;
    letter-spacing: -0.06em;
    font-variant-numeric: tabular-nums;
  }
  .score span {
    color: var(--muted-foreground);
  }
  .score-track {
    width: 48px;
    height: 3px;
    border-radius: 3px;
    background: var(--muted);
  }
  .score-track i {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: currentColor;
  }
  .placeholder {
    display: grid;
    justify-items: start;
    gap: 7px;
    padding: 5px 0;
  }
  .placeholder span {
    background: var(--muted);
    width: 35%;
    height: 7px;
    border-radius: 6px;
  }
  .placeholder span:first-child {
    width: 48%;
    height: 18px;
  }
  .placeholder span:last-child {
    width: 42%;
  }
  .empty {
    margin: 0;
    font-size: 0.8rem;
  }
  @media (max-width: 760px) {
    .network-panels {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  @media (max-width: 640px) {
    .overview,
    .exits,
    .network-panels {
      gap: 12px;
    }
    .exit {
      padding: 14px;
      min-height: 156px;
    }
  }
</style>
