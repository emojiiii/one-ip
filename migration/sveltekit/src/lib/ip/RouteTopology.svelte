<script lang="ts">
  import type { Locale } from "../i18n";
  import { t as translate } from "./tools-locale";
  type Node = { asn: string; name?: string; share: number; count: number };
  type Topology = {
    observedPaths: number;
    origins: Node[];
    direct: Node[];
    secondary: Node[];
    edges: { origin: string; direct: string; count: number; share: number }[];
    secondaryEdges: {
      direct: string;
      secondary: string;
      count: number;
      share: number;
    }[];
  };
  let { topology, locale }: { topology: Topology; locale: Locale } =
    $props();
  function t(key: string, values: readonly unknown[] = []) {
    return translate(key, values, locale);
  }
  const height = $derived(
    Math.max(
      120,
      Math.max(
        topology.origins.length,
        topology.direct.length,
        topology.secondary.length,
      ) *
        48 +
        32,
    ),
  );
  const y = (index: number) => index * 48 + 45;
  const display = (node: Node) =>
    [node.asn, node.name].filter(Boolean).join(" · ");
</script>

<div class="viewport">
  <svg
    viewBox={`0 0 900 ${height}`}
    role="img"
    aria-label={t("topology.title")}
  >
    <text x="24" y="18">{t("topology.origin")}</text><text
      x="324"
      y="18">{t("topology.direct")}</text
    ><text x="624" y="18">{t("topology.further")}</text>
    {#each topology.edges as edge}
      {@const a = topology.origins.findIndex(
        (node) => node.asn === edge.origin,
      )}
      {@const b = topology.direct.findIndex((node) => node.asn === edge.direct)}
      {#if a >= 0 && b >= 0}<path
          d={`M 270 ${y(a)} C 295 ${y(a)}, 295 ${y(b)}, 320 ${y(b)}`}
          class="edge"
        />{/if}
    {/each}
    {#each topology.secondaryEdges as edge}
      {@const a = topology.direct.findIndex((node) => node.asn === edge.direct)}
      {@const b = topology.secondary.findIndex(
        (node) => node.asn === edge.secondary,
      )}
      {#if a >= 0 && b >= 0}<path
          d={`M 570 ${y(a)} C 595 ${y(a)}, 595 ${y(b)}, 620 ${y(b)}`}
          class="edge"
        />{/if}
    {/each}
    {#each [topology.origins, topology.direct, topology.secondary] as group, column}
      {#each group as node, index}
        <g transform={`translate(${column * 300 + 20} ${y(index) - 15})`}>
          <rect width="250" height="30" rx="6"></rect>
          <text x="8" y="19">{display(node).slice(0, 28)} · {node.share}%</text>
          <title
            >{display(node)} · {t("topology.pathCount", [node.count])}</title
          >
        </g>
      {/each}
    {/each}
  </svg>
</div>

<style>
  .viewport {
    overflow-x: auto;
    padding: 8px;
    border-radius: 8px;
    background: var(--muted);
  }
  svg {
    display: block;
    min-width: 650px;
    width: 100%;
    font-size: 11px;
    fill: currentColor;
  }
  .edge {
    fill: none;
    stroke: color-mix(in srgb, var(--primary) 35%, var(--border));
    stroke-width: 2;
  }
  rect {
    fill: var(--card);
    stroke: var(--border);
  }
</style>
