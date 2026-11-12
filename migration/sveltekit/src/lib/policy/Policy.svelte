<script module lang="ts">
  import { messageCatalog } from '../message-catalog';

  const catalog = messageCatalog("policy");
</script>

<script lang="ts">
  import { page as routePage } from '$app/state';
  import { localeFromPath } from '../i18n';

  let { page }: { page: 'terms' | 'privacy' } = $props();
  const language = $derived(localeFromPath(routePage.url.pathname));
  function t(key: string) {
    return catalog.t(key, [], language);
  }
  const sections = {
    terms: [
      ['policy.tsx.serviceScope', 'policy.tsx.siteProvidesIpLookupsNetworkDiagnosticsBrowserChecks'],
      ['policy.tsx.acceptableUse', 'policy.tsx.useTheseToolsTargetsAuthorizedTestDoUse'],
      ['policy.tsx.apiAndRequestLimits', 'policy.tsx.apiRequiresKeyButRateLimitedRequestIp'],
      ['policy.tsx.interpretingResults', 'policy.tsx.httpResponsesLatencyDifferIcmpPingDoEstablish'],
      ['policy.tsx.resultsAndAvailability', 'policy.tsx.resultsDependNetworkBrowserRestrictionsThirdPartyData'],
      ['policy.tsx.thirdPartyServicesAndOpenSourceLicense', 'policy.tsx.whenVisitingThirdPartyLinksUsingTheirServices'],
      ['policy.tsx.serviceChanges', 'policy.tsx.featuresDataSourcesRateLimitsMayChangeCheck']
    ],
    privacy: [
      ['policy.tsx.queriesAndNetworkRequests', 'policy.tsx.hostingServiceProcessesRequestIpNecessaryNetworkRequest'],
      ['navigation.browserChecks', 'policy.tsx.browserDiagnosticsReadDisplayEnvironmentFingerprintPermissionInformation'],
      ['common.localStorage', 'policy.tsx.siteStoresPreferencesAndLookupHistory'],
      ['policy.tsx.thirdPartyDataProcessing', 'policy.tsx.ipHealthQueriesSendQueriedPublicIpNet'],
      ['policy.tsx.thirdPartyServicesUsed', 'policy.tsx.ipLookupsMayContactIpwhoIpSbIpify'],
      ['policy.tsx.webrtcAndDevicePermissions', 'policy.tsx.webrtcChecksConnectGoogleCloudflareStunServicesMay'],
      ['policy.tsx.optionalCaptcha', 'policy.tsx.whenConfiguredUsedCaptchaFeaturesLoadCloudflareTurnstile'],
      ['policy.tsx.retentionAndDeletion', 'policy.tsx.lookupHistoryKeepsLatest10SuccessfulQueriesResults']
    ]
  } as const;

</script>

<svelte:head>
  <title>{t(page === 'terms' ? 'policy.terms' : 'policy.privacy')}</title>
</svelte:head>

<div class="policy">
  <h1 class="page-title">{t(page === 'terms' ? 'policy.terms' : 'policy.privacy')}</h1>
  <article class="ui-panel document">
    {#each sections[page] as [title, body]}
      <section>
        <h2>{t(title)}</h2>
        <p>{t(body)}</p>
      </section>
    {/each}
  </article>
  <section class="ui-panel contact">
    <h2>{t('policy.contact')}</h2>
    <a class="ui-button" href="mailto:ip@kitt.tools">ip@kitt.tools</a>
  </section>
</div>

<style>
  .policy { display: grid; gap: .75rem; }
  h1 { margin: 0; }
  .document > section + section { margin-top: .8rem; padding-top: .8rem; border-top: 1px solid var(--border); }
  h2 { margin: 0 0 .28rem; font-size: .9rem; }
  p { max-width: 75ch; margin: 0; color: var(--muted-foreground); font-size: .83rem; line-height: 1.68; }
  .contact a { margin-top: .4rem; text-decoration: none; }
</style>
