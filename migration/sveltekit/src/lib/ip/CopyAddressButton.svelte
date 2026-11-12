<script lang="ts">
  import type { Locale } from "../i18n";
  import { t as translate } from "./tools-locale";
  import Check from '@lucide/svelte/icons/check';
  import CircleAlert from '@lucide/svelte/icons/circle-alert';
  import Copy from '@lucide/svelte/icons/copy';
  import { onDestroy } from "svelte";

  let { ip, locale }: { ip: string; locale: Locale } = $props();
  function t(key: string, values: readonly unknown[] = []) {
    return translate(key, values, locale);
  }
  let feedback = $state<"copied" | "failed">();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const label = $derived(t("copyAddress.label"));
  const message = $derived(
    feedback === "copied"
      ? t("copyAddress.copied")
      : t("copyAddress.failed"),
  );

  async function copy() {
    clearTimeout(timer);
    try {
      await navigator.clipboard.writeText(ip);
      feedback = "copied";
    } catch {
      feedback = "failed";
    }
    timer = setTimeout(() => (feedback = undefined), 2000);
  }

  onDestroy(() => clearTimeout(timer));
</script>

<button
  type="button"
  class="ui-button ghost"
  aria-label={label}
  title={feedback ? message : label}
  onclick={copy}
>
  {#if feedback === "copied"}<Check size={15} aria-hidden="true" />
  {:else if feedback === "failed"}<CircleAlert size={15} aria-hidden="true" />
  {:else}<Copy size={15} aria-hidden="true" />{/if}
</button>
<span class="sr-only" role="status">{feedback ? message : ""}</span>

<style>
  button {
    min-width: 30px;
    min-height: 30px;
    padding: 4px;
    color: var(--muted-foreground);
  }
</style>
