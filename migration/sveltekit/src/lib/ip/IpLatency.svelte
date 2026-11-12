<script lang="ts">
  import type { Locale } from "../i18n";
  import { t as translate } from "./tools-locale";
  import Radar from "@lucide/svelte/icons/radar";
  import { onMount } from "svelte";
  import {
    getPingNodes,
    runPing,
    type PingNode,
    type PingResponse,
  } from "../../routes/ping/api";
  import { localizedPath } from "../i18n";
  import { sameIp } from "./ip-address";
  import { latencyCountries, selectLatencyNodes } from "./latency-presets";
  let { ip, locale }: { ip: string; locale: Locale } = $props();
  function t(key: string, values: readonly unknown[] = []) {
    return translate(key, values, locale);
  }
  const countries = latencyCountries;
  let nodes = $state<{ cc: string; node?: PingNode }[]>(
    countries.map((cc) => ({ cc })),
  );
  let data = $state<PingResponse>();
  let busy = $state(false);
  let started = $state(false);
  let error = $state("");
  let controller: AbortController;
  const regionNames = $derived(
    new Intl.DisplayNames([locale], { type: "region" }),
  );
  async function start() {
    controller?.abort();
    controller = new AbortController();
    const signal = controller.signal;
    nodes = countries.map((cc) => ({ cc }));
    data = undefined;
    busy = true;
    started = true;
    error = "";
    try {
      const catalog = await getPingNodes(signal);
      nodes = selectLatencyNodes(catalog);
      const ids = nodes.flatMap((item) => (item.node ? [item.node.id] : []));
      if (!ids.length) throw new Error(t("latency.noPreferredProbes"));
      await runPing(
        { host: ip, nodes: ids, preferred: true },
        signal,
        (result) => {
          if (!signal.aborted && sameIp(result.target, ip)) data = result;
        },
      );
    } catch (cause) {
      if (!signal.aborted)
        error = cause instanceof Error ? cause.message : String(cause);
    } finally {
      if (!signal.aborted) busy = false;
    }
  }
  function cancel() {
    controller?.abort();
    busy = false;
    error = t("latency.cancelled");
  }
  onMount(() => () => controller?.abort());
</script>

<section class="ui-panel">
  <header>
    <h2>
      <Radar size={16} aria-hidden="true" />{t("latency.title")}
    </h2>
    <div class="actions">
      <a class="ui-button ghost" href={`${localizedPath("/ping", locale)}?host=${encodeURIComponent(ip)}`}
        >{t("latency.fullTest")}
        <span aria-hidden="true">›</span></a
      >
      {#if busy}<button class="ui-button" onclick={cancel}
          >{t("latency.stop")}</button
        >{:else}<button class="ui-button" onclick={start}
          >{t(started ? "common.runAgain" : "latency.start")}</button
        >{/if}
    </div>
  </header>
  {#if error}<p role="alert">{error}</p>{/if}
  <div class="grid">
    {#each nodes as item}
      {@const result = data?.results.find(
        (entry) => entry.probe.country.toLowerCase() === item.cc,
      )}
      {@const stats = result?.result.stats}
      <div>
        <span
          >{regionNames.of(item.cc.toUpperCase()) ??
            item.cc.toUpperCase()}</span
        ><strong class:good={stats && stats.loss < 100 && stats.avg < 250}
          >{stats && stats.loss < 100 && Number.isFinite(stats.avg)
            ? `${Math.round(stats.avg)} ms`
            : busy
              ? "…"
              : started
                ? "—"
                : t("latency.notChecked")}</strong
        >{#if stats && stats.loss > 0}<small
            >{t("latency.loss")} {stats.loss}%</small
          >{/if}
      </div>
    {/each}
  </div>
</section>

<style>
  header,
  .actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  header {
    justify-content: space-between;
  }
  h2 {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 1rem;
    font-weight: 650;
    margin: 0;
  }
  h2 :global(svg) {
    color: var(--primary);
  }
  a {
    color: var(--muted-foreground);
    text-decoration: none;
    font-size: 0.75rem;
  }
  a:hover {
    color: var(--primary);
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
    gap: 8px;
    margin-top: 12px;
  }
  .grid div {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 6px;
    flex-wrap: wrap;
    padding: 10px;
    background: var(--muted);
    border-radius: 10px;
    font-size: 0.79rem;
  }
  strong {
    font-weight: 650;
    font-variant-numeric: tabular-nums;
  }
  strong.good {
    color: var(--success);
  }
  small {
    width: 100%;
    color: var(--muted-foreground);
  }
  p {
    color: var(--danger);
    font-size: 0.8rem;
  }
</style>
