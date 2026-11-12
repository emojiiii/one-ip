<script lang="ts">
  import { page } from "$app/state";
  import { localeFromPath, localizedPath } from "../../../lib/i18n";
  import { onMount, onDestroy } from "svelte";
  import Sparkles from "@lucide/svelte/icons/sparkles";
  import Brain from "@lucide/svelte/icons/brain";
  import RefreshCw from "@lucide/svelte/icons/refresh-cw";
  import ToolHeading from "../../../lib/ToolHeading.svelte";
  import { t } from "./locale";
  import EnvironmentScore from "./EnvironmentScore.svelte";
  import { probeAiDomain } from "./probe";
  import { maskedIp, parseTrace } from "../../leak/webrtc/network";
  let { kind }: { kind: "gpt" | "claude" } = $props();
  const locale = $derived(localeFromPath(page.url.pathname));
  let ip = $state("");
  let location = $state("");
  let country = $state("");
  let failed = $state(false);
  let hidden = $state(false);
  let running = $state(false);
  let history = $state<{ ip: string; time: string }[]>([]);
  let network = $state<Record<string, number | null>>({});
  let controller: AbortController;
  let domain = $derived(kind === "gpt" ? "chatgpt.com" : "claude.ai");
  let domains = $derived(
    kind === "gpt"
      ? ["chatgpt.com", "api.openai.com"]
      : ["claude.ai", "anthropic.com"],
  );
  let storageKey = $derived(`ip-tools:${kind}-history`);
  const tr = (key: string) => t(key, [], locale);
  async function check() {
    controller?.abort();
    controller = new AbortController();
    const signal = controller.signal;
    running = true;
    failed = false;
    ip = "";
    location = "";
    country = "";
    network = {};
    const probe = async (host: string) => {
      try {
        const result = await probeAiDomain(host, signal, locale);
        if (!signal.aborted) network[host] = result.median;
      } catch {
        if (!signal.aborted) network[host] = null;
      }
    };
    const egress = async () => {
      try {
        const response = await fetch(`https://${domain}/cdn-cgi/trace`, {
          cache: "no-store",
          referrerPolicy: "no-referrer",
          signal: AbortSignal.any([signal, AbortSignal.timeout(3000)]),
        });
        if (!response.ok) throw new Error("Trace failed");
        const fields = parseTrace(await response.text());
        ip = fields.ip;
        country = fields.country_code || "";
        location = country;
        if (history[0]?.ip !== ip) {
          history = [{ ip, time: new Date().toISOString() }, ...history].slice(
            0,
            20,
          );
          try {
            localStorage.setItem(storageKey, JSON.stringify(history));
          } catch {
            /* Storage may be disabled. */
          }
        }
        try {
          const geo = await fetch(`/api/geoip/${encodeURIComponent(ip)}`, {
            signal,
          });
          if (geo.ok) {
            const data = await geo.json();
            country ||= data.country_code || "";
            location = [data.country || location, data.city, data.isp, data.asn]
              .filter(Boolean)
              .join(" · ");
          }
        } catch {
          /* Location is optional. */
        }
      } catch {
        if (!signal.aborted) failed = true;
      }
    };
    await Promise.all([egress(), ...domains.map(probe)]);
    if (!signal.aborted) running = false;
  }
  onMount(() => {
    try {
      history = JSON.parse(localStorage.getItem(storageKey) || "[]");
    } catch {
      /* Storage may be disabled. */
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
    syncPrivacy();
    window.addEventListener("storage", syncPrivacy);
    window.addEventListener("ip-privacy-changed", syncPrivacy);
    void check();
    return () => {
      window.removeEventListener("storage", syncPrivacy);
      window.removeEventListener("ip-privacy-changed", syncPrivacy);
    };
  });
  onDestroy(() => controller?.abort());
</script>

<svelte:head
  ><title
    >{tr(
      kind === "gpt"
        ? "ai.chatgptCodexNetworkCheck"
        : "ai.claudeAiNetworkCheck",
    )} - One IP</title
  ></svelte:head
>
<div class="diagnostics">
  <ToolHeading
    title={tr(
      kind === "gpt"
        ? "ai.chatgptCodexNetworkCheck"
        : "ai.claudeAiNetworkCheck",
    )}
  >
    {#snippet icon()}{#if kind === "gpt"}<Sparkles />{:else}<Brain
        />{/if}{/snippet}
    <button class="ui-button" type="button" disabled={running} onclick={check}>
      <RefreshCw size={15} aria-hidden="true" />{tr("ai.runAgain")}
    </button>
  </ToolHeading>
  <div class="grid">
    <section class="ui-panel egress" aria-busy={running}>
      <h2>{kind === "gpt" ? "ChatGPT" : "Claude"} {tr("ai.egress")}</h2>
      <p class="ip" class:measured={ip}>
        {#if ip}<bdi dir="ltr">{maskedIp(ip, hidden)}</bdi>{:else}{running ? tr("ai.checkingEgress") : "—"}{/if}
      </p>
      {#if failed || location}
        <p>
          {failed
            ? tr("ai.egressAddressObtainedPossiblyDueConnectionCrossOrigin")
            : location}
        </p>
      {/if}
      <nav aria-label={tr("ai.relatedLinks")}>
        <a href={`https://${domain}`} target="_blank" rel="noreferrer"
          >{tr("ai.website")} ↗</a
        >
        <a
          href={kind === "gpt"
            ? "https://platform.openai.com/docs/overview"
            : "https://platform.claude.com/docs/en/api/overview"}
          target="_blank"
          rel="noreferrer">{tr("ai.apiEndpoint")} ↗</a
        >
        <a href={`${localizedPath("/status", locale)}?service=${kind === "gpt" ? "9" : "4"}`}
          >{tr("ai.serviceStatus")}</a
        >
      </nav>
    </section>
    <section class="ui-panel" aria-busy={running}>
      <h2>{tr("ai.networkConnectivity")}</h2>
      <dl class="network">
        {#each domains as host (host)}
          {@const latency = network[host]}
          <div>
            <dt>{host}</dt>
            <dd class:reachable={latency != null}>
              {latency === undefined
                ? "…"
                : latency === null
                  ? tr("ai.unconfirmed")
                  : `${latency} ms`}
            </dd>
          </div>
        {/each}
      </dl>
      <p>{tr("ai.browserHttpProbesDoIndicateAccountAccessModel")}</p>
    </section>
  </div>
  {#if kind === "claude"}<EnvironmentScore
      {country}
      {ip}
      {hidden}
      {locale}
    />{/if}
  <details class="ui-panel history">
    <summary>{tr("ai.egressHistory")} <span>{history.length}</span></summary>
    <div class="history-heading">
      <p>{tr("ai.storedBrowserUp20Entries")}</p>
      <button
        class="ui-button"
        type="button"
        disabled={!history.length}
        onclick={() => {
          history = [];
          try {
            localStorage.setItem(storageKey, "[]");
          } catch {
            /* Storage may be disabled. */
          }
        }}>{tr("ai.clearHistory")}</button
      >
    </div>
    {#if history.length}
      <ul>
        {#each history as item}
          <li>
            <span>{maskedIp(item.ip, hidden)}</span><time datetime={item.time}
              >{new Date(item.time).toLocaleString(locale)}</time
            >
          </li>
        {/each}
      </ul>
    {/if}
  </details>
</div>

<style>
  .diagnostics,
  .grid {
    display: grid;
    gap: 1rem;
  }
  .grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  h2,
  p,
  dl,
  dd {
    margin: 0;
  }
  h2,
  summary {
    font-size: 1rem;
    font-weight: 650;
  }
  .history-heading,
  nav,
  li,
  .network div {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.5rem 0.75rem;
  }
  .history-heading,
  li,
  .network div {
    justify-content: space-between;
  }
  .egress {
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
    background: linear-gradient(
      145deg,
      color-mix(in srgb, var(--primary-soft) 62%, var(--card)),
      var(--card) 74%
    );
  }
  .ip {
    margin-top: 0.2rem;
    color: var(--muted-foreground);
    font-size: 1.125rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
  .ip.measured {
    color: var(--foreground);
    font-size: clamp(1.5rem, 4vw, 2.25rem);
    font-weight: 720;
    letter-spacing: -0.04em;
    line-height: 1.25;
  }
  p,
  time {
    font-size: 0.8125rem;
    line-height: 1.55;
    color: var(--muted-foreground, var(--color-muted-foreground));
    overflow-wrap: anywhere;
  }
  nav {
    margin-top: auto;
    padding-top: 0.75rem;
  }
  nav a {
    font-size: 0.8125rem;
    text-decoration: none;
  }
  nav a:hover {
    text-decoration: underline;
  }
  .history {
    scroll-margin-top: 5.5rem;
  }
  .network {
    display: grid;
    margin: 0.5rem 0 0.65rem;
  }
  .network div {
    padding: 0.55rem 0;
    border-bottom: 1px solid color-mix(in srgb, var(--border) 66%, transparent);
  }
  dt {
    font-size: 0.875rem;
    font-weight: 550;
  }
  dd {
    padding: 0.13rem 0.42rem;
    border-radius: 0.375rem;
    color: var(--muted-foreground);
    background: var(--muted);
    font-size: 0.75rem;
    font-variant-numeric: tabular-nums;
  }
  dd.reachable {
    color: var(--success);
    background: color-mix(in srgb, var(--success) 10%, transparent);
  }
  summary {
    cursor: pointer;
  }
  summary span {
    margin-inline-start: 0.3rem;
    color: var(--muted-foreground, var(--color-muted-foreground));
    font-size: 0.8125rem;
    font-weight: 500;
  }
  .history-heading {
    margin-top: 0.75rem;
  }
  ul {
    margin: 0.65rem 0 0;
    padding: 0;
    list-style: none;
  }
  li {
    padding: 0.45rem 0;
    border-top: 1px solid var(--border, var(--color-border));
    font-size: 0.8125rem;
    font-variant-numeric: tabular-nums;
    overflow-wrap: anywhere;
  }
  @media (max-width: 600px) {
    .grid {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
