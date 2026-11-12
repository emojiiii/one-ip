<script module lang="ts">
  import { messageCatalog } from "../../../lib/message-catalog";

  const { t } = messageCatalog("sites");
</script>

<script lang="ts">
  import { page } from "$app/state";
  import ArrowUpRight from "@lucide/svelte/icons/arrow-up-right";
  import Route from "@lucide/svelte/icons/route";
  import { onMount, onDestroy, untrack } from "svelte";
  import { localeFromPath, localizedPath } from "../../../lib/i18n";
  import { normalizeIp, sameIp } from "../../../lib/ip/ip-address";
  import { getDomesticIp } from "../../../lib/ip/home";
  import { inspectSite, readSiteEgress } from "../../../lib/ip/connectivity";
  import { runProbeBatch } from "../../../lib/ip/probe-batch";
  import { maskedIp } from "../../leak/webrtc/network";
  import sites from "./egress-sites.json";
  let {
    refresh = 0,
    summary = false,
  }: { refresh?: number; summary?: boolean } = $props();
  const locale = $derived(localeFromPath(page.url.pathname));
  const tr = (key: string, values: readonly unknown[] = []) =>
    t(key, values, locale);
  type Result = { ip?: string; reachable?: boolean; pending?: boolean };
  let targets = $derived(
    summary ? sites.filter((site) => site.method !== "unsupported") : sites,
  );
  let results = $state<Record<string, Result>>({});
  let groups = $derived.by(() => {
    const byAddress = new Map<string, number>();
    for (const result of Object.values(results)) {
      const ip = normalizeIp(result.ip);
      if (ip) byAddress.set(ip, (byAddress.get(ip) ?? 0) + 1);
    }
    return [...byAddress.entries()].sort((a, b) => b[1] - a[1]);
  });
  let collected = $derived(
    groups.reduce((total, [, count]) => total + count, 0),
  );
  let domestic = $state("");
  let busy = $state(false);
  let hidden = $state(false);
  let container: HTMLElement;
  let observer: IntersectionObserver;
  let visible = false;
  let lastRefresh = untrack(() => refresh);
  $effect(() => {
    const current = refresh;
    if (current !== lastRefresh) {
      lastRefresh = current;
      if (visible) void run();
    }
  });
  let controller: AbortController;
  async function run() {
    controller?.abort();
    controller = new AbortController();
    const signal = controller.signal;
    busy = true;
    domestic = "";
    results = Object.fromEntries(
      targets.map((site) => [site.name, { pending: true }]),
    );
    const reference = summary
      ? undefined
      : getDomesticIp(signal)
          .then((geo) => {
            if (!signal.aborted) domestic = geo.ip;
          })
          .catch(() => {});
    await Promise.all([
      reference,
      runProbeBatch(targets, 4, signal, async (site) => {
        try {
          if (summary) {
            const geo = await readSiteEgress(site, signal);
            if (!signal.aborted) results[site.name] = { ip: geo?.ip };
          } else {
            const result = await inspectSite(site, signal);
            if (!signal.aborted) {
              results[site.name] = {
                ip: result.geo?.ip,
                reachable: result.reachable,
              };
            }
          }
        } catch (error) {
          if (!signal.aborted) throw error;
        }
      }),
    ]);
    if (!signal.aborted) busy = false;
  }
  onMount(() => {
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
    syncPrivacy();
    window.addEventListener("storage", syncPrivacy);
    window.addEventListener("ip-privacy-changed", syncPrivacy);
    observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        visible = true;
        observer.disconnect();
        void run();
      }
    });
    observer.observe(container);
    return () => {
      window.removeEventListener("storage", syncPrivacy);
      window.removeEventListener("ip-privacy-changed", syncPrivacy);
    };
  });
  onDestroy(() => {
    observer?.disconnect();
    controller?.abort();
  });
</script>

<section bind:this={container} class:summary class:ui-panel={summary}>
  <header>
    <div class="heading">
      {#if summary}
        <span class="section-icon"><Route size={16} aria-hidden="true" /></span>
      {/if}
      <h2>
        {tr("home.websiteEgressRouting")}
      </h2>
    </div>
    {#if summary}
      <a href={localizedPath("/unlock/sites", locale)}>
        {tr("home.egressViewAll")}
        <ArrowUpRight size={13} aria-hidden="true" />
      </a>
    {:else}
      <button class="ui-button" type="button" disabled={busy} onclick={run}
        >{tr("home.egressRunAgain")}</button
      >
    {/if}
  </header>
  {#if summary}
    {#if groups.length}
      <ul class="groups">
        {#each groups as [ip, count] (ip)}
          <li>
            <bdi class="address" dir="ltr">{maskedIp(ip, hidden)}</bdi>
            <span class="count"
              ><strong>{count}</strong> {tr("home.sites")}</span
            >
            <span
              class="share"
              style:--share={`${(count / targets.length) * 100}%`}
              aria-hidden="true"
            ></span>
          </li>
        {/each}
      </ul>
    {/if}
    <p role="status">
      {busy
        ? tr("home.checkingRoutedEgress")
        : tr("home.egressCollectedForSites", [collected, targets.length, ""])}
    </p>
  {:else}
    <p>
      {tr("home.chinaIpv4Reference")}
      <bdi class="address" dir="ltr">{domestic ? maskedIp(domestic, hidden) : "—"}</bdi>
    </p>
    <table>
      <thead
        ><tr
          ><th scope="col">{tr("home.egressSite")}</th><th
            scope="col">IP</th
          ><th scope="col">{tr("home.egressRoute")}</th></tr
        ></thead
      >
      <tbody>
        {#each sites as site (site.name)}
          {@const result = results[site.name]}
          {@const comparable = result?.ip && domestic}
          {@const direct = result?.ip && sameIp(result.ip, domestic)}
          <tr>
            <td>{site.nameKey ? tr(site.nameKey) : site.name}</td>
            <td class="address"><bdi dir="ltr">{result?.pending
                ? "…"
                : result?.ip
                  ? maskedIp(result.ip, hidden)
                  : "—"}</bdi></td>
            <td>
              <span
                class="route"
                class:direct={comparable && direct}
                class:routed={comparable && !direct}
              >
                {result?.pending
                  ? "…"
                  : comparable
                    ? direct
                      ? tr("home.egressDirect")
                      : tr("home.egressDifferent")
                    : result?.reachable === false
                      ? tr("home.egressNoResponse")
                      : tr("home.egressUnknown")}
              </span>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
    <p>
      {tr("home.egressRouteExplanation")}
    </p>
  {/if}
</section>

<style>
  section:not(.summary) {
    min-width: 0;
    padding: 1rem;
    border: 1px solid var(--border, var(--color-border));
    border-radius: var(--radius, 0.75rem);
    background: var(--card, var(--color-card));
  }
  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.75rem;
  }
  h2 {
    margin: 0;
    font-size: 0.9375rem;
    font-weight: 650;
  }
  .summary h2 {
    font-weight: 660;
    line-height: 1.25;
  }
  .summary .heading {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .section-icon {
    display: grid;
    place-items: center;
    flex: none;
    width: 30px;
    height: 30px;
    border-radius: 9px;
    color: var(--primary);
    background: var(--primary-soft);
  }
  header a,
  p {
    font-size: 0.8125rem;
    color: var(--muted-foreground, var(--color-muted-foreground));
  }
  header a:hover {
    color: var(--primary, var(--color-primary));
  }
  .summary header a {
    display: inline-flex;
    min-height: 28px;
    align-items: center;
    gap: 3px;
    padding-inline: 5px;
    border-radius: 7px;
    font-size: 0.75rem;
    text-decoration: none;
    white-space: nowrap;
  }
  .summary header a:hover {
    background: var(--primary-soft);
  }
  p {
    margin: 0.75rem 0 0;
    line-height: 1.55;
  }
  button {
    cursor: pointer;
  }
  button:disabled {
    cursor: default;
  }
  table {
    width: 100%;
    margin-top: 0.75rem;
    border-collapse: collapse;
    table-layout: fixed;
    font-size: 0.8125rem;
  }
  th,
  td {
    text-align: start;
    padding: 0.55rem 0.5rem;
    border-bottom: 1px solid var(--border, var(--color-border));
    overflow-wrap: anywhere;
  }
  th {
    color: var(--muted-foreground, var(--color-muted-foreground));
    font-size: 0.75rem;
    font-weight: 500;
    background: var(--muted, var(--color-muted));
  }
  th:nth-child(2) {
    width: 37%;
  }
  tbody tr:last-child td {
    border-bottom: 0;
  }
  .address,
  .count {
    font-variant-numeric: tabular-nums;
  }
  .address {
    overflow-wrap: anywhere;
  }
  .route {
    display: inline-block;
    padding: 0.15rem 0.5rem;
    border-radius: 0.375rem;
    color: var(--muted-foreground, var(--color-muted-foreground));
    background: var(--muted, var(--color-muted));
  }
  .route.direct {
    color: var(--success);
    background: color-mix(in srgb, var(--success) 9%, transparent);
  }
  .route.routed {
    color: var(--primary, var(--color-primary));
    background: color-mix(
      in srgb,
      var(--primary, var(--color-primary)) 10%,
      transparent
    );
  }
  .groups {
    display: grid;
    gap: 0.5rem;
    margin: 0.875rem 0 0;
    padding: 0;
    list-style: none;
  }
  .groups li {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.35rem 0.5rem;
    padding: 0.45rem 0.6rem 0.55rem;
    border: 1px solid var(--border);
    border-radius: 9px;
    background: color-mix(in srgb, var(--muted) 50%, var(--card));
    font-size: 0.8125rem;
  }
  .groups .address {
    font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
    font-weight: 570;
    line-height: 1.35;
  }
  .count {
    color: var(--muted-foreground, var(--color-muted-foreground));
    font-size: 0.75rem;
    white-space: nowrap;
  }
  .count strong {
    color: var(--foreground);
  }
  .share {
    grid-column: 1 / -1;
    height: 3px;
    overflow: hidden;
    border-radius: 3px;
    background: var(--border);
  }
  .share::before {
    content: "";
    display: block;
    width: max(3px, var(--share));
    height: 100%;
    border-radius: inherit;
    background: color-mix(in srgb, var(--primary) 68%, var(--card));
  }
  .summary p {
    font-size: 0.75rem;
  }
</style>
