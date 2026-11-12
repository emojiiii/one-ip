<script lang="ts">
  import { onMount, untrack } from "svelte";
  import Eye from "@lucide/svelte/icons/eye";
  import EyeOff from "@lucide/svelte/icons/eye-off";
  import Search from "@lucide/svelte/icons/search";
  import Globe from "@lucide/svelte/icons/globe";
  import ShieldCheck from "@lucide/svelte/icons/shield-check";
  import NetworkIcon from "@lucide/svelte/icons/network";
  import ToolHeading from "../ToolHeading.svelte";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { localeFromPath, localizedPath } from "../i18n";
  import { lookupIp } from "./lookup";
  import { t } from "./locale";
  import { normalizeIp } from "./ip-address";
  import { coffeeThreatLabels, type CoffeeLookup } from "./coffee";
  import LocationMap from "./LocationMap.svelte";
  import IpLatency from "./IpLatency.svelte";
  import IpProfile from "./IpProfile.svelte";
  import ScenarioPanel from "./ScenarioPanel.svelte";
  import RouteTopology from "./RouteTopology.svelte";
  import { ipScoreColor } from "./ip-score";
  import CountryFlag from "./CountryFlag.svelte";
  import CopyAddressButton from "./CopyAddressButton.svelte";

  type HistoryEntry = { query: string; data: CoffeeLookup; savedAt: number };
  type TopologyNode = {
    asn: string;
    name?: string;
    share: number;
    count: number;
  };
  type Network = {
    prefix?: string;
    ptr?: string;
    asns?: string[];
    routeAvailable: boolean;
    validations?: { asn: string; status: string }[];
    topology?: {
      observedPaths: number;
      origins: TopologyNode[];
      direct: TopologyNode[];
      secondary: TopologyNode[];
      edges: { origin: string; direct: string; count: number; share: number }[];
      secondaryEdges: {
        direct: string;
        secondary: string;
        count: number;
        share: number;
      }[];
    };
  };
  const historyKey = "ip-tools:coffee-history:v1";
  let query = $state("");
  let result = $state<CoffeeLookup>();
  let network = $state<Network>();
  let networkError = $state(false);
  let error = $state("");
  let loading = $state(false);
  let history = $state<HistoryEntry[]>([]);
  let hidden = $state(false);
  const locale = $derived(localeFromPath(page.url.pathname));
  let mounted = $state(false);
  let refresh = $state(0);
  const current = $derived(page.params.ip || "");
  function translate(key: string) {
    return t(`ip.lookup.${key}`, [], locale);
  }
  let savedAt = $state<number>();
  let previousRefresh = 0;
  const score = $derived(result?.coffee.trust_score);
  const threats = $derived(result ? coffeeThreatLabels(result.coffee) : []);

  onMount(() => {
    try {
      const value = JSON.parse(localStorage.getItem(historyKey) ?? "[]");
      if (Array.isArray(value))
        history = value
          .filter(
            (item: HistoryEntry) =>
              typeof item?.query === "string" &&
              item.data &&
              Number.isFinite(item.savedAt),
          )
          .slice(0, 10);
      hidden =
        JSON.parse(localStorage.getItem("ip-tools:hide-ip") ?? "false") ===
        true;
    } catch {
      /* Storage may be blocked or contain invalid JSON. */
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
    mounted = true;
    return () => {
      window.removeEventListener("storage", syncPrivacy);
      window.removeEventListener("ip-privacy-changed", syncPrivacy);
    };
  });

  $effect(() => {
    if (!mounted) return;
    const ip = current;
    const forced = refresh !== previousRefresh;
    previousRefresh = refresh;
    query = ip;
    error = "";
    result = undefined;
    network = undefined;
    networkError = false;
    savedAt = undefined;
    if (!ip) {
      loading = false;
      return;
    }
    if (!normalizeIp(ip)) {
      error = translate("invalid");
      loading = false;
      return;
    }
    const cached = untrack(() =>
      history.find((entry) => entry.query.toLowerCase() === ip.toLowerCase()),
    );
    if (cached) {
      result = cached.data;
      savedAt = cached.savedAt;
    }
    const controller = new AbortController();
    if (!cached || forced || Date.now() - cached.savedAt >= 300000) {
      loading = true;
      lookupIp(ip, controller.signal)
        .then((data) => {
          result = data;
          savedAt = undefined;
          if (!data.fallback) {
            const entry = { query: ip, data, savedAt: Date.now() };
            history = [
              entry,
              ...history.filter(
                (item) => item.query.toLowerCase() !== ip.toLowerCase(),
              ),
            ].slice(0, 10);
            try {
              localStorage.setItem(historyKey, JSON.stringify(history));
            } catch {
              /* Keep the current result usable. */
            }
          }
        })
        .catch((reason: unknown) => {
          if (!controller.signal.aborted)
            error = reason instanceof Error ? reason.message : translate("failed");
        })
        .finally(() => {
          if (!controller.signal.aborted) loading = false;
        });
    } else loading = false;
    fetch(`/api/ip/network/${encodeURIComponent(ip)}`, {
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status));
        return response.json() as Promise<Network>;
      })
      .then((data) => {
        network = data;
      })
      .catch(() => {
        if (!controller.signal.aborted) networkError = true;
      });
    return () => controller.abort();
  });

  function search(value: string) {
    const ip = normalizeIp(value);
    if (!ip) {
      error = translate("invalid");
      return;
    }
    if (ip === current) refresh++;
    else void goto(localizedPath(`/ip/${encodeURIComponent(ip)}`, locale) + page.url.search);
  }
  function toggleHidden() {
    hidden = !hidden;
    try {
      localStorage.setItem("ip-tools:hide-ip", JSON.stringify(hidden));
    } catch {
      /* Keep the current page usable. */
    }
    window.dispatchEvent(
      new CustomEvent("ip-privacy-changed", { detail: hidden }),
    );
  }
  function displayIp(ip: string) {
    return hidden ? "••••••••" : ip;
  }
  function boolean(value?: boolean) {
    return value == null ? translate("unknown") : value ? translate("yes") : translate("no");
  }
</script>

<svelte:head><title>{translate("title")} · One IP</title></svelte:head>
<div class="lookup-page">
  <ToolHeading title={translate("title")}>
    {#snippet icon()}<Search />{/snippet}
  </ToolHeading>
  <section class="ui-panel lookup-form" aria-label={translate("title")}>
    <form
      onsubmit={(event) => {
        event.preventDefault();
        search(query);
      }}
    >
      <label class="sr-only" for="ip-input">{translate("input")}</label>
      <div class="search">
        <Search size={17} aria-hidden="true" />
        <input
          id="ip-input"
          dir="ltr"
          value={hidden && query === current ? "" : query}
          oninput={(event) => (query = event.currentTarget.value)}
          placeholder={translate("placeholder")}
          maxlength="253"
          autocapitalize="none"
          spellcheck="false"
          required
        />
        <button class="ui-button primary" disabled={loading}
          >{translate("search")}</button
        >
      </div>
    </form>
    <div class="recent">
      <span>{history.length ? translate("recent") : translate("suggested")}</span>
      {#each history.length ? history
            .slice(0, 6)
            .map((item) => item.query) : ["1.1.1.1", "8.8.8.8", "223.5.5.5"] as ip}
        <button class="ui-button ghost" type="button" onclick={() => search(ip)}
          >{displayIp(ip)}</button
        >
      {/each}
    </div>
  </section>
  {#if loading}<p role="status" class="notice">{translate("loading")}</p>{/if}
  {#if error}<p role="alert" class="notice error">{error}</p>{/if}
  {#if result}
    {@const details = result.coffee}
    <section class="ui-panel identity" aria-labelledby="ip-address">
      <div>
        <h2 class="address" id="ip-address"><bdi dir="ltr">{displayIp(details.ip)}</bdi></h2>
        <p>
          <CountryFlag code={result.geo.country_code} /><span
            >{[details.country, details.region, details.city, details.isp]
              .filter(Boolean)
              .filter((value, index, values) => values.indexOf(value) === index)
              .join(" · ") || translate("location")}</span
          >
        </p>
        <div class="actions">
          <button
            type="button"
            class="ui-button ghost icon-button"
            aria-pressed={hidden}
            aria-label={hidden ? translate("show") : translate("hide")}
            title={hidden ? translate("show") : translate("hide")}
            onclick={toggleHidden}
          >
            {#if hidden}<EyeOff size={15} aria-hidden="true" />{:else}<Eye
                size={15}
                aria-hidden="true"
              />{/if}
          </button>
          <CopyAddressButton ip={details.ip} {locale} />
        </div>
      </div>
      <div class="score-panel">
        <div class="score" style:color={ipScoreColor(score)}>
          <span>{translate("reputation")}</span>
          <strong
            >{score != null && score >= 0 && score <= 100 ? score : "—"}</strong
          >
        </div>
        {#if score != null && score >= 0 && score <= 100}
          <div
            class="reputation"
            role="meter"
            aria-label={translate("reputation")}
            aria-valuemin="0"
            aria-valuemax="100"
            aria-valuenow={score}
          >
            <span style:left={`${score}%`}></span>
          </div>
          <div class="scale" aria-hidden="true">
            <span>0</span><span>50</span><span>100</span>
          </div>
        {/if}
      </div>
    </section>
    {#if savedAt}<div class="notice saved">
        <span
          >{translate("saved")} · {new Date(savedAt).toLocaleString(
            locale,
          )}</span
        ><button class="ui-button ghost" onclick={() => refresh++}
          >{translate("refresh")}</button
        >
      </div>{/if}
    {#if result.fallback}<p role="status" class="notice">
        {translate("fallback")}
      </p>{/if}
    <div class="facts">
      <section class="ui-panel" aria-labelledby="ip-facts">
        <h2 id="ip-facts">
          <Globe size={16} aria-hidden="true" />{translate("network")}
        </h2>
        <dl class="facts-list">
          <div>
            <dt>ASN</dt>
            <dd>{details.asn ?? "—"} {details.asOrganization ?? ""}</dd>
          </div>
          <div>
            <dt>{translate("isp")}</dt>
            <dd>{details.isp ?? "—"}</dd>
          </div>
          <div>
            <dt>{translate("company")}</dt>
            <dd>{details.company_name ?? "—"} {details.company_type ?? ""}</dd>
          </div>
          <div>
            <dt>{translate("country")}</dt>
            <dd>
              {details.registered_country ??
                details.registered_country_code ??
                "—"}
            </dd>
          </div>
          <div>
            <dt>rDNS</dt>
            <dd>{details.rdns ?? "—"}</dd>
          </div>
          <div>
            <dt>CIDR</dt>
            <dd>{details.cidr ?? "—"}</dd>
          </div>
          <div>
            <dt>RPKI</dt>
            <dd>{details.rpki_status ?? "—"}</dd>
          </div>
        </dl>
      </section>
      <section class="ui-panel" aria-labelledby="ip-risk">
        <h2 id="ip-risk">
          <ShieldCheck size={16} aria-hidden="true" />{translate("risk")}
        </h2>
        <dl class="risk-list">
          {#each [["VPN", details.is_vpn, true], [translate("proxy"), details.is_proxy, true], ["Tor", details.is_tor, true], [translate("datacenter"), details.is_datacenter, false], [translate("residential"), details.isResidential, false], [translate("crawler"), details.is_crawler, true], [translate("abuse"), details.is_abuser, true], [translate("mobile"), details.is_mobile, false]] as [label, value, isRisk]}
            <div>
              <dt>{label}</dt>
              <dd
                class="pill"
                class:warn={isRisk && value === true}
                class:ok={isRisk && value === false}
              >
                {boolean(value as boolean | undefined)}
              </dd>
            </div>
          {/each}
        </dl>
        {#if threats.length}<p>
            <strong>{translate("threats")} · </strong>{threats.join(" · ")}
          </p>{/if}
      </section>
    </div>
    <IpProfile data={details} {locale} />
    {#key `${result.geo.ip}:${result.geo.latitude}:${result.geo.longitude}`}<LocationMap
        geo={result.geo}
        {locale}
      />{/key}
    <section class="ui-panel" aria-labelledby="ip-routing">
      <h2 id="ip-routing">
        <NetworkIcon size={16} aria-hidden="true" />{translate("routing")}
      </h2>
      {#if network?.routeAvailable}
        <p>
          {network.prefix ?? "—"} · {network.topology?.observedPaths ?? "—"}
          {translate("routes")}
        </p>
        {#if network.topology}<RouteTopology
            topology={network.topology}
            {locale}
          />{/if}
        {#if network.validations?.length}<p>
            RPKI: {network.validations
              .map((item) => `${item.asn} ${item.status}`)
              .join(" · ")}
          </p>{/if}
      {:else if networkError || network}<p>{translate("unavailable")}</p>
      {:else}<p role="status">{translate("loading")}</p>{/if}
    </section>
    {#key details.ip}<ScenarioPanel ip={details.ip} {locale} />{/key}
    {#key details.ip}<IpLatency ip={details.ip} {locale} />{/key}
    {#if details.location_history?.length || details.related_domains?.length || result.sources.length}
      <div class="ui-panel supplementary">
        {#if details.location_history?.length}
          <details>
            <summary>{translate("history")}</summary>
            <ul>
              {#each details.location_history as item}<li>
                  {[item.country, item.region, item.city]
                    .filter(Boolean)
                    .join(" · ")}
                  {item.seen_at
                    ? new Date(item.seen_at * 1000).toLocaleDateString(
                        locale,
                      )
                    : ""}
                </li>{/each}
            </ul>
          </details>
        {/if}
        {#if details.related_domains?.length}
          <details>
            <summary>{translate("domain")}</summary>
            <ul>
              {#each details.related_domains as item}<li>
                  {item.domain}
                  {item.via ?? ""}
                </li>{/each}
            </ul>
          </details>
        {/if}
        {#if result.sources.length}
          <details>
            <summary>{translate("source")}</summary>
            <ul>
              {#each result.sources as source}<li>
                  {source.source}: {[source.country, source.region, source.city]
                    .filter(Boolean)
                    .join(" · ") || translate("unknown")}
                </li>{/each}
            </ul>
          </details>
        {/if}
      </div>
    {/if}
  {/if}
</div>

<style>
  .lookup-page {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 16px;
  }
  h2 {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    font-size: 1rem;
    font-weight: 650;
  }
  h2 :global(svg) {
    color: var(--primary);
  }
  .search {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 4px 4px 4px 12px;
    border: 1px solid var(--border);
    border-radius: var(--control-radius);
    background: var(--muted);
    color: var(--muted-foreground);
  }
  .search:focus-within {
    border-color: var(--primary);
    background: var(--card);
  }
  input {
    flex: 1;
    min-width: 0;
    padding: 6px 0;
    border: 0;
    background: transparent;
    color: var(--foreground);
  }
  input:focus-visible {
    outline: none;
  }
  .icon-button {
    min-width: 30px;
    min-height: 30px;
    padding: 4px;
  }
  .search button {
    padding-inline: 18px;
  }
  .search button:disabled {
    opacity: 0.6;
    cursor: wait;
  }
  .recent,
  .actions {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }
  .recent {
    margin-top: 10px;
    font-size: 0.74rem;
    color: var(--muted-foreground);
  }
  .recent button {
    min-height: 26px;
    padding: 3px 8px;
    color: var(--muted-foreground);
    background: var(--muted);
    font-variant-numeric: tabular-nums;
  }
  .recent button:hover {
    color: var(--primary);
    background: var(--primary-soft);
  }
  .identity {
    display: grid;
    grid-template-columns: minmax(0, 1.5fr) minmax(180px, 0.8fr);
    align-items: center;
    gap: 20px;
    padding: clamp(16px, 3vw, 24px);
    background: linear-gradient(
      115deg,
      var(--card) 42%,
      color-mix(in srgb, var(--primary-soft) 40%, var(--card))
    );
  }
  .address {
    font-size: clamp(1.55rem, 4vw, 2.2rem);
    font-weight: 750;
    letter-spacing: -0.04em;
    font-variant-numeric: tabular-nums;
    overflow-wrap: anywhere;
  }
  .identity p {
    display: flex;
    align-items: center;
    gap: 5px;
    margin: 5px 0 8px;
  }
  .score-panel {
    min-width: 0;
    padding: 13px 14px;
    border-radius: 12px;
    background: var(--card);
  }
  .score {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
    font-size: 0.8rem;
  }
  .score span {
    color: var(--muted-foreground);
    font-weight: 600;
  }
  .score strong {
    font-size: clamp(2rem, 5vw, 3rem);
    line-height: 1;
    font-weight: 720;
    letter-spacing: -0.06em;
    font-variant-numeric: tabular-nums;
  }
  .reputation {
    position: relative;
    margin: 12px 4px 0;
    height: 5px;
    border-radius: 5px;
    background: linear-gradient(
      to right,
      color-mix(in srgb, var(--danger) 56%, var(--muted)),
      color-mix(in srgb, var(--warning) 56%, var(--muted)),
      color-mix(in srgb, var(--success) 70%, var(--muted))
    );
  }
  .reputation span {
    position: absolute;
    width: 8px;
    height: 11px;
    top: -3px;
    transform: translateX(-50%);
    background: var(--card);
    border: 1px solid var(--foreground);
    border-radius: 4px;
  }
  .scale {
    display: flex;
    justify-content: space-between;
    margin: 4px 0 0;
    color: var(--muted-foreground);
    font-size: 0.66rem;
  }
  .notice {
    margin: 0;
    padding: 9px 12px;
    border-radius: 8px;
    color: var(--muted-foreground);
    background: var(--primary-soft);
    font-size: 0.8rem;
  }
  .error {
    color: var(--danger);
    background: var(--danger-soft);
  }
  .saved {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .facts {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr));
    gap: 16px;
  }
  dl {
    margin: 8px 0 0;
  }
  dl div {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
    padding: 8px 0;
    border-bottom: 1px solid color-mix(in srgb, var(--border) 66%, transparent);
  }
  dl div:last-child {
    border: 0;
  }
  dt {
    flex-shrink: 0;
    color: var(--muted-foreground);
    font-size: 0.76rem;
  }
  dd {
    min-width: 0;
    margin: 0;
    font-size: 0.84rem;
    text-align: end;
    overflow-wrap: anywhere;
  }
  .pill {
    padding: 1px 6px;
    border-radius: 5px;
    background: var(--muted);
    color: var(--muted-foreground);
    font-size: 0.71rem;
  }
  .pill.warn {
    color: var(--danger);
    background: color-mix(in srgb, var(--danger) 10%, var(--card));
  }
  .pill.ok {
    color: var(--success);
    background: color-mix(in srgb, var(--success) 10%, var(--card));
  }
  p,
  li {
    overflow-wrap: anywhere;
    color: var(--muted-foreground);
    font-size: 0.8rem;
  }
  .supplementary {
    display: grid;
    gap: 8px;
  }
  details + details {
    padding-top: 8px;
    border-top: 1px solid var(--border);
  }
  summary {
    cursor: pointer;
    font-weight: 600;
    font-size: 0.8rem;
  }
  ul {
    margin: 8px 0 0;
    padding-inline-start: 18px;
  }
  @media (max-width: 640px) {
    .lookup-page,
    .facts {
      gap: 12px;
    }
    .identity {
      grid-template-columns: minmax(0, 1fr);
      gap: 10px;
    }
  }
</style>
