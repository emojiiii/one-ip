<script lang="ts">
  import type { Snippet } from 'svelte';

  let { title, icon, description, children }: {
    title: string;
    icon: Snippet;
    description?: string;
    children?: Snippet;
  } = $props();
</script>

<header>
  <div class="identity">
    <span class="icon" aria-hidden="true">{@render icon()}</span>
    <div>
      <h1>{title}</h1>
      {#if description}<p>{description}</p>{/if}
    </div>
  </div>
  {#if children}<div class="actions">{@render children()}</div>{/if}
</header>

<style>
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: .75rem;
    padding-block: .15rem .5rem;
  }
  .identity { display: flex; align-items: center; gap: .75rem; min-width: 0; }
  .icon {
    display: grid;
    place-items: center;
    flex: none;
    width: 2.625rem;
    height: 2.625rem;
    border-radius: 12px;
    background: var(--primary-soft);
    color: var(--primary);
  }
  .icon :global(svg) { width: 1.25rem; height: 1.25rem; }
  h1 { margin: 0; font-size: clamp(1.375rem, 3vw, 1.75rem); font-weight: 690; line-height: 1.2; letter-spacing: -.035em; }
  p { margin: .25rem 0 0; color: var(--muted-foreground); font-size: .8125rem; }
  .actions { flex: none; }
  @media (max-width: 420px) {
    header, .identity { gap: .55rem; }
    .icon { width: 2.375rem; height: 2.375rem; }
  }
</style>
