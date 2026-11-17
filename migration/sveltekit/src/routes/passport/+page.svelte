<script lang="ts">
  import { page } from "$app/state";
  import { localeFromPath } from "../../lib/i18n";
  import Passport from "../../lib/passport/Passport.svelte";

  const locale = $derived(localeFromPath(page.url.pathname));
</script>

<Passport {locale} />
