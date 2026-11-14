<script lang="ts">
  import { page } from "$app/state";
  import { localeFromPath } from "../../lib/i18n";
  import { translateShell } from "../../lib/shell-messages";

  const language = $derived(localeFromPath(page.url.pathname));
  function t(key: string) {
    return translateShell(key, [], language);
  }
</script>

<svelte:head>
  <title>{t("about")} · One IP</title>
</svelte:head>

<div class="about">
  <h1 class="page-title">{t("about")}</h1>
  <section class="ui-panel">
    <h2>One IP</h2>
    <p>{t("about.intro")}</p>
    <p>{t("about.results")}</p>
    <p>{t("about.source")} <a href="https://github.com/emojiiii/one-ip">GitHub</a></p>
  </section>
  <section class="ui-panel">
    <h2>{t("about.contact")}</h2>
    <a href="mailto:ip@kitt.tools">ip@kitt.tools</a>
  </section>
</div>

<style>
  .about { display: grid; gap: .75rem; }
  h1 { margin: 0; }
  h2 { margin: 0 0 .4rem; font-size: .95rem; }
  p { max-width: 75ch; margin: .5rem 0 0; color: var(--muted-foreground); font-size: .83rem; line-height: 1.68; }
  a { color: var(--primary); }
</style>
