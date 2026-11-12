<script module lang="ts">
  import { messageCatalog } from "../../../lib/message-catalog";

  const { t } = messageCatalog("sites", "network");
</script>

<script lang="ts">
  import { page } from "$app/state";
  import { onMount, onDestroy } from "svelte";
  import Network from "@lucide/svelte/icons/network";
  import RefreshCw from "@lucide/svelte/icons/refresh-cw";
  import ToolHeading from "../../../lib/ToolHeading.svelte";
  import { localeFromPath } from "../../../lib/i18n";
  import targets from "./targets.json";
  import SplitResults from "./SplitResults.svelte";

  type Target = {
    cc: string;
    name: string;
    url: string;
    nameKey?: string;
    icon?: string;
  };
  type Result = { samples: number[]; running: boolean; started: boolean };
  const locale = $derived(localeFromPath(page.url.pathname));
  let results = $state<Record<string, Result>>({});
  let observer: IntersectionObserver;
  const controllers = new Map<string, AbortController>();
  const visible = new Set<string>();
  const groups = [
    "ai",
    "streaming",
    "cn",
    "jp",
    "us",
    "gl",
    "crypto",
    "ecommerce",
  ];
  const tr = (key: string) => t(key, [], locale);
  const name = (target: Target) =>
    target.nameKey ? tr(target.nameKey) : target.name;
  function iconSource(icon?: string) {
    const proxy = icon?.match(
      /^https:\/\/icons\.duckduckgo\.com\/ip3\/([^/?#]+)\.ico$/,
    )?.[1];
    return proxy
      ? `${import.meta.env.VITE_API_BASE_URL ?? "/api"}/icons/${encodeURIComponent(proxy)}`
      : icon;
  }
  function median(samples: number[]) {
    const good = samples.filter((n) => n >= 0).sort((a, b) => a - b);
    const middle = Math.floor(good.length / 2);
    return good.length
      ? Math.round(
          good.length % 2
            ? good[middle]
            : (good[middle - 1] + good[middle]) / 2,
        )
      : null;
  }
  async function run(target: Target) {
    controllers.get(target.name)?.abort();
    const controller = new AbortController();
    controllers.set(target.name, controller);
    let samples: number[] = [];
    results[target.name] = { started: true, running: true, samples };
    let failures = 0;
    for (let i = 0; i < 8; i++) {
      const start = performance.now();
      let latency = -1;
      try {
        await fetch(target.url, {
          mode: "no-cors",
          cache: "no-store",
          referrerPolicy: "no-referrer",
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(3000),
          ]),
        });
        latency = Math.round(performance.now() - start);
      } catch {
        if (controller.signal.aborted) return;
      }
      samples = [...samples, latency];
      failures = latency < 0 ? failures + 1 : 0;
      results[target.name] = { started: true, running: true, samples };
      if (failures >= 2) break;
    }
    results[target.name] = { started: true, running: false, samples };
    controllers.delete(target.name);
  }
  function observe(node: HTMLElement, target: Target) {
    node.dataset.name = target.name;
    observer?.observe(node);
    return {
      destroy() {
        observer?.unobserve(node);
        visible.delete(target.name);
      },
    };
  }
  onMount(() => {
    observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const target = targets.find(
          (item) => item.name === (entry.target as HTMLElement).dataset.name,
        );
        if (!target) continue;
        if (entry.isIntersecting) {
          visible.add(target.name);
          if (!results[target.name]?.started) void run(target);
        } else visible.delete(target.name);
      }
    });
    document
      .querySelectorAll<HTMLElement>("[data-connectivity-target]")
      .forEach((node) => observer.observe(node));
  });
  onDestroy(() => {
    observer?.disconnect();
    controllers.forEach((controller) => controller.abort());
  });
</script>

<svelte:head
  ><title>{tr("link.websiteConnectivity")} - One IP</title></svelte:head
>
<div class="sites">
  <ToolHeading title={tr("link.connectivityAndRoutedEgress")}>
    {#snippet icon()}<Network />{/snippet}
  </ToolHeading>
  <SplitResults />
  <h2 class="page-heading">{tr("link.websiteConnectivity")}</h2>
  <nav aria-label={tr("link.websiteConnectivity")}>
    {#each groups as group}
      <a href={`#connectivity-${group}`}>{tr(`link.groups.${group}`)}</a>
    {/each}
  </nav>
  {#each groups as group}
    {@const entries = targets.filter((item) => item.cc === group)}
    {@const checked = entries.filter((item) =>
      results[item.name]?.samples.some((sample) => sample >= 0),
    ).length}
    <section id={`connectivity-${group}`} class="ui-panel">
      <header>
        <h3>{tr(`link.groups.${group}`)}</h3>
        <div class="group-actions">
          <span>{tr("link.readableResponse")} {checked}/{entries.length}</span>
          <button
            class="ui-button"
            type="button"
            onclick={() =>
              entries
                .filter((item) => visible.has(item.name))
                .forEach((item) => void run(item))}
            ><RefreshCw size={14} aria-hidden="true" />{tr(
              "common.testAgain",
            )}</button
          >
        </div>
      </header>
      <table>
        <thead
          ><tr
            ><th scope="col">{tr("common.website")}</th><th scope="col"
              >{tr("common.testHistory")}</th
            ><th scope="col">{tr("common.latency")}</th></tr
          ></thead
        >
        <tbody>
          {#each entries as item (item.name)}
            {@const result = results[item.name]}
            {@const value = result ? median(result.samples) : null}
            {@const icon = iconSource(item.icon)}
            <tr use:observe={item} data-connectivity-target>
              <td>
                <span class="site">
                  {#if icon}
                    <img
                      src={icon}
                      alt=""
                      width="16"
                      height="16"
                      loading="lazy"
                      referrerpolicy="no-referrer"
                      onerror={(event) =>
                        event.currentTarget.setAttribute("hidden", "")}
                    />
                  {/if}
                  {name(item)}
                </span>
              </td>
              <td>
                <div
                  class="samples"
                  aria-label={`${result?.samples.length ?? 0}/8`}
                >
                  {#each Array(8) as _, index}
                    {@const sample = result?.samples[index]}
                    <span
                      class:success={sample != null &&
                        sample >= 0 &&
                        sample < 500}
                      class:slow={sample != null && sample >= 500}
                      class:failed={sample != null && sample < 0}
                    ></span>
                  {/each}
                </div>
              </td>
              <td>
                <span
                  class="latency"
                  class:success={value !== null && value < 500}
                  class:slow={value !== null && value >= 500}
                  class:failed={result?.started &&
                    !result.running &&
                    value === null}
                >
                  {result?.running
                    ? tr("common.testing")
                    : value === null
                      ? result?.started
                        ? tr("link.connectionFailed")
                        : "—"
                      : `${value} ms`}
                </span>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </section>
  {/each}
  <p>{tr("link.browserHttpRequestTimingMedianSuccessfulRequestsAcross")}</p>
</div>

<style>
  .sites {
    display: grid;
    gap: 1rem;
  }
  h2,
  h3,
  p {
    margin: 0;
  }
  h2 {
    font-size: 1.1875rem;
    font-weight: 650;
  }
  h3 {
    font-size: 1rem;
    font-weight: 650;
  }
  .page-heading {
    margin-top: 0.45rem;
  }
  section {
    scroll-margin-top: 5.5rem;
  }
  header,
  .group-actions,
  nav {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.5rem 0.75rem;
  }
  header {
    justify-content: space-between;
    margin-bottom: 0.75rem;
  }
  nav {
    gap: 0.4rem;
  }
  nav a {
    padding: 0.35rem 0.7rem;
    border-radius: 2rem;
    color: var(--primary);
    background: var(--primary-soft);
    font-size: 0.8125rem;
    text-decoration: none;
  }
  nav a:hover {
    background: color-mix(in srgb, var(--primary) 18%, var(--card));
  }
  p,
  .group-actions > span {
    font-size: 0.8125rem;
    color: var(--muted-foreground, var(--color-muted-foreground));
    line-height: 1.55;
  }
  table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    table-layout: fixed;
    font-size: 0.8125rem;
  }
  th,
  td {
    text-align: start;
    padding: 0.65rem 0.6rem;
    border-bottom: 1px solid color-mix(in srgb, var(--border) 66%, transparent);
    overflow-wrap: anywhere;
  }
  th {
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--muted-foreground, var(--color-muted-foreground));
    background: var(--muted, var(--color-muted));
  }
  th:first-child {
    width: 42%;
    border-top-left-radius: 0.5rem;
    border-bottom-left-radius: 0.5rem;
  }
  th:nth-child(2) {
    width: 31%;
  }
  th:last-child {
    border-top-right-radius: 0.5rem;
    border-bottom-right-radius: 0.5rem;
  }
  tbody tr:hover td {
    background: var(--muted);
  }
  tbody tr:last-child td {
    border-bottom: 0;
  }
  .site {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    font-weight: 550;
  }
  img {
    flex: none;
    border-radius: 0.2rem;
    object-fit: contain;
  }
  .samples {
    display: flex;
    flex-wrap: wrap;
    gap: 3px;
  }
  .samples span {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--border, var(--color-border));
  }
  .samples .success {
    background: var(--success);
  }
  .samples .slow {
    background: var(--warning);
  }
  .samples .failed {
    background: var(--danger);
  }
  .latency {
    display: inline-block;
    padding: 0.15rem 0.4rem;
    border-radius: 0.375rem;
    color: var(--muted-foreground, var(--color-muted-foreground));
    background: var(--muted, var(--color-muted));
    font-size: 0.75rem;
    font-variant-numeric: tabular-nums;
  }
  .latency.success {
    color: var(--success);
    background: color-mix(in srgb, var(--success) 9%, transparent);
  }
  .latency.slow {
    color: var(--warning);
    background: color-mix(in srgb, var(--warning) 9%, transparent);
  }
  .latency.failed {
    color: var(--danger);
    background: color-mix(in srgb, var(--danger) 9%, transparent);
  }
  @media (max-width: 440px) {
    th,
    td {
      padding-inline: 0.35rem;
    }
  }
</style>
