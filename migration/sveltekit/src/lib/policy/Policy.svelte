<script module lang="ts">
  import { messageCatalog } from '../message-catalog';

  const catalog = messageCatalog("policy");
</script>

<script lang="ts">
  import { page as routePage } from '$app/state';
  import { localeFromPath } from '../i18n';
  import X from '@lucide/svelte/icons/x';

  let { page }: { page: 'terms' | 'privacy' } = $props();
  const language = $derived(localeFromPath(routePage.url.pathname));
  let contact: HTMLDialogElement;
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
    <h2>{t('policy.contactAuthor')}</h2>
    <p>{t('policy.tsx.questionsAboutSiteUsagePrivacyContactAuthorEmail')}</p>
    <div class="contact-links">
      <a class="ui-button" href="mailto:ip@huzhihui.com">ip@huzhihui.com</a>
      <button class="ui-button" type="button" onclick={() => contact.showModal()}>{t('sites.wechat')}</button>
    </div>
  </section>
</div>

<dialog bind:this={contact} aria-labelledby="contact-title">
  <div class="dialog-header">
    <h2 id="contact-title">{t('policy.contactAuthor')}</h2>
    <button class="ui-button ghost" type="button" aria-label={t('common.close')} onclick={() => contact.close()}><X size={16} aria-hidden="true" /></button>
  </div>
  <img src="/contact/wechat.jpg" alt={t('contact.weChatQrCode')} width="192" />
  <p>{t('contact.scanWeChatHint')}</p>
  <p>{t('contact.weChatRemarkHint')}</p>
  <a href="mailto:ip@huzhihui.com">ip@huzhihui.com</a>
</dialog>

<style>
  .policy { display: grid; gap: .75rem; }
  h1 { margin: 0; }
  .document > section + section { margin-top: .8rem; padding-top: .8rem; border-top: 1px solid var(--border); }
  h2 { margin: 0 0 .28rem; font-size: .9rem; }
  p { max-width: 75ch; margin: 0; color: var(--muted-foreground); font-size: .83rem; line-height: 1.68; }
  .contact-links { display: flex; flex-wrap: wrap; gap: .5rem; margin-top: .65rem; }
  .contact-links a { text-decoration: none; }
  dialog {
    width: min(24rem, calc(100% - 2rem));
    max-height: 85dvh;
    padding: 1rem;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--card);
    color: var(--foreground);
    box-shadow: 0 16px 48px #0003;
  }
  dialog::backdrop { background: #11182770; }
  dialog img { display: block; max-width: 100%; height: auto; margin: .7rem auto; border-radius: .5rem; }
  dialog p { margin-bottom: .4rem; }
  dialog a { font-size: .82rem; }
  .dialog-header { display: flex; align-items: center; justify-content: space-between; gap: .75rem; }
  .dialog-header h2 { margin: 0; }
  .dialog-header button { padding-inline: .45rem; }
</style>
