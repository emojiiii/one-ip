<script lang="ts">
  import type { Locale } from "../i18n";
  import { t as translate } from "./tools-locale";
  import { onMount } from "svelte";
  import type { Map as LeafletMap } from "leaflet";
  import type { Geo } from "./types";
  import { attachMapLayers, loadMapConfig, mapExternalUrl } from "./map";
  import "leaflet/dist/leaflet.css";

  let {
    geo,
    others = [],
    locale,
  }: { geo: Geo; others?: Geo[]; locale: Locale } = $props();
  function t(key: string, values: readonly unknown[] = []) {
    return translate(key, values, locale);
  }
  let container = $state<HTMLElement>();
  let map: LeafletMap | undefined;
  let failed = $state(false);
  let loading = $state(true);
  const valid = $derived(
    typeof geo.latitude === "number" &&
      Number.isFinite(geo.latitude) &&
      Math.abs(geo.latitude) <= 90 &&
      typeof geo.longitude === "number" &&
      Number.isFinite(geo.longitude) &&
      Math.abs(geo.longitude) <= 180,
  );
  const label = $derived(
    [geo.country, geo.region, geo.city]
      .filter(Boolean)
      .filter((value, index, list) => list.indexOf(value) === index)
      .join(" · ") || t("map.location"),
  );

  onMount(() => {
    if (!valid) return;
    const latitude = geo.latitude!;
    const longitude = geo.longitude!;
    let disposed = false;
    let detachLayers = () => {};
    let resize: ResizeObserver | undefined;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      void import("leaflet")
        .then(async (leaflet) => {
          if (disposed) return;
          const L = leaflet.default;
          const instance = L.map(container!, {
            scrollWheelZoom: false,
            minZoom: 2,
            maxZoom: 15,
            zoomControl: false,
          }).setView([latitude, longitude], 7);
          map = instance;
          L.control.zoom({ position: "bottomright" }).addTo(instance);
          const markerLabel = document.createElement("span");
          markerLabel.textContent = label;
          L.circleMarker([latitude, longitude], {
            radius: 7,
            color: "#fff",
            weight: 2,
            fillColor: "#1976d2",
            fillOpacity: 1,
          })
            .bindTooltip(markerLabel, { direction: "top", offset: [0, -8] })
            .addTo(instance);
          const bounds: [number, number][] = [[latitude, longitude]];
          for (const point of others) {
            if (
              typeof point.latitude !== "number" ||
              typeof point.longitude !== "number" ||
              !Number.isFinite(point.latitude) ||
              !Number.isFinite(point.longitude) ||
              Math.abs(point.latitude) > 90 ||
              Math.abs(point.longitude) > 180
            )
              continue;
            bounds.push([point.latitude, point.longitude]);
            const pointLabel = document.createElement("span");
            pointLabel.textContent = [point.country, point.region, point.city]
              .filter(Boolean)
              .join(" · ");
            L.circleMarker([point.latitude, point.longitude], {
              radius: 7,
              color: "#fff",
              weight: 2,
              fillColor: "#1976d2",
              fillOpacity: 1,
            })
              .bindTooltip(pointLabel, { direction: "top", offset: [0, -8] })
              .addTo(instance);
          }
          if (bounds.length > 1)
            instance.fitBounds(bounds, { padding: [20, 20], maxZoom: 7 });
          const config = await loadMapConfig();
          if (disposed) return;
          detachLayers = attachMapLayers(
            L.tileLayer,
            instance,
            config,
            () => {
              loading = false;
              failed = false;
            },
            () => {
              loading = false;
              failed = true;
            },
          );
          resize = new ResizeObserver(() => instance.invalidateSize());
          resize.observe(container!);
        })
        .catch(() => {
          if (!disposed) {
            loading = false;
            failed = true;
          }
        });
    });
    observer.observe(container!);
    return () => {
      disposed = true;
      observer.disconnect();
      resize?.disconnect();
      detachLayers();
      map?.remove();
      map = undefined;
    };
  });
</script>

<section>
  <div class="head">
    <h2>{t("map.approximateLocation")}</h2>
    {#if valid}<div>
        <button
          onclick={() =>
            map?.setView([geo.latitude!, geo.longitude!], 7, {
              animate: false,
            })}>{t("map.recenter")}</button
        >
        <a
          href={mapExternalUrl(geo.latitude!, geo.longitude!, label)}
          target="_blank"
          rel="noopener noreferrer">{t("map.open")}</a
        >
      </div>{/if}
  </div>
  {#if valid}<p>
      {label} · {geo.latitude!.toFixed(2)}, {geo.longitude!.toFixed(2)}
    </p>
    <div
      class="map"
      bind:this={container}
      aria-label={t("map.ariaLabel")}
      aria-busy={loading}
    ></div>
    {#if failed}<p role="status">
        {t("map.tilesUnavailable")}
      </p>{/if}
    <p class="note">
      {t("map.approximateNotice")}
    </p>{:else}<p>
      {t("map.noCoordinates")}
    </p>{/if}
</section>

<style>
  section {
    min-width: 0;
    padding: 15px 16px;
    border: 1px solid var(--border);
    border-radius: var(--radius, 14px);
    background: var(--card);
  }
  .head,
  .head div {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .head {
    justify-content: space-between;
  }
  h2 {
    margin: 0;
    font-size: 0.95rem;
    font-weight: 650;
  }
  button {
    cursor: pointer;
    color: inherit;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--muted);
    padding: 5px 9px;
    font: inherit;
    font-size: 0.75rem;
  }
  button:hover {
    border-color: var(--primary);
  }
  a {
    color: var(--muted-foreground);
    font-size: 0.75rem;
    text-decoration: none;
  }
  a:hover {
    color: var(--primary);
  }
  .map {
    height: clamp(190px, 32vw, 270px);
    width: 100%;
    border-radius: 8px;
    z-index: 0;
    background: var(--muted);
  }
  .map :global(.leaflet-tile-pane) {
    filter: saturate(0.68);
  }
  :global(.dark) .map :global(.leaflet-tile-pane) {
    filter: grayscale(1) invert(1) brightness(0.75) contrast(0.9);
  }
  p {
    font-size: 0.8rem;
    color: var(--muted-foreground);
    margin: 8px 0;
  }
  .note {
    font-size: 0.72rem;
    margin-bottom: 0;
  }
  @media (max-width: 640px) {
    section {
      padding: 12px;
    }
  }
</style>
