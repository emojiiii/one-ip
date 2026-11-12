<script lang="ts">
  import { page } from "$app/state";
  import { localeFromPath } from "../../lib/i18n";
  import { onMount } from "svelte";
  import Gauge from "@lucide/svelte/icons/gauge";
  import Play from "@lucide/svelte/icons/play";
  import ToolHeading from "../../lib/ToolHeading.svelte";
  import {
    DOWNLOAD_LIMIT,
    TRANSFER_SECONDS,
    UPLOAD_LIMIT,
    emptyResult,
    measureSpeed,
    type Phase,
    type Transfer,
  } from "./api";
  import { t } from "./locale";

  function translate(key: string, values: readonly unknown[] = []) {
    return t(key, values, localeFromPath(page.url.pathname));
  }

  let result = $state(emptyResult());
  let multiple = $state(false);
  let busy = $state(false);
  let error = $state("");
  let controller: AbortController | undefined;
  const phases: Record<Phase, string> = {
    idle: "ready",
    latency: "testingLatency",
    download: "testingDownload",
    upload: "testingUpload",
    complete: "complete",
    stopped: "stopped",
    error: "error",
  };
  const format = (value: number | undefined) =>
    value == null ? "—" : value.toFixed(1);
  const directions = ["download", "upload"] as const;
  const megabytes = (bytes: number) => `${(bytes / 1_000_000).toFixed(1)} MB`;
  function chart(points: Transfer["points"]) {
    const ceiling = Math.ceil(
      Math.max(10, ...points.map((point) => point.mbps)) * 1.15,
    );
    const coordinates = points.map(({ seconds, mbps }) => [
      Math.min(600, (seconds / TRANSFER_SECONDS) * 600),
      100 - (mbps / ceiling) * 100,
    ]);
    const line = coordinates
      .map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`)
      .join(" ");
    const area = coordinates.length
      ? `${line} L${coordinates[coordinates.length - 1][0].toFixed(1)},100 L${coordinates[0][0].toFixed(1)},100 Z`
      : "";
    return { ceiling, line, area };
  }
  async function start() {
    if (busy) return;
    const current = new AbortController();
    controller = current;
    busy = true;
    error = "";
    result = emptyResult();
    try {
      await measureSpeed(
        multiple ? 4 : 1,
        current.signal,
        (next) => (result = next),
      );
    } catch {
      if (current.signal.aborted) result = { ...result, phase: "stopped" };
      else {
        result = { ...result, phase: "error" };
        error = translate("speedtest.failed");
      }
    } finally {
      current.abort();
      if (controller === current) {
        controller = undefined;
        busy = false;
      }
    }
  }
  onMount(() => {
    const hide = () => {
      if (document.hidden) controller?.abort();
    };
    document.addEventListener("visibilitychange", hide);
    return () => {
      document.removeEventListener("visibilitychange", hide);
      controller?.abort();
    };
  });
</script>

<svelte:head
  ><title>{translate("speedtest.title")}</title
  ></svelte:head
>
<div class="speedtest">
  <ToolHeading title={translate("speedtest.title")} description={translate("speedtest.endpoint")}>
    {#snippet icon()}<Gauge />{/snippet}
  </ToolHeading>
  <section class="controls" aria-label={translate("speedtest.title")}>
    <div class="actions">
      <button class="ui-button primary" onclick={start} disabled={busy}>
        <Play size={14} aria-hidden="true" />{translate("speedtest.start")}
      </button>
      {#if busy}<button class="ui-button" onclick={() => controller?.abort()}
          >{translate("speedtest.stop")}</button
        >{/if}
    </div>
    <label>
      <input type="checkbox" bind:checked={multiple} disabled={busy} />
      {translate("speedtest.multiple")}
    </label>
    <p>
      {translate("speedtest.trafficNotice", [
        megabytes(DOWNLOAD_LIMIT),
        megabytes(UPLOAD_LIMIT),
        TRANSFER_SECONDS,
      ])}
    </p>
  </section>

  <section class="overview" aria-label={translate("speedtest.latency")}>
    <dl>
      <div>
        <dt>{translate("speedtest.latency")}</dt>
        <dd>{format(result.latency)} <small>ms</small></dd>
      </div>
      <div>
        <dt>{translate("speedtest.jitter")}</dt>
        <dd>{format(result.jitter)} <small>ms</small></dd>
      </div>
    </dl>
    <p class="phase" class:busy role="status">
      {translate(`speedtest.${phases[result.phase]}`)}
    </p>
  </section>
  {#if error}<p class="error" role="alert">{error}</p>{/if}

  <div class="transfers">
    {#each directions as direction}
      {@const transfer = result[direction]}
      {@const title = translate(`speedtest.${direction}`)}
      {@const curve = chart(transfer.points)}
      <section class="transfer" data-direction={direction}>
        <header>
          <h2>
            <span class="direction" aria-hidden="true"
              >{direction === "download" ? "↓" : "↑"}</span
            >{title}
          </h2>
          {#if busy && result.phase === direction}
            <span class="phase busy">{translate("speedtest.measuring")}</span>
          {:else if transfer.complete}
            <span class="phase">{translate("speedtest.complete")}</span>
          {:else if transfer.bytes > 0 && (result.phase === "stopped" || result.phase === "error")}
            <span class="phase">{translate("speedtest.partial")}</span>
          {/if}
        </header>
        <p class="speed">{format(transfer.mbps)} <small>Mbps</small></p>
        <div class="curve">
          <div class="axis" aria-hidden="true">
            <span>{curve.ceiling} Mbps</span><span
              >{translate("speedtest.averageCurve")}</span
            >
          </div>
          <svg
            viewBox="0 0 600 104"
            preserveAspectRatio="none"
            role="img"
            aria-label={translate("speedtest.curveLabel", [title])}
          >
            {#each [2, 50, 100] as y}
              <line
                x1="0"
                x2="600"
                y1={y}
                y2={y}
                stroke-dasharray="3 5"
                vector-effect="non-scaling-stroke"
              />
            {/each}
            {#if curve.area}<path
                d={curve.area}
                fill="currentColor"
                opacity=".09"
              />{/if}
            {#if curve.line}<path
                d={curve.line}
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linejoin="round"
                vector-effect="non-scaling-stroke"
              />{/if}
          </svg>
          <div class="axis" aria-hidden="true">
            <span>0 s</span><span>{TRANSFER_SECONDS} s</span>
          </div>
        </div>
        <dl class="transfer-details">
          <div>
            <dt>{translate("speedtest.loadedLatency")}</dt>
            <dd>{format(transfer.loadedLatency)} ms</dd>
          </div>
          <div>
            <dt>
              {translate(
                direction === "download"
                  ? "speedtest.downloaded"
                  : "speedtest.uploaded",
              )}
            </dt>
            <dd>{megabytes(transfer.bytes)}</dd>
          </div>
        </dl>
      </section>
    {/each}
  </div>

  {#if result.node}
    <dl class="node">
      <div>
        <dt>{translate("speedtest.egress")}</dt>
        <dd>{result.node.ip}</dd>
      </div>
      {#if result.node.colo}<div>
          <dt>{translate("speedtest.node")}</dt>
          <dd>{result.node.colo}</dd>
        </div>{/if}
    </dl>
  {/if}
  <footer>
    <p>{translate("speedtest.description")}</p>
    <p>{translate("speedtest.methodNotice")}</p>
    <p>{translate("speedtest.uploadNotice")}</p>
  </footer>
</div>

<style>
  .speedtest {
    display: grid;
    gap: 0.9rem;
  }
  h2,
  p,
  dl,
  dd {
    margin: 0;
  }
  h2 {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.9375rem;
    font-weight: 650;
  }
  p,
  dt,
  small,
  .axis {
    color: var(--muted-foreground, var(--color-muted-foreground));
    font-size: 0.8125rem;
    line-height: 1.55;
  }
  section {
    min-width: 0;
    padding: clamp(1rem, 2vw, 1.25rem);
    border-radius: var(--radius, 0.75rem);
    background: var(--card, var(--color-card));
  }
  .controls,
  .actions,
  label,
  .overview,
  .transfer header,
  .axis,
  .node,
  .node div {
    display: flex;
    align-items: center;
    gap: 0.65rem;
  }
  .controls,
  .overview,
  .transfer header,
  .axis {
    justify-content: space-between;
    flex-wrap: wrap;
  }
  .controls p {
    flex-basis: 100%;
    margin-top: 0.1rem;
  }
  .controls .primary { min-height: 2.6rem; padding-inline: .9rem; }
  label {
    font-size: 0.875rem;
  }
  input[type="checkbox"] {
    accent-color: var(--primary, var(--color-primary));
  }
  button {
    cursor: pointer;
  }
  button:disabled {
    cursor: default;
  }
  .overview dl {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem clamp(1rem, 6vw, 4rem);
  }
  .overview dd {
    margin-top: 0.2rem;
    font-size: 1.65rem;
    font-weight: 650;
    letter-spacing: -.035em;
    font-variant-numeric: tabular-nums;
  }
  .phase {
    display: inline-flex;
    padding: 0.2rem 0.55rem;
    border-radius: 999px;
    background: var(--muted, var(--color-muted));
    color: var(--muted-foreground, var(--color-muted-foreground));
    font-size: 0.75rem;
  }
  .phase.busy {
    color: var(--primary, var(--color-primary));
    background: color-mix(
      in srgb,
      var(--primary, var(--color-primary)) 11%,
      transparent
    );
  }
  .error {
    padding: 0.75rem 1rem;
    color: var(--danger);
    border-radius: var(--radius, 0.75rem);
    background: color-mix(in srgb, var(--danger) 8%, transparent);
  }
  .transfers {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.9rem;
  }
  .transfer {
    --transfer-tone: var(--primary);
  }
  .transfer[data-direction="upload"] {
    --transfer-tone: color-mix(in srgb, var(--primary) 45%, #8072ce);
  }
  .direction {
    display: grid;
    place-items: center;
    width: 1.6rem;
    height: 1.6rem;
    border-radius: 0.4rem;
    color: var(--transfer-tone);
    background: color-mix(
      in srgb,
      var(--transfer-tone) 10%,
      transparent
    );
  }
  .speed {
    margin: 0.5rem 0 0.8rem;
    color: inherit;
    font-size: clamp(2.3rem, 5vw, 3.5rem);
    line-height: 1.2;
    font-weight: 650;
    letter-spacing: -0.045em;
    font-variant-numeric: tabular-nums;
  }
  .speed small {
    font-weight: 500;
    letter-spacing: 0;
  }
  .curve { padding: .65rem .7rem .5rem; border-radius: .65rem; background: var(--muted); }
  .curve svg {
    display: block;
    width: 100%;
    height: 5.5rem;
    color: var(--transfer-tone);
  }
  .curve line {
    stroke: var(--border, var(--color-border));
  }
  .axis {
    font-size: 0.6875rem;
    font-variant-numeric: tabular-nums;
  }
  .transfer-details {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.5rem;
    margin-top: 0.75rem;
    padding-top: 0.75rem;
    border-top: 1px solid var(--border, var(--color-border));
  }
  .transfer-details dd,
  .node dd {
    font-size: 0.875rem;
    font-variant-numeric: tabular-nums;
  }
  .node {
    flex-wrap: wrap;
  }
  .node dd {
    overflow-wrap: anywhere;
  }
  footer {
    display: grid;
    gap: 0.3rem;
  }
  @media (max-width: 560px) {
    .transfers {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
