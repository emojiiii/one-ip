<script lang="ts">
  import ArrowUpRight from "@lucide/svelte/icons/arrow-up-right";
  import Radio from "@lucide/svelte/icons/radio";
  import RefreshCw from "@lucide/svelte/icons/refresh-cw";
  import { onMount, untrack } from "svelte";
  import { localizedPath, type Locale } from "../i18n";
  import { testConnectivity } from "./connectivity";
  import { translateHome } from "./home-messages";
  import { runProbeBatch } from "./probe-batch";
  let {
    locale,
    refresh = 0,
  }: { locale: Locale; refresh?: number } = $props();
  const targets = [
    {
      name: "ByteDance",
      label: "connectivity.bytedance",
      icon: "bytedance.com",
      url: "https://perfops.byte-test.com/500b-bench.jpg",
    },
    {
      name: "Taobao",
      label: "connectivity.taobao",
      icon: "taobao.com",
      url: "https://www.taobao.com/favicon.ico",
    },
    {
      name: "WeChat",
      label: "connectivity.wechat",
      icon: "weixin.qq.com",
      url: "https://res.wx.qq.com/a/wx_fed/assets/res/NTI4MWU5.ico",
    },
    {
      name: "GitHub",
      label: "connectivity.github",
      icon: "github.com",
      url: "https://github.com/generate_204",
    },
    {
      name: "Cloudflare",
      label: "connectivity.cloudflare",
      icon: "cloudflare.com",
      url: "https://1.1.1.1/cdn-cgi/trace",
    },
    {
      name: "YouTube",
      label: "connectivity.youtube",
      icon: "youtube.com",
      url: "https://www.youtube.com/generate_204",
    },
  ];
  let results = $state<Record<string, { samples: number[]; busy: boolean }>>(
    {},
  );
  let controller: AbortController;
  let container: HTMLElement;
  let observer: IntersectionObserver;
  let visible = false;
  let lastRefresh = untrack(() => refresh);
  let sort = $state(false);
  function t(key: string) {
    return translateHome(key, [], locale);
  }
  function median(samples: number[]) {
    const good = samples.filter((ms) => ms >= 0).sort((a, b) => a - b);
    const mid = Math.floor(good.length / 2);
    return good.length
      ? Math.round(
          good.length % 2 ? good[mid] : (good[mid - 1] + good[mid]) / 2,
        )
      : null;
  }
  let ordered = $derived(
    sort
      ? [...targets].sort(
          (a, b) =>
            (median(results[a.name]?.samples ?? []) ?? Infinity) -
            (median(results[b.name]?.samples ?? []) ?? Infinity),
        )
      : targets,
  );
  $effect(() => {
    const current = refresh;
    if (current !== lastRefresh) {
      lastRefresh = current;
      if (visible) void run();
    }
  });
  async function run() {
    controller?.abort();
    controller = new AbortController();
    const signal = controller.signal;
    results = Object.fromEntries(
      targets.map((target) => [target.name, { samples: [], busy: true }]),
    );
    await runProbeBatch(targets, 3, signal, async (target) => {
      try {
        const result = await testConnectivity(
          target.url,
          signal,
          (progress) => {
            results[target.name] = { samples: progress.samples, busy: true };
          },
        );
        results[target.name] = { samples: result.samples, busy: false };
      } catch (error) {
        if (!signal.aborted) throw error;
      }
    });
  }
  onMount(() => {
    observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        visible = true;
        observer.disconnect();
        void run();
      }
    });
    observer.observe(container);
    return () => {
      observer.disconnect();
      controller?.abort();
    };
  });
</script>

<section
  class="ui-panel"
  bind:this={container}
  aria-labelledby="home-connectivity"
>
  <header>
    <div class="heading">
      <span class="section-icon"><Radio size={16} aria-hidden="true" /></span>
      <h2 id="home-connectivity">
        {t("connectivity.title")}
      </h2>
    </div>
    <div class="actions">
      <label>
        <input type="checkbox" bind:checked={sort} />
        {t("connectivity.sort")}
      </label>
      <button
        class="refresh"
        type="button"
        onclick={run}
        aria-label={t("connectivity.refresh")}
        title={t("refresh")}
        ><RefreshCw size={14} aria-hidden="true" /></button
      >
      <a href={localizedPath("/unlock/sites", locale)}>
        {t("connectivity.more")}
        <ArrowUpRight size={13} aria-hidden="true" />
      </a>
    </div>
  </header>
  <div class="grid">
    {#each ordered as target (target.name)}
      {@const state = results[target.name]}
      {@const latency = median(state?.samples ?? [])}
      <div class="tile" aria-busy={state?.busy ?? false}>
        <div class="measurement">
          <div class="site">
            <img
              src={`/api/icons/${target.icon}`}
              alt=""
              width="16"
              height="16"
              loading="lazy"
            />
            <strong>{t(target.label)}</strong>
          </div>
          <span class="dots" aria-label={`${state?.samples.length ?? 0}/8`}>
            {#each Array(8) as _, index}
              {@const sample = state?.samples[index]}
              <i
                class:ok={sample !== undefined && sample >= 0 && sample < 250}
                class:slow={sample !== undefined && sample >= 250}
                class:failed={sample !== undefined && sample < 0}
              ></i>
            {/each}
          </span>
        </div>
        <span
          class="latency"
          class:good={latency !== null && latency < 250}
          class:slow={latency !== null && latency >= 250}
        >
          {#if state?.busy}…{:else if latency === null}—{:else}{latency}<small>
              ms</small
            >{/if}
        </span>
      </div>
    {/each}
  </div>
</section>

<style>
  section {
    container-type: inline-size;
  }
  header,
  .heading,
  .actions {
    display: flex;
    gap: 10px;
    align-items: center;
  }
  header {
    flex-wrap: wrap;
    justify-content: space-between;
  }
  .section-icon {
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    flex: none;
    border-radius: 9px;
    background: var(--primary-soft);
    color: var(--primary);
  }
  h2 {
    margin: 0;
    font-size: 0.94rem;
    font-weight: 660;
    line-height: 1.25;
  }
  .actions {
    color: var(--muted-foreground);
    font-size: 0.75rem;
  }
  label {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    cursor: pointer;
    white-space: nowrap;
  }
  input {
    accent-color: var(--primary);
    margin: 0;
  }
  .refresh,
  .actions a {
    display: inline-flex;
    min-height: 28px;
    align-items: center;
    justify-content: center;
    gap: 3px;
    color: var(--muted-foreground);
    border-radius: 7px;
    font: inherit;
    text-decoration: none;
    white-space: nowrap;
  }
  .refresh {
    width: 28px;
    border: 1px solid var(--border);
    background: var(--card);
    padding: 0;
  }
  .actions a {
    padding-inline: 5px;
  }
  .refresh:hover,
  .actions a:hover {
    color: var(--primary);
    background: var(--primary-soft);
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
    margin-top: 14px;
  }
  .tile {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    background: color-mix(in srgb, var(--muted) 50%, var(--card));
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 9px 11px;
    min-width: 0;
    font-size: 0.8rem;
  }
  .measurement {
    min-width: 0;
  }
  .site {
    display: flex;
    align-items: center;
    gap: 7px;
  }
  .site img {
    display: block;
    flex: none;
    object-fit: contain;
  }
  .site strong {
    font-weight: 640;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .dots {
    display: flex;
    gap: 3px;
    margin-top: 7px;
  }
  i {
    width: 6px;
    height: 3px;
    background: var(--border);
    border-radius: 2px;
  }
  i.ok {
    background: var(--success);
  }
  i.slow {
    background: var(--warning);
  }
  i.failed {
    background: var(--danger);
  }
  .latency {
    padding: 3px 7px;
    border-radius: 7px;
    color: var(--muted-foreground);
    white-space: nowrap;
    font-size: 0.79rem;
    font-weight: 670;
    font-variant-numeric: tabular-nums;
  }
  .latency small {
    font-size: 0.65rem;
    font-weight: 550;
  }
  .latency.good {
    color: var(--success);
    background: color-mix(in srgb, var(--success) 10%, transparent);
  }
  .latency.slow {
    color: var(--warning);
    background: color-mix(in srgb, var(--warning) 10%, transparent);
  }
  @container (max-width: 470px) {
    .grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .tile {
      padding: 8px;
    }
  }
  @media (max-width: 420px) {
    header {
      gap: 7px 10px;
    }
    .actions {
      gap: 7px;
    }
  }
</style>
