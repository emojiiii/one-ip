<script lang="ts">
  import Activity from "@lucide/svelte/icons/activity";
  import Brain from "@lucide/svelte/icons/brain";
  import Eye from "@lucide/svelte/icons/eye";
  import FileSearch from "@lucide/svelte/icons/file-search";
  import Fingerprint from "@lucide/svelte/icons/fingerprint";
  import Gauge from "@lucide/svelte/icons/gauge";
  import Globe from "@lucide/svelte/icons/globe";
  import LockKeyholeOpen from "@lucide/svelte/icons/lock-keyhole-open";
  import ListFilter from "@lucide/svelte/icons/list-filter";
  import Network from "@lucide/svelte/icons/network";
  import Radar from "@lucide/svelte/icons/radar";
  import ScanFace from "@lucide/svelte/icons/scan-face";
  import Search from "@lucide/svelte/icons/search";
  import Shield from "@lucide/svelte/icons/shield";
  import Sparkles from "@lucide/svelte/icons/sparkles";
  import Webcam from "@lucide/svelte/icons/webcam";
  import { page } from "$app/state";
  import { localizedPath, unlocalizedPath, type Locale } from "./i18n";
  import { translateShell } from "./shell-messages";

  let { language }: { language: Locale } = $props();
  const route = $derived(unlocalizedPath(page.url.pathname));

  const groups = ["lookup", "network", "access", "browser"] as const;

  const tools = [
    {
      path: "/ip",
      group: "lookup",
      label: "tools.ip",
      icon: Search,
      tone: "blue",
    },
    {
      path: "/ip/batch",
      group: "lookup",
      label: "tools.batchIp",
      icon: ListFilter,
      tone: "blue",
    },
    {
      path: "/dns-records",
      group: "lookup",
      label: "tools.dnsRecords",
      icon: Network,
      tone: "blue",
    },
    {
      path: "/leak/dns",
      group: "network",
      label: "tools.dns",
      icon: Shield,
      tone: "blue",
    },
    {
      path: "/leak/webrtc",
      group: "network",
      label: "tools.webrtc",
      icon: Webcam,
      tone: "blue",
    },
    {
      path: "/unlock/sites",
      group: "access",
      label: "tools.sites",
      icon: LockKeyholeOpen,
      tone: "blue",
    },
    {
      path: "/unlock/gpt",
      group: "access",
      label: "tools.gpt",
      icon: Sparkles,
      tone: "purple",
    },
    {
      path: "/unlock/claude",
      group: "access",
      label: "tools.claude",
      icon: Brain,
      tone: "orange",
    },
    {
      path: "/speedtest",
      group: "network",
      label: "tools.speedtest",
      icon: Gauge,
      tone: "blue",
    },
    {
      path: "/whois",
      group: "lookup",
      label: "tools.whois",
      icon: FileSearch,
      tone: "purple",
    },
    {
      path: "/ping",
      group: "network",
      label: "tools.ping",
      icon: Radar,
      tone: "green",
    },
    {
      path: "/browser/environment",
      group: "browser",
      label: "tools.environment",
      icon: ScanFace,
      tone: "purple",
    },
    {
      path: "/browser/fingerprint",
      group: "browser",
      label: "tools.fingerprint",
      icon: Fingerprint,
      tone: "blue",
    },
    {
      path: "/browser/checks",
      group: "browser",
      label: "tools.checks",
      icon: Globe,
      tone: "purple",
    },
    {
      path: "/browser/privacy",
      group: "browser",
      label: "tools.browserPrivacy",
      icon: Eye,
      tone: "green",
    },
    {
      path: "/status",
      group: "lookup",
      label: "tools.status",
      icon: Activity,
      tone: "green",
    },
  ];

  function t(key: string) {
    return translateShell(key, [], language);
  }
</script>

<nav id="tools" aria-labelledby="tool-directory-heading" data-sveltekit-preload-data="tap">
  <h2 id="tool-directory-heading">{t("directory.title")}</h2>
  <div class="tool-groups">
    {#each groups as group (group)}
      <section class="ui-panel tool-group">
        <h3>{t(`directory.${group}`)}</h3>
        <ul>
          {#each tools.filter((tool) => tool.group === group) as tool (tool.path)}
            {@const active =
              route === tool.path ||
              (tool.path === "/ip" && route.startsWith("/ip/") && route !== "/ip/batch")}
            <li>
              <a href={localizedPath(tool.path, language)} aria-current={active ? "page" : undefined}>
                <span class="icon" data-tone={tool.tone}
                  ><tool.icon
                    size={16}
                    strokeWidth={1.8}
                    aria-hidden="true"
                  /></span
                >
                <span>{t(tool.label)}</span>
              </a>
            </li>
          {/each}
        </ul>
      </section>
    {/each}
  </div>
</nav>

<style>
  nav {
    margin-top: 28px;
    scroll-margin-top: 90px;
  }
  h2 {
    margin: 0 0 10px;
    font-size: 18px;
    font-weight: 680;
    letter-spacing: -0.025em;
  }
  .tool-groups {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px;
  }
  .tool-group {
    padding: 12px;
  }
  h3 {
    margin: 1px 5px 8px;
    color: var(--muted-foreground);
    font-size: 12px;
    font-weight: 650;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  a {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 5px;
    min-height: 38px;
    border-radius: var(--control-radius);
    color: var(--foreground);
    font-size: 13px;
    line-height: 1.35;
    text-decoration: none;
  }
  a:hover,
  a[aria-current="page"] {
    background: var(--muted);
    color: var(--primary);
  }
  .icon {
    display: grid;
    width: 29px;
    height: 29px;
    flex: 0 0 auto;
    place-items: center;
    border-radius: 8px;
    background: var(--primary-soft);
    color: var(--primary);
  }
  .icon[data-tone="green"] {
    background: var(--success-soft);
    color: var(--success);
  }
  .icon[data-tone="orange"] {
    background: var(--warning-soft);
    color: var(--warning);
  }
  .icon[data-tone="purple"] {
    background: color-mix(in srgb, #8971ad 13%, var(--card));
    color: color-mix(in srgb, #8971ad 75%, var(--foreground));
  }
  @media (max-width: 680px) {
    nav {
      scroll-margin-top: 16px;
    }
    .tool-groups {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .tool-group {
      padding: 9px;
    }
    a {
      min-height: 40px;
      font-size: 12px;
    }
  }
  @media (max-width: 350px) {
    .tool-groups {
      gap: 8px;
    }
    a {
      gap: 5px;
    }
  }
</style>
