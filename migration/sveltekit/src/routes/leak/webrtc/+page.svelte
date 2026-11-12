<script lang="ts">
  import { page } from "$app/state";
  import { onMount } from "svelte";
  import { localeFromPath } from "../../../lib/i18n";
  import Webcam from "@lucide/svelte/icons/webcam";
  import RefreshCw from "@lucide/svelte/icons/refresh-cw";
  import ToolHeading from "../../../lib/ToolHeading.svelte";
  import { runWebRtc } from "./api";
  import { t as translate } from "./locale";

  function t(key: string, values: readonly unknown[] = []) {
    return translate(key, values, localeFromPath(page.url.pathname));
  }

  let { embedded = false }: { embedded?: boolean } = $props();
  let hideIp = $state(false);

  let result = $state<Awaited<ReturnType<typeof runWebRtc>> | null>(null);
  let busy = $state(true);
  let error = $state("");
  let ready = $state(false);
  let controller: AbortController;
  const faqs = [
    [
      "webrtc.whatIsAWebrtcLeak",
      "webrtc.webrtcUsesIceStunDiscoverAddressesPeerPeer",
    ],
    [
      "webrtc.whatAreStunAndUdp",
      "webrtc.udpConnectionlessTransportProtocolStunServerReturnsPublic",
    ],
    ["webrtc.faq.mdnsTitle", "webrtc.faq.mdnsText"],
    [
      "webrtc.howITellIfThereLeak",
      "webrtc.differentEgressIndicatesDifferentUdpHttpRoutesWhich",
    ],
    [
      "webrtc.howDoIFixALeak",
      "webrtc.checkUdpForwardingTunTrafficHandlingIpv6Rules",
    ],
    [
      "webrtc.whyDoProxyTunModesGiveDifferentResults",
      "webrtc.systemProxyVirtualNetworkAdapterModesHandleDifferent",
    ],
  ];
  async function run() {
    controller?.abort();
    const current = new AbortController();
    controller = current;
    busy = true;
    error = "";
    result = null;
    try {
      result = await runWebRtc(undefined, current.signal);
    } catch (cause) {
      if (!current.signal.aborted)
        error = cause instanceof Error ? cause.message : String(cause);
    } finally {
      if (controller === current) busy = false;
    }
  }
  onMount(() => {
    const updatePrivacy = (event?: Event) => {
      if (event instanceof CustomEvent && typeof event.detail === "boolean") {
        hideIp = event.detail;
        return;
      }
      try {
        hideIp = localStorage.getItem("ip-tools:hide-ip") === "true";
      } catch {
        /* Keep the current state. */
      }
    };
    updatePrivacy();
    window.addEventListener("storage", updatePrivacy);
    window.addEventListener("ip-privacy-changed", updatePrivacy);
    ready = true;
    void run();
    return () => {
      controller.abort();
      window.removeEventListener("storage", updatePrivacy);
      window.removeEventListener("ip-privacy-changed", updatePrivacy);
    };
  });
  function ipText(ip: string | undefined) {
    return ip ? (hideIp ? "••••••••" : ip) : t("leak.unavailable");
  }
</script>

<svelte:head
  >{#if !embedded}<title
      >{t("navigation.webrtcLeak")}</title
    >{/if}</svelte:head
>

<div class="webrtc" class:embedded>
  {#snippet retry()}
    <button class="ui-button" disabled={busy} onclick={run}>
      <RefreshCw size={15} aria-hidden="true" />
      {t(busy ? "common.checkingDots" : "common.runAgain")}
    </button>
  {/snippet}
  {#if embedded}
    <header>
      <h2 class="title">
        <Webcam size={16} aria-hidden="true" />{t("webrtc.webrtcEgressCheck")}
      </h2>
      {@render retry()}
    </header>
  {:else}
    <ToolHeading
      title={t("webrtc.webrtcEgressCheck")}
    >
      {#snippet icon()}<Webcam />{/snippet}
      {@render retry()}
    </ToolHeading>
  {/if}
  <section class="ui-panel">
    {#if ready}
      {@const level = busy ? "pending" : (result?.level ?? "unknown")}
      <div class="conclusion" data-level={level} role="status">
        <strong>{t(`webrtc.conclusion.${level}`)}</strong>
        <p>
          {busy
            ? t("webrtc.collectingIceCandidates")
            : hideIp && result
              ? [
                  ...result.localExposed,
                  ...result.results.map((row) => row.ip),
                ].reduce(
                  (text, ip) => text.replaceAll(ip, "••••••••"),
                  result.verdict,
                )
              : (result?.verdict ?? t("webrtc.checkIncomplete"))}
        </p>
      </div>
      <dl>
        <div>
          <dt>{t("leak.httpEgressIpv4")}</dt>
          <dd>{busy ? "—" : ipText(result?.egress.ipv4?.ip)}</dd>
        </div>
        <div>
          <dt>{t("leak.httpEgressIpv6")}</dt>
          <dd>{busy ? "—" : ipText(result?.egress.ipv6?.ip)}</dd>
        </div>
        <div>
          <dt>{t("webrtc.publicCandidates")}</dt>
          <dd>{result?.results.filter((row) => row.public).length ?? 0}</dd>
        </div>
        <div>
          <dt>{t("webrtc.mdnsHidden")}</dt>
          <dd>{result?.mdns ?? 0}</dd>
        </div>
        <div>
          <dt>{t("webrtc.localExposed")}</dt>
          <dd>
            {result?.localExposed.length
              ? result.localExposed.map(ipText).join(", ")
              : t("webrtc.none")}
          </dd>
        </div>
      </dl>
    {:else}
      <p role="status">{t("webrtc.collectingIceCandidates")}</p>
    {/if}
  </section>
  {#if error}<p class="error" role="alert">{error}</p>{/if}
  {#if result?.results.length}
    <section class="ui-panel">
      <!-- svelte-ignore a11y_no_noninteractive_tabindex (The results can be scrolled with the keyboard.) -->
      <div
        class="table"
        role="region"
        tabindex="0"
        aria-label={t("webrtc.publicCandidates")}
      >
        <table>
          <thead>
            <tr>
              <th scope="col">{t("webrtc.ipAddress")}</th>
              <th scope="col">{t("webrtc.type")}</th>
              <th scope="col">{t("webrtc.protocol")}</th>
              <th scope="col">{t("common.location")}</th>
              <th scope="col">{t("common.status")}</th>
            </tr>
          </thead>
          <tbody>
            {#each result.results as row}
              <tr>
                <td class="address"><bdi dir="ltr">{ipText(row.ip)}</bdi></td>
                <td>{row.type}</td>
                <td
                  >{[
                    row.family ? `IPv${row.family}` : "",
                    ...(row.protocols ?? []).map((protocol) =>
                      protocol.toUpperCase(),
                    ),
                  ]
                    .filter(Boolean)
                    .join(" · ") || "—"}</td
                >
                <td
                  >{row.geo
                    ? [row.geo.country, row.geo.city]
                        .filter(Boolean)
                        .join(" ") || t("common.unknown")
                    : t("common.unknown")}</td
                >
                <td
                  ><span class="status"
                    >{t(
                      `webrtc.status.${row.status ?? (row.public ? "unverified" : "local")}`,
                    )}</span
                  ></td
                >
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </section>
  {/if}
  {#if !embedded}
    <div class="ui-panel questions">
      {#each faqs as [question, answer]}
        <details>
          <summary>{t(question)}</summary>
          <p>{t(answer)}</p>
        </details>
      {/each}
    </div>
  {/if}
</div>

<style>
  .webrtc {
    display: grid;
    min-width: 0;
    gap: 1rem;
  }
  .questions {
    padding-block: 0.25rem;
  }
  .questions details + details {
    border-top: 1px solid var(--border, var(--color-border));
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 0.5rem 0.75rem;
  }
  .title {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    font-size: 1rem;
    font-weight: 650;
  }
  .title :global(svg) {
    color: var(--primary);
  }
  .conclusion {
    --tone: var(--primary);
    position: relative;
    padding: 1rem;
    padding-inline-start: 2.1rem;
    border-radius: 0.75rem;
    background: color-mix(in srgb, var(--tone) 8%, var(--card));
  }
  .conclusion::before {
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
  .conclusion[data-level="safe"] {
    --tone: var(--success);
  }
  .conclusion[data-level="warning"] {
    --tone: var(--warning);
  }
  .conclusion[data-level="leak"] {
    --tone: var(--danger);
  }
  .conclusion strong {
    color: var(--tone);
    font-size: 1rem;
  }
  p,
  dt {
    margin: 0;
    line-height: 1.55;
    font-size: 0.8125rem;
    color: var(--muted-foreground, var(--color-muted-foreground));
  }
  .conclusion p {
    margin-top: 0.25rem;
    overflow-wrap: anywhere;
  }
  dl {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.75rem;
    margin: 1rem 0 0;
  }
  dl div {
    padding: 0.65rem 0.75rem;
    border-radius: 0.625rem;
    background: var(--muted);
  }
  dd {
    margin: 0.2rem 0 0;
    font-size: 1rem;
    font-weight: 650;
    overflow-wrap: anywhere;
  }
  dd,
  .address {
    font-variant-numeric: tabular-nums;
  }
  .table {
    overflow-x: auto;
    border-radius: 0.65rem;
  }
  table {
    border-collapse: collapse;
    font-size: 0.8125rem;
    width: 100%;
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
  .status {
    display: inline-block;
    padding: 0.15rem 0.45rem;
    border-radius: 0.375rem;
    background: var(--muted, var(--color-muted));
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
