<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { localeFromPath, localizedPath } from './i18n';
  import type { ModelContext } from './webmcp';

  onMount(() => {
    const context = (document as Document & { modelContext?: ModelContext }).modelContext;
    if (!context?.registerTool) return;
    const controller = new AbortController();
    void import('./webmcp').then(({ createWebMcpTools }) => {
      if (controller.signal.aborted) return;
      for (const tool of createWebMcpTools(path => { void goto(localizedPath(path, localeFromPath(location.pathname))); })) {
        void context.registerTool(tool, { signal: controller.signal }).catch(error => {
          if (!controller.signal.aborted) console.warn(`WebMCP: ${tool.name} registration failed`, error);
        });
      }
    }).catch(error => { if (!controller.signal.aborted) console.warn('WebMCP: tool loading failed', error); });
    return () => controller.abort();
  });
</script>
