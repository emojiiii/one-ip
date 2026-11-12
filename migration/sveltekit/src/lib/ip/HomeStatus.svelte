<script lang="ts">
  import Activity from "@lucide/svelte/icons/activity";
  import ArrowUpRight from "@lucide/svelte/icons/arrow-up-right";
  import Sparkles from "@lucide/svelte/icons/sparkles";
  import { onMount, untrack } from "svelte";
  import { localizedPath, type Locale } from "../i18n";
  import { fetchStatusSummary } from "../status-summary";
  import { translateHome } from "./home-messages";
  import { runProbeBatch } from "./probe-batch";
  import {
    featuredServices as featured,
    featuredPlatforms as platforms,
  } from "./home-status";
  import {
    probeAiDomain,
    type AiProbeResult,
  } from "../../routes/unlock/ai/probe";
  let {
    locale,
    refresh = 0,
  }: { locale: Locale; refresh?: number } = $props();
  let ai = $state<Record<string, AiProbeResult>>({});
  let status = $state<Record<string, string>>({});
  let holder: HTMLElement;
  let controller: AbortController;
  let observer: IntersectionObserver;
  let visible = false;
  let lastRefresh = untrack(() => refresh);
  const serviceIcons: Record<string, string> = {
    "0": "cloudflare.com",
    "1": "supabase.com",
    "4": "anthropic.com",
    "5": "cursor.com",
    "9": "openai.com",
    "10": "perplexity.ai",
    "15": "vercel.com",
    "19": "github.com",
  };
  const indicators = new Set(["none", "minor", "major", "critical", "maintenance"]);
  $effect(() => {
    const current = refresh;
    if (current !== lastRefresh) {
      lastRefresh = current;
      if (visible) restart();
    }
  });
  function t(key: string) {
    return translateHome(key, [], locale);
  }
  function label(indicator?: string) {
    if (!indicator) return t("status.checking");
    return t(indicators.has(indicator) ? `status.${indicator}` : "status.unknown");
  }
  async function run(signal: AbortSignal) {
    await Promise.all([
      runProbeBatch(platforms, 3, signal, async (platform) => {
        const result = await probeAiDomain(
          platform.domain,
          signal,
          locale,
        ).catch((error) => {
          if (!signal.aborted) throw error;
        });
        if (result && !signal.aborted) ai[platform.name] = result;
      }),
      (async () => {
        try {
          const summary = await fetchStatusSummary(featured.map(({ id }) => id), signal);
          if (!signal.aborted) for (const { id } of featured) status[id] = summary[id]?.status.indicator ?? "unknown";
        } catch {
          if (!signal.aborted) for (const { id } of featured) status[id] = "unknown";
        }
      })(),
    ]);
  }
  function restart() {
    controller?.abort();
    controller = new AbortController();
    ai = {};
    status = {};
    void run(controller.signal);
  }
  onMount(() => {
    observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        visible = true;
        observer.disconnect();
        restart();
      }
    });
    observer.observe(holder);
    return () => {
      controller?.abort();
      observer.disconnect();
    };
  });
</script>

<div bind:this={holder} class="summaries">
  <section class="ui-panel" aria-labelledby="home-ai">
    <header>
      <div class="heading">
        <span class="section-icon"
          ><Sparkles size={16} aria-hidden="true" /></span
        >
        <h2 id="home-ai">{t("ai.title")}</h2>
      </div>
      <a href={localizedPath("/unlock/gpt", locale)}>
        {t("ai.details")}
        <ArrowUpRight size={13} aria-hidden="true" />
      </a>
    </header>
    <div class="grid">
      {#each platforms as item (item.name)}
        {@const probe = ai[item.name]}
        <div class="row" title={probe?.description}>
          <img
            src={`/api/icons/${item.domain}`}
            alt=""
            width="16"
            height="16"
            loading="lazy"
          />
          <span class="name" title={item.name}>{item.name}</span>
          <strong
            class:good={probe?.median != null && probe.median < 500}
            class:warning={probe?.median != null && probe.median >= 500}
          >
            {#if probe?.median != null}{probe.median}<small>
                ms</small
              >{:else if probe}{label("unknown")}{:else}…{/if}
          </strong>
        </div>
      {/each}
    </div>
  </section>
  <section class="ui-panel" aria-labelledby="home-status">
    <header>
      <div class="heading">
        <span class="section-icon"
          ><Activity size={16} aria-hidden="true" /></span
        >
        <h2 id="home-status">{t("status.title")}</h2>
      </div>
      <a href={localizedPath("/status", locale)}>
        {t("status.all")}
        <ArrowUpRight size={13} aria-hidden="true" />
      </a>
    </header>
    <div class="grid">
      {#each featured as service (service.id)}
        {@const indicator = status[service.id]}
        <a class="row" href={`${localizedPath("/status", locale)}?service=${service.id}`}>
          <img
            src={`/api/icons/${serviceIcons[service.id]}`}
            alt=""
            width="16"
            height="16"
            loading="lazy"
          />
          <span class="name" title={service.name}>{service.name}</span>
          <strong
            class="indicator"
            class:good={indicator === "none"}
            class:warning={indicator === "minor" || indicator === "maintenance"}
            class:danger={indicator === "major" || indicator === "critical"}
            >{label(indicator)}</strong
          >
        </a>
      {/each}
    </div>
  </section>
</div>

<style>
  .summaries {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 380px), 1fr));
    gap: 14px;
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }
  .heading {
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
  h2 {
    font-size: 0.94rem;
    margin: 0;
    font-weight: 660;
    line-height: 1.25;
  }
  header a {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    min-height: 28px;
    padding-inline: 5px;
    border-radius: 7px;
    color: var(--muted-foreground);
    font-size: 0.75rem;
    text-decoration: none;
    white-space: nowrap;
  }
  header a:hover {
    color: var(--primary);
    background: var(--primary-soft);
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0 12px;
    margin-top: 10px;
  }
  .row {
    display: grid;
    grid-template-columns: 16px minmax(0, 1fr) auto;
    align-items: center;
    gap: 7px;
    min-height: 36px;
    padding: 6px 2px;
    border-bottom: 1px solid var(--border);
    color: inherit;
    text-decoration: none;
    font-size: 0.77rem;
    min-width: 0;
  }
  .row:nth-last-child(-n + 2) {
    border-bottom-color: transparent;
  }
  a.row:hover {
    background: var(--muted);
    color: var(--primary);
  }
  .row img {
    object-fit: contain;
  }
  .name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 550;
  }
  strong {
    white-space: nowrap;
    font-size: 0.73rem;
    color: var(--muted-foreground);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
  small {
    font-size: 0.65rem;
    font-weight: 550;
  }
  .indicator {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  .indicator::before {
    content: "";
    width: 5px;
    height: 5px;
    flex: none;
    border-radius: 50%;
    background: currentColor;
  }
  strong.good {
    color: var(--success);
  }
  strong.warning {
    color: var(--warning);
  }
  strong.danger {
    color: var(--danger);
  }
  @media (max-width: 640px) {
    .summaries {
      gap: 12px;
    }
  }
  @media (max-width: 360px) {
    .grid {
      grid-template-columns: minmax(0, 1fr);
    }
    .row:nth-last-child(2) {
      border-bottom-color: var(--border);
    }
  }
</style>
