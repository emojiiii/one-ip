<script lang="ts">
  import { page } from "$app/state";
  import { localeFromPath } from "../../lib/i18n";
  import { onMount } from "svelte";
  import Radar from "@lucide/svelte/icons/radar";
  import Play from "@lucide/svelte/icons/play";
  import ToolHeading from "../../lib/ToolHeading.svelte";
  import {
    getPingNodes,
    runPing,
    type PingNode,
    type PingResponse,
  } from "./api";
  import { selectPingPresets } from "./presets";
  import { t } from "./locale";

  function translate(key: string, values: readonly unknown[] = []) {
    return t(key, values, localeFromPath(page.url.pathname));
  }

  let busy = $state(false),
    loading = $state(true),
    stopped = $state(false);
  let host = $state(""),
    scope = $state("world"),
    full = $state(false),
    search = $state(""),
    error = $state("");
  let nodes = $state<PingNode[]>([]),
    selected = $state<string[]>([]),
    data = $state<PingResponse>();
  let controller: AbortController;
  let presets = $derived(selectPingPresets(nodes, scope, full));
  let filtered = $derived(
    nodes.filter((node) =>
      `${node.name} ${node.city} ${node.cc}`
        .toLowerCase()
        .includes(search.toLowerCase().trim()),
    ),
  );
  let chosen = $derived(
    scope === "custom" ? selected : presets.presetNodes.map((node) => node.id),
  );
  let rows = $derived(
    [...(data?.results ?? [])].sort(
      (a, b) => (b.result.stats?.avg ?? -1) - (a.result.stats?.avg ?? -1),
    ),
  );
  const regions = ["world", "AS", "EU", "NA", "SA", "AF", "OC", "custom"];
  const keys: Record<string, string> = {
    world: "globalCheck",
    AS: "asia",
    EU: "europe",
    NA: "northAmerica",
    SA: "southAmerica",
    AF: "africa",
    OC: "oceania",
    custom: "customRegions",
  };
  function toggle(id: string) {
    selected = selected.includes(id)
      ? selected.filter((item) => item !== id)
      : selected.length < 50
        ? [...selected, id]
        : selected;
  }
  async function start() {
    host = host.trim();
    if (!host || host.length > 253 || !chosen.length || busy) return;
    const url = new URL(location.href);
    url.searchParams.set("host", host);
    history.replaceState(history.state, "", url);
    controller?.abort();
    const current = new AbortController();
    controller = current;
    busy = true;
    stopped = false;
    error = "";
    data = undefined;
    try {
      data = await runPing(
        { host, preferred: scope !== "custom" && !full, nodes: chosen },
        current.signal,
        (next) => {
          if (controller === current) data = next;
        },
      );
    } catch (cause) {
      if (
        !current.signal.aborted &&
        !(cause instanceof DOMException && cause.name === "AbortError")
      )
        error = cause instanceof Error ? cause.message : String(cause);
      else stopped = true;
    } finally {
      if (controller === current) busy = false;
    }
  }
  onMount(() => {
    host = new URL(location.href).searchParams.get("host") ?? "";
    const catalog = new AbortController();
    getPingNodes(catalog.signal)
      .then((value) => (nodes = value))
      .catch((cause) => {
        if (!catalog.signal.aborted)
          error = cause instanceof Error ? cause.message : String(cause);
      })
      .finally(() => (loading = false));
    return () => {
      catalog.abort();
      controller?.abort();
    };
  });
</script>

<svelte:head
  ><title>{translate("ping.globalCheck")}</title
  ></svelte:head
>
<div class="ping">
  <ToolHeading title={translate("ping.globalCheck")}>
    {#snippet icon()}<Radar />{/snippet}
  </ToolHeading>
  <section aria-label={translate("ping.globalCheck")}>
    <form
      onsubmit={(event) => {
        event.preventDefault();
        void start();
      }}
    >
      <input
        class="ui-input"
        dir="auto"
        bind:value={host}
        required
        maxlength="253"
        aria-label={translate("ping.enterAnIpAddressOrDomain")}
        placeholder={translate("ping.enterAnIpAddressOrDomain")}
      />
      <button
        class="ui-button primary"
        disabled={busy || loading || !chosen.length}
      >
        <Play size={14} aria-hidden="true" />{translate("ping.start")}
      </button>
      {#if busy}<button
          class="ui-button"
          type="button"
          onclick={() => controller.abort()}
          >{translate("common.stopTesting")}</button
        >{/if}
    </form>
    <div
      class="regions"
      role="group"
      aria-label={translate("ping.probeRegions")}
    >
      {#each regions as region}
        <button
          class="ui-button ghost"
          type="button"
          disabled={busy}
          aria-pressed={scope === region}
          onclick={() => (scope = region)}
          >{translate(`ping.${keys[region]}`)}</button
        >
      {/each}
    </div>
    {#if scope === "custom"}
      <div class="selection">
        <input
          class="ui-input"
          bind:value={search}
          placeholder={translate("ping.searchCountryCity")}
          aria-label={translate("ping.searchCountryCity")}
        />
        <p>{translate("ping.selected50Cities", [selected.length])}</p>
        <button class="ui-button" type="button" onclick={() => (selected = [])}
          >{translate("ping.clear")}</button
        >
      </div>
      <div class="node-list">
        {#each filtered as node (node.id)}
          <label
            ><input
              type="checkbox"
              checked={selected.includes(node.id)}
              disabled={!selected.includes(node.id) && selected.length >= 50}
              onchange={() => toggle(node.id)}
            />
            {node.cc.toUpperCase()} · {node.city}</label
          >
        {/each}
      </div>
    {:else}
      <div class="options">
        <label
          ><input type="checkbox" bind:checked={full} disabled={busy} />
          {translate("ping.fullCoverage")}</label
        >
        <span>{chosen.length} {translate("ping.probeRegions")}</span>
      </div>
      <p>
        {translate(
          "ping.optimizedModePrioritizes2MainlandChinaCitiesComparison",
        )}
      </p>
    {/if}
    {#if chosen.length > 50}
      <p>
        {translate("ping.in")}
        {Math.ceil(chosen.length / 50)}
        {translate("ping.batches")}
      </p>
    {/if}
  </section>
  {#if error}<p class="error" role="alert">{error}</p>{/if}
  {#if busy || stopped || data}
    <section class="results">
      <header role="status">
        <strong
          >{busy
            ? translate("common.testing")
            : stopped
              ? translate("ping.stopped")
              : translate("ping.measurementComplete")}</strong
        >
        <span
          >{data?.results.filter((item) =>
            ["finished", "failed"].includes(item.result.status),
          ).length ?? 0}</span
        >
      </header>
      <!-- svelte-ignore a11y_no_noninteractive_tabindex (The results can be scrolled with the keyboard.) -->
      <div
        class="table"
        role="region"
        tabindex="0"
        aria-label={translate("ping.globalCheck")}
      >
        <table>
          <thead>
            <tr>
              <th scope="col">{translate("ping.node")}</th>
              <th scope="col">{translate("common.status")}</th>
              <th scope="col">{translate("ping.minimum")}</th>
              <th scope="col">{translate("ping.average")}</th>
              <th scope="col">{translate("ping.maximum")}</th>
              <th scope="col">{translate("common.packetLoss")}</th>
            </tr>
          </thead>
          <tbody>
            {#each rows as row}
              <tr>
                <td
                  ><strong>{row.probe.country} · {row.probe.city}</strong><span
                    class="network">{row.probe.network}</span
                  ></td
                >
                <td
                  ><span
                    class="result-state"
                    class:finished={row.result.status === "finished"}
                    class:failed={row.result.status === "failed"}
                    >{row.result.status === "finished"
                      ? translate("ping.measurementComplete")
                      : row.result.status === "failed"
                        ? translate("ping.failed")
                        : row.result.status}</span
                  ></td
                >
                <td>{row.result.stats?.min?.toFixed(1) ?? "—"}</td>
                <td class="average">{row.result.stats?.avg?.toFixed(1) ?? "—"}</td>
                <td>{row.result.stats?.max?.toFixed(1) ?? "—"}</td>
                <td
                  >{row.result.stats?.loss == null
                    ? "—"
                    : `${row.result.stats.loss}%`}</td
                >
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </section>
  {/if}
</div>

<style>
  .ping {
    display: grid;
    gap: 0.9rem;
  }
  section {
    min-width: 0;
    padding: clamp(1rem, 2vw, 1.25rem);
    border-radius: var(--radius, 0.75rem);
    background: var(--card, var(--color-card));
  }
  form,
  .regions,
  .options,
  .selection,
  header {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  form input,
  .selection input {
    flex: 1;
    min-width: min(100%, 12rem);
    border-color: transparent;
    background: var(--muted);
  }
  form input, form .primary { min-height: 2.7rem; }
  input[type="checkbox"] {
    accent-color: var(--primary, var(--color-primary));
  }
  button {
    cursor: pointer;
  }
  button:disabled {
    cursor: default;
  }
  .regions {
    margin: 0.9rem 0 0.75rem;
    gap: .25rem;
  }
  .regions button {
    min-width: 0;
  }
  .regions button[aria-pressed="true"] {
    border-color: transparent;
    color: var(--primary, var(--color-primary));
    background: var(--primary-soft);
    font-weight: 600;
  }
  p,
  .options span,
  header span {
    color: var(--muted-foreground, var(--color-muted-foreground));
    font-size: 0.8125rem;
    line-height: 1.55;
  }
  p {
    margin: 0.45rem 0 0;
  }
  label {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.8125rem;
  }
  .selection p {
    margin: 0;
  }
  .node-list {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 12rem), 1fr));
    gap: 0.25rem;
    max-height: 15rem;
    margin-top: 0.6rem;
    overflow: auto;
  }
  .node-list label {
    padding: 0.3rem 0.45rem;
    border-radius: 0.375rem;
  }
  .node-list label:hover {
    background: var(--muted, var(--color-muted));
  }
  .error {
    margin: 0;
    padding: 0.75rem 1rem;
    color: var(--danger);
    background: color-mix(in srgb, var(--danger) 8%, transparent);
    border-radius: var(--radius, 0.75rem);
  }
  header {
    justify-content: space-between;
    margin-bottom: 0.75rem;
    font-size: 0.9375rem;
  }
  header span,
  td {
    font-variant-numeric: tabular-nums;
  }
  header span { padding: .15rem .5rem; background: var(--muted); border-radius: .4rem; }
  .table {
    overflow-x: auto;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.8125rem;
  }
  th,
  td {
    padding: .65rem .75rem;
    border-bottom: 1px solid color-mix(in srgb, var(--border) 65%, transparent);
    text-align: start;
    white-space: nowrap;
  }
  th {
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--muted-foreground, var(--color-muted-foreground));
    background: var(--muted, var(--color-muted));
  }
  th:nth-child(n + 3), td:nth-child(n + 3) { text-align: end; }
  td.average { color: var(--primary); font-weight: 650; }
  tbody tr:last-child td {
    border-bottom: 0;
  }
  .network {
    display: block;
    margin-top: 0.15rem;
    color: var(--muted-foreground, var(--color-muted-foreground));
    font-size: 0.75rem;
  }
  .result-state {
    display: inline-block;
    padding: 0.15rem 0.45rem;
    border-radius: 0.375rem;
    color: var(--muted-foreground, var(--color-muted-foreground));
    background: var(--muted, var(--color-muted));
  }
  .result-state.finished {
    color: var(--success);
    background: color-mix(in srgb, var(--success) 10%, transparent);
  }
  .result-state.failed {
    color: var(--danger);
    background: color-mix(in srgb, var(--danger) 10%, transparent);
  }
</style>
