<script module lang="ts">
  import { messageCatalog } from "../../../lib/message-catalog";
  const catalog = messageCatalog("batch");
</script>

<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { page } from "$app/state";
  import ListFilter from "@lucide/svelte/icons/list-filter";
  import ToolHeading from "../../../lib/ToolHeading.svelte";
  import { localeFromPath } from "../../../lib/i18n";
  import { lookupIp } from "../../../lib/ip/lookup";
  import { parseBatchInput, toCsv } from "../../../lib/ip/batch";
  import type { CoffeeLookup } from "../../../lib/ip/coffee";
  import { getBrowserIp } from "../../leak/webrtc/home-api";

  type Row = {
    ip: string;
    name: string;
    state: "loading" | "ready" | "failed";
    data?: CoffeeLookup;
    checkedAt?: number;
  };
  const locale = $derived(localeFromPath(page.url.pathname));
  let input = $state("");
  let query = $state("");
  let typeFilter = $state("all");
  let rows = $state<Row[]>([]);
  let error = $state("");
  let busy = $state(false);
  let hidden = $state(false);
  let controller: AbortController | undefined;
  const visible = $derived(
    rows.filter((row) => {
      const keyword = query.trim().toLowerCase();
      const searchable = [
        row.ip,
        row.name,
        row.data?.geo.country,
        row.data?.geo.region,
        row.data?.geo.city,
        row.data?.geo.isp,
        row.data?.geo.asn == null ? "" : asn(row.data),
      ]
        .join(" ")
        .toLowerCase();
      return (
        (!keyword || searchable.includes(keyword)) &&
        (typeFilter === "all" || typeOf(row.data) === typeFilter)
      );
    }),
  );

  function t(key: string, values: readonly unknown[] = []) {
    return catalog.t(`batch.${key}`, values, locale);
  }
  function typeOf(data?: CoffeeLookup) {
    if (!data) return "unknown";
    if (
      data.coffee.isResidential === true &&
      data.coffee.is_datacenter === true
    )
      return "conflict";
    if (data.coffee.isResidential === true) return "residential";
    if (data.coffee.is_datacenter === true) return "datacenter";
    return "unknown";
  }
  function location(data?: CoffeeLookup) {
    return data
      ? [
          ...new Set(
            [data.geo.country, data.geo.region, data.geo.city].filter(Boolean),
          ),
        ].join(" · ") || t("unknown")
      : t("unknown");
  }
  function asn(data?: CoffeeLookup) {
    const value = data?.geo.asn;
    return value == null || value === ""
      ? t("unknown")
      : `AS${String(value).replace(/^AS/i, "")}`;
  }
  function score(data?: CoffeeLookup) {
    const value = data?.coffee.trust_score;
    return value != null && value >= 0 && value <= 100
      ? String(value)
      : t("unknown");
  }
  function source(data?: CoffeeLookup) {
    if (!data) return t("unknown");
    return data.fallback ? data.geo.source || t("unknown") : "Net.Coffee";
  }
  function checkedAt(row: Row) {
    return row.checkedAt
      ? new Date(row.checkedAt).toLocaleString(locale)
      : t("unknown");
  }

  async function load(targets: Row[]) {
    if (!targets.length) return;
    const run = new AbortController();
    controller = run;
    busy = true;
    let next = 0;
    const worker = async () => {
      while (next < targets.length) {
        const row = targets[next++];
        row.state = "loading";
        try {
          const data = await lookupIp(row.ip, run.signal, true);
          if (run.signal.aborted) return;
          const now = Date.now();
          Object.assign(row, {
            state: "ready",
            data,
            checkedAt: now,
          });
        } catch {
          if (run.signal.aborted) return;
          Object.assign(row, {
            state: "failed",
            data: undefined,
            checkedAt: undefined,
          });
        }
      }
    };
    try {
      await Promise.all(
        Array.from({ length: Math.min(3, targets.length) }, worker),
      );
    } finally {
      if (controller === run) {
        busy = false;
        controller = undefined;
      }
    }
  }
  function addIps(ips: string[]) {
    const fresh = ips.filter((ip) => !rows.some((row) => row.ip === ip));
    if (rows.length + fresh.length > 10) {
      error = t("limit");
      return;
    }
    if (!fresh.length) {
      error = t("duplicate");
      return;
    }
    error = "";
    rows.push(...fresh.map((ip): Row => ({ ip, name: "", state: "loading" })));
    void load(rows.slice(-fresh.length));
  }
  function submit(event: SubmitEvent) {
    event.preventDefault();
    const result = parseBatchInput(input);
    if (result.invalid.length) {
      error = t("invalid", [result.invalid.join(", ")]);
      return;
    }
    if (result.tooMany) {
      error = t("limit");
      return;
    }
    if (!result.ips.length) {
      error = t("empty");
      return;
    }
    addIps(result.ips);
    if (!error) input = "";
  }
  async function addCurrent() {
    busy = true;
    error = "";
    const run = new AbortController();
    controller = run;
    try {
      let current;
      try {
        current = await getBrowserIp(4, run.signal);
      } catch {
        run.signal.throwIfAborted();
        current = await getBrowserIp(6, run.signal);
      }
      if (run.signal.aborted) return;
      busy = false;
      controller = undefined;
      addIps([current.ip]);
    } catch {
      if (!run.signal.aborted) error = t("noCurrent");
    } finally {
      if (controller === run) {
        busy = false;
        controller = undefined;
      }
    }
  }
  function download() {
    const headers = [
      "ip",
      "name",
      t("location"),
      "ASN",
      t("type"),
      t("score"),
      t("source"),
      t("time"),
      t("status"),
    ];
    const data = visible.map((row) => [
      row.ip,
      row.name,
      location(row.data),
      asn(row.data),
      t(typeOf(row.data)),
      score(row.data),
      source(row.data),
      checkedAt(row),
      t(row.state),
    ]);
    const url = URL.createObjectURL(
      new Blob(["\ufeff", toCsv(headers, data)], {
        type: "text/csv;charset=utf-8",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "ip-comparison.csv";
    link.click();
    URL.revokeObjectURL(url);
  }
  onMount(() => {
    const sync = (event?: Event) => {
      if (event instanceof CustomEvent && typeof event.detail === "boolean")
        hidden = event.detail;
      else {
        try {
          hidden = localStorage.getItem("ip-tools:hide-ip") === "true";
        } catch {
          /* Storage may be unavailable. */
        }
      }
    };
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener("ip-privacy-changed", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("ip-privacy-changed", sync);
    };
  });
  onDestroy(() => controller?.abort());
</script>

<svelte:head><title>{t("title")} · One IP</title></svelte:head>
<div class="batch-page">
  <ToolHeading title={t("title")} description={t("description")}>
    {#snippet icon()}<ListFilter />{/snippet}
  </ToolHeading>
  <section class="ui-panel input-panel" aria-label={t("title")}>
    <form onsubmit={submit}>
      <label for="batch-input">{t("input")}</label>
      <textarea
        id="batch-input"
        dir="ltr"
        bind:value={input}
        placeholder={t("placeholder")}
        disabled={busy}
        rows="3"
        spellcheck="false"
      ></textarea>
      <div class="actions">
        <button class="ui-button primary" type="submit" disabled={busy}
          >{t("add")}</button
        >
        <button
          class="ui-button ghost"
          type="button"
          onclick={addCurrent}
          disabled={busy}>{t("addCurrent")}</button
        >
        <span class="muted">{rows.length} / 10</span>
      </div>
    </form>
    <p class="muted note">{t("currentNote")}</p>
    {#if error}<p class="error" role="alert">{error}</p>{/if}
  </section>
  {#if rows.length}
    <section class="ui-panel results" aria-label={t("title")}>
      <div class="toolbar">
        <label
          ><span class="sr-only">{t("filter")}</span><input
            type="search"
            bind:value={query}
            placeholder={t("filterPlaceholder")}
          /></label
        >
        <label
          ><span class="sr-only">{t("type")}</span><select
            bind:value={typeFilter}
          >
            <option value="all">{t("all")}</option><option value="residential"
              >{t("residential")}</option
            ><option value="datacenter">{t("datacenter")}</option><option
              value="unknown">{t("unknown")}</option
            ><option value="conflict">{t("conflict")}</option>
          </select></label
        >
        <div class="toolbar-actions">
          <button
            class="ui-button ghost"
            onclick={() => load(rows)}
            disabled={busy}>{t("refresh")}</button
          ><button
            class="ui-button ghost"
            onclick={download}
            disabled={!visible.length || busy}>{t("export")}</button
          >
        </div>
      </div>
      {#if !visible.length}<p class="muted">{t("emptyFilter")}</p>{:else}
        <div class="table-wrap">
          <table>
            <thead
              ><tr
                ><th>{t("name")}</th><th>IP</th><th>{t("location")}</th><th
                  >ASN</th
                ><th>{t("type")}</th><th>{t("score")}</th><th>{t("source")}</th
                ><th>{t("time")}</th><th aria-label={t("remove")}></th></tr
              ></thead
            ><tbody>
              {#each visible as row (row.ip)}
                <tr>
                  <td
                    ><input
                      class="name"
                      aria-label={`${t("name")} ${hidden ? "" : row.ip}`}
                      placeholder={t("namePlaceholder")}
                      maxlength="80"
                      bind:value={row.name}
                    /></td
                  >
                  <td
                    ><bdi dir="ltr">{hidden ? "••••••••" : row.ip}</bdi
                    >{#if row.state !== "ready"}<small>{t(row.state)}</small
                      >{/if}</td
                  >
                  <td>{location(row.data)}</td><td>{asn(row.data)}</td><td
                    >{t(typeOf(row.data))}</td
                  ><td>{score(row.data)}</td><td>{source(row.data)}</td>
                  <td>{checkedAt(row)}</td>
                  <td
                    ><button
                      class="remove"
                      type="button"
                      disabled={busy}
                      aria-label={`${t("remove")} ${hidden ? row.name : row.ip}`}
                      onclick={() => {
                        rows = rows.filter((item) => item.ip !== row.ip);
                      }}>×</button
                    ></td
                  >
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
      <p class="muted note">{t("exportNote")}</p>
    </section>
  {/if}
</div>

<style>
  .batch-page {
    display: grid;
    gap: 16px;
    min-width: 0;
  }
  .input-panel,
  .results {
    min-width: 0;
    padding: 18px;
  }
  form {
    display: grid;
    gap: 8px;
  }
  label {
    font-weight: 600;
  }
  textarea,
  input,
  select {
    border: 1px solid var(--border);
    border-radius: var(--control-radius);
    background: var(--background);
    color: var(--foreground);
    padding: 0.6rem 0.75rem;
  }
  textarea {
    width: 100%;
    resize: vertical;
    min-height: 80px;
  }
  .actions,
  .toolbar,
  .toolbar-actions {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
  }
  .toolbar {
    margin-bottom: 14px;
  }
  .toolbar label:first-child {
    flex: 1 1 200px;
  }
  .toolbar input {
    width: 100%;
  }
  .toolbar-actions {
    margin-inline-start: auto;
  }
  .muted {
    color: var(--muted-foreground);
  }
  .note {
    font-size: 12px;
    margin: 10px 0 0;
  }
  .error {
    color: var(--danger);
    margin: 10px 0 0;
    overflow-wrap: anywhere;
  }
  .table-wrap {
    max-width: 100%;
    overflow-x: auto;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    text-align: start;
  }
  th,
  td {
    padding: 10px 8px;
    border-bottom: 1px solid var(--border);
    text-align: start;
    vertical-align: top;
  }
  th {
    color: var(--muted-foreground);
    font-size: 12px;
    white-space: nowrap;
  }
  td {
    font-size: 13px;
    overflow-wrap: anywhere;
  }
  td small {
    display: block;
    color: var(--muted-foreground);
  }
  .name {
    width: 120px;
    max-width: 120px;
    padding: 0.35rem 0.5rem;
  }
  .remove {
    border: 0;
    background: none;
    color: var(--muted-foreground);
    font-size: 20px;
    line-height: 1;
  }
  @media (max-width: 600px) {
    .input-panel,
    .results {
      padding: 14px;
    }
    table {
      min-width: 1000px;
    }
    th:nth-child(2),
    td:nth-child(2) {
      min-width: 145px;
    }
    th:nth-child(3),
    td:nth-child(3) {
      min-width: 160px;
    }
    th:nth-child(4),
    td:nth-child(4) {
      min-width: 80px;
    }
    .toolbar-actions {
      margin-inline-start: 0;
    }
  }
</style>
