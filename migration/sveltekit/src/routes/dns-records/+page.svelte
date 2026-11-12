<script module lang="ts">
  import { messageCatalog } from "../../lib/message-catalog";
  const catalog = messageCatalog("dns-records");
</script>

<script lang="ts">
  import { onDestroy } from "svelte";
  import { page } from "$app/state";
  import Network from "@lucide/svelte/icons/network";
  import ToolHeading from "../../lib/ToolHeading.svelte";
  import { localeFromPath } from "../../lib/i18n";
  import {
    dnsTypes,
    normalizeDomain,
    queryDns,
    type DnsProvider,
    type DnsResult,
    type DnsType,
  } from "../../lib/dns-records";

  type Cell =
    | { state: "loading" }
    | { state: "failed" }
    | { state: "ready"; result: DnsResult };
  type Results = Record<DnsType, Record<DnsProvider, Cell>>;
  const providers = ["cloudflare", "google"] as const;
  const labels = { cloudflare: "Cloudflare", google: "Google" } as const;
  const recordNames: Record<number, string> = {
    1: "A",
    28: "AAAA",
    5: "CNAME",
    15: "MX",
    16: "TXT",
  };
  const locale = $derived(localeFromPath(page.url.pathname));
  let input = $state("");
  let domain = $state("");
  let error = $state("");
  let results = $state<Results | null>(null);
  let busy = $state(false);
  let controller: AbortController | undefined;

  function t(key: string, values: readonly unknown[] = []) {
    return catalog.t(`dnsRecords.${key}`, values, locale);
  }
  function statusText(status: number) {
    if (status === 3) return t("nxdomain");
    if (status === 2) return t("servfail");
    return t("dnsError", [status]);
  }
  async function run(name: string) {
    controller?.abort();
    const runController = new AbortController();
    controller = runController;
    busy = true;
    domain = name;
    results = Object.fromEntries(
      dnsTypes.map((type) => [
        type,
        {
          cloudflare: { state: "loading" },
          google: { state: "loading" },
        },
      ]),
    ) as Results;
    const current = results;
    await Promise.all(
      dnsTypes.flatMap((type) =>
        providers.map(async (provider) => {
          try {
            const result = await queryDns(
              name,
              provider,
              type,
              runController.signal,
            );
            if (!runController.signal.aborted)
              current[type][provider] = { state: "ready", result };
          } catch {
            if (!runController.signal.aborted)
              current[type][provider] = { state: "failed" };
          }
        }),
      ),
    );
    if (controller === runController) {
      busy = false;
      controller = undefined;
    }
  }
  function submit(event: SubmitEvent) {
    event.preventDefault();
    const name = normalizeDomain(input);
    if (!name) {
      error = t("invalid");
      return;
    }
    input = name;
    error = "";
    void run(name);
  }
  onDestroy(() => controller?.abort());
</script>

<svelte:head><title>{t("title")} · One IP</title></svelte:head>
<div class="dns-page">
  <ToolHeading title={t("title")} description={t("description")}>
    {#snippet icon()}<Network />{/snippet}
  </ToolHeading>
  <section class="ui-panel input-panel" aria-label={t("title")}>
    <form onsubmit={submit}>
      <label for="dns-domain">{t("domain")}</label>
      <div class="input-row">
        <input
          id="dns-domain"
          dir="ltr"
          bind:value={input}
          placeholder="example.com"
          autocomplete="off"
          spellcheck="false"
          disabled={busy}
        />
        <button class="ui-button primary" type="submit" disabled={busy}
          >{busy ? t("querying") : t("query")}</button
        >
      </div>
      {#if error}<p class="error" role="alert">{error}</p>{/if}
    </form>
  </section>

  {#if results}
    <section class="ui-panel results" aria-label={t("results")}>
      <div class="result-heading">
        <h2><bdi dir="ltr">{domain}</bdi></h2>
        <button
          class="ui-button ghost"
          type="button"
          disabled={busy}
          onclick={() => run(domain)}>{t("refresh")}</button
        >
      </div>
      <p class="muted note">{t("note")}</p>
      <div class="table-wrap">
        <table>
          <thead
            ><tr
              ><th scope="col">{t("type")}</th>{#each providers as provider}<th
                  scope="col">{labels[provider]}</th
                >{/each}</tr
            ></thead
          >
          <tbody>
            {#each dnsTypes as type (type)}
              <tr
                ><th scope="row">{type}</th>
                {#each providers as provider (provider)}
                  {@const cell = results[type][provider]}
                  <td>
                    {#if cell.state === "loading"}<span class="muted"
                        >{t("querying")}</span
                      >
                    {:else if cell.state === "failed"}<span class="failed"
                        >{t("failed")}</span
                      >
                    {:else}
                      {#if cell.result.status !== 0}<span class="failed"
                          >{statusText(cell.result.status)}</span
                        >{/if}
                      {#if cell.result.answers.length}
                        <ul class="answers">
                          {#each cell.result.answers as answer}
                            <li>
                              <div class="record" dir="ltr">
                                <span class="record-type"
                                  >{recordNames[answer.type] ??
                                    answer.type}</span
                                >
                                {answer.data}
                              </div>
                              <small
                                ><bdi dir="ltr">{answer.name}</bdi> · TTL {answer.ttl}s</small
                              >
                            </li>
                          {/each}
                        </ul>
                      {:else if cell.result.status === 0 && !cell.result.truncated}
                        <span class="muted">{t("noRecords")}</span>
                      {/if}
                    {/if}
                    {#if cell.state === "ready" && cell.result.truncated}<small
                        class="truncated">{t("truncated")}</small
                      >{/if}
                    {#if cell.state === "ready"}<small class="time"
                        >{t("checkedAt")}
                        {new Date(cell.result.checkedAt).toLocaleString(
                          locale,
                        )}</small
                      >{/if}
                  </td>
                {/each}
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </section>
  {/if}
</div>

<style>
  .dns-page {
    display: grid;
    gap: 16px;
  }
  .input-panel,
  .results {
    padding: 18px;
  }
  form {
    display: grid;
    gap: 8px;
  }
  label {
    font-weight: 600;
  }
  .input-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  input {
    flex: 1 1 220px;
    min-width: 0;
    border: 1px solid var(--border);
    border-radius: var(--control-radius);
    background: var(--background);
    color: var(--foreground);
    padding: 0.6rem 0.75rem;
  }
  .result-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  h2 {
    margin: 0;
    font-size: 16px;
    overflow-wrap: anywhere;
  }
  .muted,
  small {
    color: var(--muted-foreground);
  }
  .note {
    font-size: 12px;
    margin: 8px 0 14px;
  }
  .error,
  .failed {
    color: var(--danger);
  }
  .truncated {
    color: var(--warning);
  }
  .error {
    margin: 0;
  }
  .table-wrap {
    overflow-x: auto;
  }
  table {
    width: 100%;
    min-width: 600px;
    border-collapse: collapse;
    table-layout: fixed;
  }
  th,
  td {
    border-bottom: 1px solid var(--border);
    padding: 10px 8px;
    text-align: start;
    vertical-align: top;
    overflow-wrap: anywhere;
  }
  th:first-child {
    width: 75px;
  }
  thead th {
    font-size: 13px;
  }
  td {
    font-size: 13px;
  }
  .answers {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    gap: 8px;
  }
  .record {
    unicode-bidi: isolate;
  }
  .record-type {
    font-weight: 650;
  }
  small {
    display: block;
    overflow-wrap: anywhere;
  }
  .time {
    margin-top: 8px;
    font-size: 11px;
  }
  @media (max-width: 600px) {
    .input-panel,
    .results {
      padding: 14px;
    }
    table {
      min-width: 0;
    }
    th:first-child {
      width: 65px;
      white-space: nowrap;
    }
    th,
    td {
      padding: 8px 5px;
    }
    td {
      font-size: 12px;
    }
  }
</style>
