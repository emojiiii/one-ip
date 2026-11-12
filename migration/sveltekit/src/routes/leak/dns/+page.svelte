<script lang="ts">
  import { page } from "$app/state";
  import { localeFromPath } from "../../../lib/i18n";
  import { onMount } from "svelte";
  import ShieldCheck from "@lucide/svelte/icons/shield-check";
  import RefreshCw from "@lucide/svelte/icons/refresh-cw";
  import ToolHeading from "../../../lib/ToolHeading.svelte";
  import {
    assessDnsLeak,
    detectDnsExits,
    dnsSampleCount,
    publicDnsProvider,
    type DnsProgress,
  } from "./api";
  import { t } from "./locale";
  import {
    detectHttpEgress,
    egressAddresses,
    type HttpEgress,
  } from "../webrtc/http-egress";
  function translate(key: string, values: readonly unknown[] = []) {
    return t(key, values, localeFromPath(page.url.pathname));
  }

  let busy = $state(true);
  let error = $state("");
  let progress = $state<DnsProgress>({
    results: [],
    count: 0,
    failed: 0,
    failures: {},
  });
  let egress = $state<HttpEgress | undefined>();
  let egressBusy = $state(true);
  let controller: AbortController;
  let assessment = $derived(
    assessDnsLeak(
      progress.results,
      egressAddresses(egress).map((geo) => geo.country_code),
    ),
  );
  let level = $derived(
    egressBusy || (busy && !progress.results.length)
      ? "pending"
      : assessment.level,
  );
  let detail = $derived(
    !progress.results.length
      ? translate("dns.verdictNoResolvers")
      : !assessment.egressCountries.length
        ? translate("dns.verdictNoEgress")
        : assessment.level === "leak"
          ? translate("dns.verdictLeak", [
              assessment.mismatched.length,
              assessment.mismatched.map((r) => r.country).join(", "),
            ])
          : assessment.level === "warning"
            ? translate("dns.verdictPartial", [assessment.unknown])
            : assessment.level === "unknown"
              ? translate("dns.verdictNoEgress")
              : translate("dns.verdictSafe", [
                  assessment.egressCountries.join(", "),
                ]),
  );
  async function run() {
    controller?.abort();
    const current = new AbortController();
    controller = current;
    busy = true;
    egressBusy = true;
    error = "";
    egress = undefined;
    progress = { results: [], count: 0, failed: 0, failures: {} };
    const egressTask = detectHttpEgress(current.signal)
      .then((value) => {
        if (controller === current) egress = value;
      })
      .catch(() => undefined)
      .finally(() => {
        if (controller === current) egressBusy = false;
      });
    try {
      await detectDnsExits(current.signal, (next) => {
        if (controller === current) progress = next;
      });
    } catch (cause) {
      if (!current.signal.aborted)
        error = cause instanceof Error ? cause.message : String(cause);
    } finally {
      if (controller === current) busy = false;
    }
    await egressTask;
  }
  onMount(() => {
    void run();
    return () => controller.abort();
  });
</script>

<svelte:head
  ><title>{translate("dns.dnsEgressLookup")}</title
  ></svelte:head
>
<div class="dns">
  <ToolHeading
    title={translate("dns.dnsEgressLookup")}
  >
    {#snippet icon()}<ShieldCheck />{/snippet}
    <button class="ui-button" disabled={busy} onclick={run}>
      <RefreshCw size={15} aria-hidden="true" />{translate(
        busy ? "common.checkingDots" : "common.runAgain",
      )}
    </button>
  </ToolHeading>
  <section class="ui-panel">
    <div class="verdict" data-level={level} role="status">
      <h2>{translate(`dns.conclusion.${level}`)}</h2>
      <p>{level === "pending" ? translate("dns.verdictPending") : detail}</p>
    </div>
    <dl>
      <div>
        <dt>HTTP IPv4</dt>
        <dd>{egress?.ipv4?.ip ?? "—"}</dd>
      </div>
      <div>
        <dt>HTTP IPv6</dt>
        <dd>{egress?.ipv6?.ip ?? "—"}</dd>
      </div>
      <div>
        <dt>{translate("dns.resolverTotal")}</dt>
        <dd>{progress.results.length}</dd>
      </div>
      <div>
        <dt>{translate("dns.resolverCountries")}</dt>
        <dd>
          {new Set(progress.results.flatMap((r) => r.country ?? [])).size}
        </dd>
      </div>
    </dl>
  </section>
  {#if error}<p class="error" role="alert">{error}</p>{/if}
  <section class="ui-panel">
    <header>
      <h2>{translate("dns.dnsEgressIp")}</h2>
      <span class="samples"
        >{progress.count}/{dnsSampleCount}
        {translate("dns.samples")} · {progress.failed}
        {translate("dns.failures")}</span
      >
    </header>
    {#if progress.results.length}
      <!-- svelte-ignore a11y_no_noninteractive_tabindex (The results can be scrolled with the keyboard.) -->
      <div
        class="table"
        role="region"
        tabindex="0"
        aria-label={translate("dns.dnsEgressIp")}
      >
        <table>
          <thead>
            <tr>
              <th scope="col">{translate("dns.dnsEgressIp")}</th>
              <th scope="col">{translate("dns.locationIsp")}</th>
              <th scope="col">{translate("dns.comparison")}</th>
              <th scope="col">{translate("dns.detectionSource")}</th>
              <th scope="col">{translate("dns.observations")}</th>
            </tr>
          </thead>
          <tbody>
            {#each progress.results as row (row.ip)}
              <tr>
                <td class="address"><bdi dir="ltr">{row.ip}</bdi></td><td
                  >{row.geo} {publicDnsProvider(row.isp) ?? ""}</td
                >
                <td
                  ><span class="relation"
                    >{translate(
                      `dns.relation.${assessment.relations[row.ip] ?? "unknown"}`,
                    )}</span
                  ></td
                >
                <td>{row.sources.join(", ")}</td><td>{row.samples}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      <p>
        {translate("dns.identicalEgressAddressesMergedTheirCountDependsActual")}
      </p>
    {:else}
      <p class="empty">
        {translate(
          busy ? "dns.waitingForResolutionResults" : "dns.noDnsEgressDetected",
        )}
      </p>
    {/if}
    {#if progress.failed}
      <p>
        {translate("dns.someProbesFailedDoesMeanThereDnsLeaks")}
        {Object.entries(progress.failures)
          .map(([source, count]) => `${source}: ${count}`)
          .join(" · ")}
      </p>
    {/if}
  </section>
  <div class="ui-panel questions">
    {#each ["what", "how", "limits", "fix"] as key}
      <details>
        <summary>{translate(`dns.faq.${key}Title`)}</summary>
        <p>{translate(`dns.faq.${key}Text`)}</p>
      </details>
    {/each}
  </div>
</div>

<style>
  .dns {
    display: grid;
    gap: 1rem;
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 0.5rem 0.75rem;
  }
  h2,
  p,
  dl,
  dd {
    margin: 0;
  }
  h2 {
    font-size: 1rem;
    font-weight: 650;
  }
  p,
  dt,
  .samples {
    font-size: 0.8125rem;
    line-height: 1.55;
    color: var(--muted-foreground, var(--color-muted-foreground));
  }
  section > p {
    margin-top: 0.65rem;
  }
  .verdict {
    --tone: var(--primary);
    position: relative;
    padding: 1rem;
    padding-inline-start: 2.1rem;
    border-radius: 0.75rem;
    background: color-mix(in srgb, var(--tone) 8%, var(--card));
  }
  .verdict::before {
    position: absolute;
    top: 1.45rem;
    inset-inline-start: 1rem;
    width: 0.45rem;
    height: 0.45rem;
    border-radius: 50%;
    background: var(--tone);
    box-shadow: 0 0 0 4px color-mix(in srgb, var(--tone) 17%, transparent);
    content: "";
  }
  .verdict[data-level="safe"] {
    --tone: var(--success);
  }
  .verdict[data-level="warning"] {
    --tone: var(--warning);
  }
  .verdict[data-level="leak"] {
    --tone: var(--danger);
  }
  .verdict h2 {
    color: var(--tone);
  }
  .verdict p {
    margin-top: 0.25rem;
  }
  dl {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0.75rem;
    margin-top: 1rem;
  }
  dl div {
    padding: 0.65rem 0.75rem;
    border-radius: 0.625rem;
    background: var(--muted);
  }
  dd {
    margin-top: 0.2rem;
    font-size: 1rem;
    font-weight: 650;
    overflow-wrap: anywhere;
  }
  dd,
  .address,
  .samples,
  td:last-child {
    font-variant-numeric: tabular-nums;
  }
  .table {
    overflow-x: auto;
    border-radius: 0.65rem;
    margin-top: 0.75rem;
  }
  table {
    border-collapse: collapse;
    width: 100%;
    font-size: 0.8125rem;
  }
  th,
  td {
    padding: 0.7rem 0.75rem;
    text-align: start;
    white-space: nowrap;
    border-bottom: 1px solid color-mix(in srgb, var(--border) 66%, transparent);
  }
  th {
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--muted-foreground, var(--color-muted-foreground));
    background: var(--muted, var(--color-muted));
  }
  tbody tr:last-child td {
    border-bottom: 0;
  }
  tbody tr:hover td {
    background: var(--muted);
  }
  .relation {
    display: inline-block;
    padding: 0.15rem 0.45rem;
    border-radius: 0.375rem;
    background: var(--muted, var(--color-muted));
  }
  .empty {
    padding: 0.75rem 0;
    text-align: center;
  }
  .questions {
    padding-block: 0.25rem;
  }
  .questions details + details {
    border-top: 1px solid var(--border, var(--color-border));
  }
  summary {
    cursor: pointer;
    padding: 0.7rem 0;
    font-size: 0.875rem;
    font-weight: 550;
  }
  details p {
    padding-bottom: 0.75rem;
  }
  .error {
    padding: 0.7rem 0.85rem;
    border-radius: 0.65rem;
    color: var(--danger);
    background: var(--danger-soft);
  }
  @media (max-width: 600px) {
    dl {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
</style>
