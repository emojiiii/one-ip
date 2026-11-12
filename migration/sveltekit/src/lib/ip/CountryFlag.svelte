<script lang="ts">
  let { code }: { code?: string } = $props();
  const country = $derived(code?.trim().toLowerCase());
</script>

{#if country && /^[a-z]{2}$/.test(country)}
  {#key country}
    <img
      src={`https://flagcdn.com/w40/${country}.png`}
      alt=""
      width="21"
      height="15"
      decoding="async"
      referrerpolicy="no-referrer"
      onerror={(event) => event.currentTarget.setAttribute("hidden", "")}
    />
  {/key}
{/if}

<style>
  img {
    flex: none;
    object-fit: contain;
    border-radius: 2px;
  }
</style>
