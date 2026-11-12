<script lang="ts">
  import "../app.css";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import Check from "@lucide/svelte/icons/check";
  import Eye from "@lucide/svelte/icons/eye";
  import EyeOff from "@lucide/svelte/icons/eye-off";
  import Languages from "@lucide/svelte/icons/languages";
  import Monitor from "@lucide/svelte/icons/monitor";
  import Moon from "@lucide/svelte/icons/moon";
  import Search from "@lucide/svelte/icons/search";
  import Sun from "@lucide/svelte/icons/sun";
  import X from "@lucide/svelte/icons/x";
  import { Dialog, DropdownMenu } from "bits-ui";
  import { onMount } from "svelte";
  import { normalizeIp } from "../lib/ip/ip-address";
  import { localeForPath, locales, localizedPath, publicPages, unlocalizedPath } from "../lib/i18n";
  import { pageAlternates, siteOrigin } from "../lib/seo";
  import { translateShell } from "../lib/shell-messages";
  import ToolDirectory from "../lib/ToolDirectory.svelte";
  import WebMcp from "../lib/WebMcp.svelte";
  import UpdateNotice from "../lib/UpdateNotice.svelte";

  type Theme = "light" | "dark" | "system";
  const repositoryUrl = "https://github.com/emojiiii/one-ip";
  let { children } = $props();
  const activeLocale = $derived(localeForPath(page.url.pathname));
  const language = $derived(activeLocale.id);
  const route = $derived(unlocalizedPath(page.url.pathname).replace(/\/$/, "") || "/");
  const indexable = $derived(publicPages.some((path) => path === route));
  let theme = $state<Theme>("system");
  let dark = $state(false);
  let hideIp = $state(false);
  let searchOpen = $state(false);
  let search = $state("");
  let invalidIp = $state(false);
  const themes = [
    { value: "system", icon: Monitor },
    { value: "light", icon: Sun },
    { value: "dark", icon: Moon },
  ] as const;

  function t(key: string) {
    return translateShell(key, [], language);
  }

  onMount(() => {
    const url = new URL(location.href);
    const legacyLang = url.searchParams.get("lang");
    const oldLanguage = locales.find(({ id, prefix }) => id === legacyLang || prefix === `/${legacyLang}`);
    if (oldLanguage) {
      url.searchParams.delete("lang");
      url.pathname = localizedPath(url.pathname, oldLanguage.id);
      location.replace(url);
    }
    try {
      const storedTheme = localStorage.getItem("theme");
      if (
        storedTheme === "light" ||
        storedTheme === "dark" ||
        storedTheme === "system"
      )
        theme = storedTheme;
    } catch {
      /* Storage can be unavailable. */
    }
    const syncPrivacy = (event?: Event) => {
      if (event instanceof CustomEvent && typeof event.detail === "boolean") {
        hideIp = event.detail;
        return;
      }
      try {
        hideIp = localStorage.getItem("ip-tools:hide-ip") === "true";
      } catch {
        /* Keep the current selection if storage is unavailable. */
      }
    };
    syncPrivacy();
    window.addEventListener("storage", syncPrivacy);
    window.addEventListener("ip-privacy-changed", syncPrivacy);
    const media = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => applyTheme(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => {
      media.removeEventListener("change", apply);
      window.removeEventListener("storage", syncPrivacy);
      window.removeEventListener("ip-privacy-changed", syncPrivacy);
    };
  });

  $effect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = activeLocale.dir;
  });

  function applyTheme(systemDark: boolean) {
    dark = theme === "dark" || (theme === "system" && systemDark);
    document.documentElement.classList.toggle("dark", dark);
  }

  function changeTheme(next: Theme) {
    theme = next;
    try {
      localStorage.setItem("theme", theme);
    } catch {
      /* The current page still updates. */
    }
    applyTheme(matchMedia("(prefers-color-scheme: dark)").matches);
  }

  function togglePrivacy() {
    hideIp = !hideIp;
    try {
      localStorage.setItem("ip-tools:hide-ip", JSON.stringify(hideIp));
    } catch {
      /* Storage can be unavailable. */
    }
    window.dispatchEvent(
      new CustomEvent("ip-privacy-changed", { detail: hideIp }),
    );
  }

  function searchIp(value: string) {
    const ip = normalizeIp(value);
    if (!ip) {
      invalidIp = true;
      return;
    }
    searchOpen = false;
    void goto(localizedPath(`/ip/${encodeURIComponent(ip)}`, language));
  }

  function searchShortcut(event: KeyboardEvent) {
    if (event.key.toLowerCase() === "k" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      searchOpen = true;
    }
  }
</script>

<svelte:head>
  {#if indexable && route !== "/"}
    <meta name="description" content={t(`seo${route.replaceAll("/", ".")}`)} />
  {/if}
  {#if siteOrigin && indexable}
    <link rel="canonical" href={new URL(localizedPath(route, language), siteOrigin).href} />
    {#each pageAlternates(route, siteOrigin) as { hreflang, href } (hreflang)}
      <link rel="alternate" {hreflang} {href} />
    {/each}
  {/if}
</svelte:head>

<svelte:window onkeydown={searchShortcut} />
<WebMcp />
<UpdateNotice {language} />
<div class="shell">
  <a class="skip" href="#main-content"
    >{t("skip")}</a
  >
  <header class="topbar">
    <a
      class="brand"
      href={localizedPath("/", language)}
      aria-label={t("brand")}
    >
      <span class="brand-mark"
        ><img src="/icon.svg" alt="" width="24" height="24" /></span
      >
      <span>One IP</span>
    </a>
    <nav
      class="primary-nav"
      aria-label={t("navigation")}
    >
      <a href={localizedPath("/", language)} aria-current={route === "/" ? "page" : undefined}
        >{t("overview")}</a
      >
      <a href="#tools">{t("tools")}</a>
      <a
        href={localizedPath("/status", language)}
        aria-current={route === "/status" ? "page" : undefined}
        >{t("status")}</a
      >
    </nav>
    <nav class="settings" aria-label={t("controls")}>
      <Dialog.Root
        bind:open={searchOpen}
        onOpenChange={(open) => {
          if (!open) {
            search = "";
            invalidIp = false;
          }
        }}
      >
        <Dialog.Trigger
          class="ui-button toolbar-icon search-trigger"
          aria-label={t("search.title")}
          title={t("search.shortcut")}
          aria-keyshortcuts="Control+K Meta+K"
        >
          <Search size={16} aria-hidden="true" /><span class="search-label"
            >{t("search.title")}</span
          ><kbd>Ctrl K</kbd>
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay class="search-overlay" />
          <Dialog.Content class="search-dialog" aria-describedby={undefined}>
            <Dialog.Title class="search-title"
              >{t("search.title")}</Dialog.Title
            >
            <form
              class="global-search"
              onsubmit={(event) => {
                event.preventDefault();
                searchIp(search);
              }}
            >
              <Search size={17} aria-hidden="true" />
              <input
                class="ui-input"
                dir="ltr"
                aria-label={t("search.address")}
                aria-invalid={invalidIp}
                placeholder={t("search.placeholder")}
                bind:value={search}
                oninput={() => (invalidIp = false)}
                spellcheck="false"
                autocapitalize="none"
              />
              <button class="ui-button primary" type="submit"
                >{t("search.submit")}</button
              >
            </form>
            {#if invalidIp}<p class="search-error" role="alert">
                {t("search.invalid")}
              </p>{/if}
            <div class="search-examples">
              {#each ["1.1.1.1", "8.8.8.8", "2400:3200::1"] as ip}
                <button
                  class="ui-button ghost"
                  type="button"
                  onclick={() => searchIp(ip)}>{ip}</button
                >
              {/each}
            </div>
            <Dialog.Close
              class="ui-button ghost search-close"
              aria-label={t("search.close")}
              ><X size={16} aria-hidden="true" /></Dialog.Close
            >
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <button
        class="ui-button toolbar-icon"
        type="button"
        aria-pressed={hideIp}
        aria-label={t("hideIp")}
        title={t("hideIp")}
        onclick={togglePrivacy}
      >
        {#if hideIp}<EyeOff size={16} aria-hidden="true" />{:else}<Eye
            size={16}
            aria-hidden="true"
          />{/if}
      </button>
      <DropdownMenu.Root dir={activeLocale.dir}>
        <DropdownMenu.Trigger
          class="ui-button toolbar-icon"
          aria-label={t("language")}
          title={t("language")}
          ><Languages size={16} aria-hidden="true" /></DropdownMenu.Trigger
        >
        <DropdownMenu.Portal>
          <DropdownMenu.Content class="toolbar-menu language-menu" align="end" sideOffset={6}>
            {#each locales as option (option.id)}
              <DropdownMenu.Item
                class="toolbar-option"
                lang={option.id}
                dir={option.dir}
                aria-current={option.id === language ? "true" : undefined}
                onSelect={() => {
                  if (option.id === language) return;
                  const url = new URL(location.href);
                  url.pathname = localizedPath(route, option.id);
                  location.assign(url.href);
                }}
              >
                {option.label}{#if option.id === language}<Check
                    size={15}
                    aria-hidden="true"
                  />{/if}
              </DropdownMenu.Item>
            {/each}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      <DropdownMenu.Root dir={activeLocale.dir}>
        <DropdownMenu.Trigger
          class="ui-button toolbar-icon"
          aria-label={t("theme.title")}
          title={t("theme.title")}
        >
          {#if dark}<Sun size={16} aria-hidden="true" />{:else}<Moon
              size={16}
              aria-hidden="true"
            />{/if}
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content class="toolbar-menu" align="end" sideOffset={6}>
            {#each themes as option}
              <DropdownMenu.Item
                class="toolbar-option"
                onSelect={() => changeTheme(option.value)}
              >
                <span
                  ><option.icon size={15} aria-hidden="true" />{t(`theme.${option.value}`)}</span
                >
                {#if option.value === theme}<Check
                    size={15}
                    aria-hidden="true"
                  />{/if}
              </DropdownMenu.Item>
            {/each}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      <a
        class="ui-button toolbar-icon"
        href={repositoryUrl}
        aria-label="GitHub"
        title="GitHub"
        target="_blank"
        rel="noreferrer"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            d="M12 .5C5.65.5.5 5.65.5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-2c-3.2.7-3.87-1.37-3.87-1.37-.53-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.71 1.26 3.37.96.1-.75.4-1.26.73-1.55-2.56-.29-5.25-1.28-5.25-5.69 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.42-2.7 5.39-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z"
          />
        </svg>
      </a>
    </nav>
  </header>
  <main id="main-content">{@render children()}</main>
  <ToolDirectory {language} />
  <footer>
    <span>© {new Date().getFullYear()} One IP</span>
    <a
      href="https://huzhihui.com/blog/one-ip-guide"
      target="_blank"
      rel="noreferrer">{t("guide")}</a
    >
    <a href={localizedPath("/terms", language)}>{t("terms")}</a>
    <a href={localizedPath("/privacy", language)}>{t("privacy")}</a>
    <a
      href={repositoryUrl}
      target="_blank"
      rel="noreferrer">GitHub</a
    >
    <nav class="footer-languages" aria-label={t("language")}>
      {#each locales.filter((locale) => locale.id !== language) as locale (locale.id)}
        <a href={localizedPath(route, locale.id)} lang={locale.id} dir={locale.dir} hreflang={locale.hreflang} data-sveltekit-reload>{locale.label}</a>
      {/each}
    </nav>
  </footer>
</div>

<style>
  .shell {
    max-width: 1160px;
    margin: 0 auto;
    padding: 18px 26px 0;
  }
  .skip {
    position: fixed;
    z-index: 100;
    top: 10px;
    inset-inline-start: 10px;
    padding: 6px 12px;
    transform: translateY(-180%);
    border-radius: var(--control-radius);
    background: var(--card);
  }
  .skip:focus {
    transform: translateY(0);
  }
  .topbar {
    position: sticky;
    z-index: 30;
    top: 10px;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    min-height: 61px;
    align-items: center;
    gap: 22px;
    margin-bottom: 22px;
    padding: 9px 12px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: color-mix(in srgb, var(--card) 95%, transparent);
    box-shadow: var(--shadow-panel);
    backdrop-filter: blur(14px);
  }
  .brand {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    color: var(--foreground);
    text-decoration: none;
    white-space: nowrap;
    font-size: 17px;
    font-weight: 720;
    letter-spacing: -0.035em;
    border-radius: var(--control-radius);
  }
  .brand-mark {
    display: grid;
    width: 36px;
    height: 36px;
    place-items: center;
    border-radius: 10px;
    background: var(--primary-soft);
  }
  .brand:hover {
    color: var(--primary);
  }
  .primary-nav {
    display: flex;
    align-items: center;
    gap: 3px;
  }
  .primary-nav a {
    display: inline-flex;
    align-items: center;
    min-height: 34px;
    padding: 5px 10px;
    border-radius: var(--control-radius);
    color: var(--muted-foreground);
    font-size: 13px;
    font-weight: 570;
    text-decoration: none;
    white-space: nowrap;
  }
  .primary-nav a:hover,
  .primary-nav a[aria-current="page"] {
    background: var(--primary-soft);
    color: var(--primary);
  }
  .settings {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .settings :global(.toolbar-icon) {
    min-width: 36px;
    min-height: 36px;
    padding: 5px 8px;
    color: var(--muted-foreground);
  }
  .settings :global(.search-trigger) {
    padding: 5px 8px 5px 10px;
    background: var(--muted);
  }
  .search-label {
    font-size: 12px;
  }
  .settings :global(.toolbar-icon[aria-pressed="true"]) {
    color: var(--primary);
  }
  kbd {
    color: inherit;
    padding: 3px 4px;
    border: 1px solid var(--border);
    border-radius: 5px;
    background: var(--card);
    font:
      11px/1 system-ui,
      sans-serif;
  }
  main {
    min-width: 0;
    scroll-margin-top: 90px;
  }
  footer {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 6px 13px;
    padding: 26px 0;
    color: var(--muted-foreground);
    font-size: 12px;
  }
  footer a {
    color: inherit;
    text-decoration: none;
  }
  footer a:hover {
    color: var(--primary);
    text-decoration: underline;
  }
  .footer-languages {
    display: flex;
    flex: 0 0 100%;
    flex-wrap: wrap;
    justify-content: center;
    gap: inherit;
  }

  :global(.toolbar-menu) {
    z-index: 80;
    min-width: 132px;
    padding: 4px;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--card);
    box-shadow: var(--shadow-menu);
  }
  :global(.language-menu) {
    max-block-size: min(24rem, var(--bits-dropdown-menu-content-available-height, 100dvh));
    overflow-y: auto;
  }
  :global(.toolbar-option) {
    display: flex;
    min-height: 35px;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    padding: 5px 8px;
    border-radius: 6px;
    cursor: default;
    font-size: 13px;
  }
  :global(.toolbar-option[data-highlighted]) {
    background: var(--muted);
    outline: none;
  }
  :global(.toolbar-option > span) {
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }
  :global(.search-overlay) {
    position: fixed;
    z-index: 80;
    inset: 0;
    background: #151e2e59;
  }
  :global(.search-dialog) {
    position: fixed;
    z-index: 81;
    top: min(20vh, 160px);
    left: 50%;
    width: min(470px, calc(100% - 28px));
    padding: 16px;
    transform: translateX(-50%);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--card);
    box-shadow: var(--shadow-menu);
  }
  :global(.search-title) {
    margin-block: 0 12px;
    margin-inline-end: 32px;
    font-size: 16px;
  }
  :global(.search-close) {
    position: absolute;
    top: 8px;
    inset-inline-end: 8px;
    min-width: 34px;
    padding: 5px;
  }
  .global-search {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .global-search :global(svg) {
    flex: 0 0 auto;
    color: var(--muted-foreground);
  }
  .global-search input {
    flex: 1;
    width: 100%;
  }
  .global-search input:placeholder-shown {
    direction: inherit;
  }
  .search-error {
    margin: 8px 0 0;
    color: var(--danger);
    font-size: 12px;
  }
  .search-examples {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 10px;
  }
  .search-examples button {
    min-height: 29px;
    background: var(--muted);
  }

  @media (max-width: 800px) {
    .search-label,
    kbd {
      display: none;
    }
    .topbar {
      gap: 12px;
    }
  }

  @media (max-width: 660px) {
    .shell {
      padding: 10px 12px 0;
    }
    .topbar {
      position: relative;
      top: auto;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 7px 6px;
      margin-bottom: 14px;
      padding: 7px;
    }
    .primary-nav {
      grid-column: 1 / -1;
      grid-row: 2;
      padding-top: 5px;
      border-top: 1px solid var(--border);
    }
    .primary-nav a {
      min-height: 32px;
    }
    .brand {
      gap: 5px;
      font-size: 15px;
    }
    .brand-mark {
      width: 32px;
      height: 32px;
    }
    .brand-mark img {
      width: 21px;
      height: 21px;
    }
    .settings :global(.search-trigger) {
      padding: 5px;
    }
    .settings :global(.toolbar-icon) {
      min-width: 34px;
      min-height: 34px;
      padding: 5px;
    }
    .settings {
      gap: 4px;
    }
    footer {
      padding: 20px 0;
    }
  }
</style>
