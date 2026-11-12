<script lang="ts">
  import ShieldCheck from "@lucide/svelte/icons/shield-check";
  import RefreshCw from "@lucide/svelte/icons/refresh-cw";
  import { onMount } from "svelte";
  import type { Locale } from "../../../lib/i18n";
  import {
    SIGNALS,
    riskBand,
    type DetectOutcome,
  } from "../../../../../../vendor/claude-environment/signals";
  import { t } from "./locale";
  import { maskedIp } from "../../leak/webrtc/network";
  import { detectSignal, summarizeSignals } from "./score";
  let {
    country = "",
    ip = "",
    locale,
    hidden = false,
  }: {
    country?: string;
    ip?: string;
    locale: Locale;
    hidden?: boolean;
  } = $props();
  let outcomes = $state<(DetectOutcome | undefined)[]>([]);
  let running = $state(true);
  let fallbackCountry = $state("");
  let fallbackIp = $state("");
  const tr = (key: string) => t(key, [], locale);
  const ids: Record<string, string> = {
    timezone: "timezone",
    language: "language",
    fonts: "chineseFonts",
    vendorFonts: "vendorFonts",
    webrtcLeak: "webrtc",
    cnBrowser: "browser",
    deviceVendor: "deviceVendor",
    intlLocale: "dateLocale",
    timezoneOffset: "timezoneOffset",
    emoji: "emoji",
  };
  let summary = $derived(summarizeSignals(outcomes));
  let total = $derived(summary.total);
  function validCountry(value: string) {
    const code = value.trim().toUpperCase();
    return /^[A-Z]{2}$/.test(code) && code !== "XX" && code !== "ZZ"
      ? code
      : "";
  }
  let actualCountry = $derived(
    validCountry(country) || validCountry(fallbackCountry),
  );
  let complete = $derived(summary.complete && !!actualCountry);
  let band = $derived(actualCountry === "CN" ? "high" : riskBand(total));
  async function run() {
    running = true;
    const requests = SIGNALS.map(async (signal) => {
      try {
        return await detectSignal(signal);
      } catch {
        return undefined;
      }
    });
    outcomes = await Promise.all(requests);
    running = false;
  }
  onMount(() => {
    void run();
    void fetch("/api/me")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        fallbackCountry = data?.country_code || "";
        fallbackIp = data?.ip || "";
      })
      .catch(() => {});
  });
</script>

<section class="ui-panel">
  <header>
    <h2>
      <ShieldCheck size={16} aria-hidden="true" />{tr(
        "claude.environmentSignalScoreNotAnOfficialClaudeAssessment",
      )}
    </h2>
    <button class="ui-button" type="button" disabled={running} onclick={run}>
      <RefreshCw size={15} aria-hidden="true" />{tr("ai.runAgain")}
    </button>
  </header>
  <div class="result" role="status">
    <div class="score">
      {#if !running}<strong>{total}<small> / 100</small></strong>{/if}
      <span class="badge" data-band={complete && !running ? band : undefined}>
        {running
          ? tr("claude.checkingEnvironmentSignals")
          : complete
            ? tr(`claude.${band}Risk`)
            : tr("claude.incompleteDetection")}
      </span>
    </div>
    <p class="egress">
      {ip || fallbackIp ? maskedIp(ip || fallbackIp, hidden) : "—"} · {actualCountry ||
        tr("claude.egressCountryUnknown")}
    </p>
  </div>
  {#if !complete && !running}
    <p>{tr("claude.partialScoreIncludesCompletedChecksCompleteRiskBand")}</p>
  {/if}
  <details>
    <summary>{tr("claude.viewDetectionLogs")}</summary>
    <dl>
      {#each SIGNALS as definition, i (definition.id)}
        <div>
          <dt>{tr(`claude.signals.${ids[definition.id]}`)}</dt>
          <dd>{outcomes[i]?.raw || tr("claude.detectionFailedOrTimedOut")}</dd>
        </div>
      {/each}
    </dl>
  </details>
  <p>{tr("claude.usesProjectSTenDetectorsOriginalWeightsHeuristic")}</p>
</section>

<style>
  section {
    display: grid;
    gap: 0.9rem;
  }
  header,
  .result,
  .score {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.5rem 0.75rem;
  }
  header,
  .result {
    justify-content: space-between;
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
    gap: 8px;
    font-size: 1rem;
    font-weight: 650;
  }
  h2 :global(svg) {
    flex: none;
    color: var(--primary);
  }
  p,
  dd,
  small {
    color: var(--muted-foreground, var(--color-muted-foreground));
    font-size: 0.8125rem;
    line-height: 1.55;
    overflow-wrap: anywhere;
  }
  .result {
    padding: 0.8rem 1rem;
    border-radius: 0.75rem;
    background: var(--primary-soft);
  }
  .score strong {
    font-size: clamp(1.75rem, 4vw, 2.25rem);
    font-weight: 720;
    line-height: 1.2;
    letter-spacing: -0.045em;
    font-variant-numeric: tabular-nums;
  }
  .egress {
    font-variant-numeric: tabular-nums;
  }
  .badge {
    --tone: var(--muted-foreground, var(--color-muted-foreground));
    padding: 0.15rem 0.45rem;
    border-radius: 0.375rem;
    color: var(--tone);
    background: color-mix(in srgb, var(--tone) 10%, transparent);
    font-size: 0.75rem;
  }
  .badge[data-band="low"] {
    --tone: var(--success);
  }
  .badge[data-band="medium"] {
    --tone: var(--warning);
  }
  .badge[data-band="high"] {
    --tone: var(--danger);
  }
  details {
    padding: 0.7rem 0.85rem;
    border-radius: 0.65rem;
    background: var(--muted);
  }
  summary {
    cursor: pointer;
    font-size: 0.875rem;
    font-weight: 550;
  }
  dl {
    margin-top: 0.5rem;
  }
  dl div {
    display: grid;
    grid-template-columns: minmax(7rem, 1fr) minmax(0, 3fr);
    gap: 0.5rem;
    padding: 0.4rem 0;
    border-top: 1px solid var(--border, var(--color-border));
  }
  dt {
    font-size: 0.8125rem;
    font-weight: 550;
  }
  @media (max-width: 450px) {
    dl div {
      grid-template-columns: minmax(0, 1fr);
      gap: 0.15rem;
    }
  }
</style>
