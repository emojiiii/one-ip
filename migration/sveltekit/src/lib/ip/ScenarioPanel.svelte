<script lang="ts">
  import type { Locale } from "../i18n";
  import { t as translate } from "./tools-locale";
  import PanelsTopLeft from "@lucide/svelte/icons/panels-top-left";
  import { onMount } from "svelte";
  import { localizedPath } from "../i18n";
  import {
    accessRating,
    averageAccessRating,
    qualityRating,
    type Evidence,
  } from "./scenario-evidence";
  import { measurePlatforms, measureQuality } from "./scenario-probes";
  import type { ScenarioGroup, ScenarioTarget } from "./scenario-targets";

  let { ip, locale }: { ip: string; locale: Locale } = $props();
  function t(key: string, values: readonly unknown[] = []) {
    return translate(key, values, locale);
  }
  let groups = $state<ScenarioGroup[]>([]);
  let targets: ScenarioTarget[] = [];
  let records = $state<Record<string, Evidence>>({});
  let quality = $state<Evidence>();
  let active = $state<string>();
  let busy = $state(false);
  let qualityBusy = $state(false);
  let error = $state("");
  let controller: AbortController;
  let qualityController: AbortController;
  const selected = $derived(groups.find((group) => group.id === active));
  async function run() {
    controller?.abort();
    controller = new AbortController();
    const signal = controller.signal;
    busy = true;
    error = "";
    records = {};
    try {
      await measurePlatforms(ip, targets, signal, (target, value) => {
        if (!signal.aborted) records[target.url] = value;
      });
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
  }
  async function runQuality() {
    qualityController?.abort();
    qualityController = new AbortController();
    const signal = qualityController.signal;
    quality = undefined;
    qualityBusy = true;
    error = "";
    try {
      quality = await measureQuality(ip, signal, (value) => {
        if (!signal.aborted) quality = value;
      });
    } catch (cause) {
      if (!signal.aborted)
        error = cause instanceof Error ? cause.message : String(cause);
    } finally {
      if (!signal.aborted) qualityBusy = false;
    }
  }
  function cancelQuality() {
    qualityController?.abort();
    qualityBusy = false;
  }
  onMount(() => {
    let disposed = false;
    void import("./scenario-targets").then((data) => {
      if (disposed) return;
      const { scenarioGroups, accessTargets } = data.getScenarioTargets(locale);
      groups = scenarioGroups;
      targets = accessTargets;
      void run();
    });
    return () => {
      disposed = true;
      controller?.abort();
      qualityController?.abort();
    };
  });
</script>

<section class="ui-panel">
  <header>
    <h2>
      <PanelsTopLeft size={16} aria-hidden="true" />{t("scenarios.title")}
    </h2>
    <button class="ui-button" onclick={busy ? cancel : run}
      >{t(busy ? "scenarios.stop" : "common.runAgain")}</button
    >
  </header>
  <p>
    {t("scenarios.notice")}
  </p>
  {#if error}<p role="alert">{error}</p>{/if}
  <table>
    <thead
      ><tr
        ><th scope="col">{t("scenarios.scenario")}</th><th scope="col"
          >{t("scenarios.coverage")}</th
        ><th scope="col">{t("scenarios.average")}</th></tr
      ></thead
    ><tbody>
      {#each groups as group}
        {@const summary = averageAccessRating(
          group.targets.map((target) => records[target.url]),
          ip,
        )}
        <tr class:active={active === group.id}
          ><td
            ><button
              class="link"
              onclick={() =>
                (active = active === group.id ? undefined : group.id)}
              aria-expanded={active === group.id}>{group.label}</button
            ></td
          ><td>{summary.rated}/{summary.total}</td><td
            >{summary.average === null ? "—" : `${summary.average} / 5`}</td
          ></tr
        >
      {/each}
    </tbody>
  </table>
  {#if selected}
    <div class="details">
      <h3>{selected.label}</h3>
      <ul>
        {#each selected.targets as target}
          {@const record = records[target.url]}
          {@const rating = accessRating(record, ip)}
          <li>
            {target.name}: {rating.stars === null
              ? !record || record.state === "running"
                ? "…"
                : t("scenarios.unrated")
              : `${rating.stars} / 5 · ${rating.median} ms`}
            {rating.scope === "different"
              ? t("scenarios.differentEgress")
              : rating.scope === "browser"
                ? t("scenarios.browser")
                : ""}
          </li>
        {/each}
      </ul>
      {#if selected.quality}
        <button
          class="ui-button"
          onclick={qualityBusy ? cancelQuality : runQuality}
          >{t(qualityBusy ? "scenarios.cancel" : "scenarios.runQualityTest")}</button
        >
        {@const rating = qualityRating(quality, ip, selected.quality)}
        <p>
          {t("scenarios.quality")}: {rating.stars === null
            ? t("scenarios.notRated")
            : `${rating.stars} / 5`} · {rating.state}
        </p>
        {#if rating.missing.length}<p>
            {t("scenarios.missingEvidence")}: {rating.missing.join(
              ", ",
            )}
          </p>{/if}
      {:else if selected.inbound}<a
          href={`${localizedPath("/ping", locale)}?host=${encodeURIComponent(ip)}`}
          >{t("scenarios.inboundTest")}</a
        >{/if}
    </div>
  {/if}
</section>

<style>
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    flex-wrap: wrap;
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
  h3 {
    font-size: 0.88rem;
  }
  p,
  li {
    color: var(--muted-foreground);
    font-size: 0.8rem;
    line-height: 1.5;
  }
  table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    font-size: 0.8rem;
    font-variant-numeric: tabular-nums;
  }
  th,
  td {
    text-align: start;
    padding: 9px 8px;
    border-bottom: 1px solid color-mix(in srgb, var(--border) 66%, transparent);
  }
  th {
    color: var(--muted-foreground);
    background: var(--muted);
    font-size: 0.74rem;
  }
  th:first-child {
    border-radius: 6px 0 0 6px;
  }
  th:last-child {
    border-radius: 0 6px 6px 0;
  }
  tr.active td {
    background: var(--primary-soft);
  }
  .link {
    border: 0;
    background: none;
    color: var(--primary);
    padding: 0;
    font: inherit;
    text-align: start;
  }
  .link:hover {
    text-decoration: underline;
  }
  .details {
    margin-top: 12px;
    padding: 1px 12px 10px;
    border-radius: 10px;
    background: var(--muted);
  }
</style>
