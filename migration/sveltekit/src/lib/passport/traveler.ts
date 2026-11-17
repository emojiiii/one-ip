import type { RoutingSummary } from './routing';
import { getPassportText, passportFormat } from './locales';

export type TravelerKind = 'aligned' | 'cross-region' | 'unknown';
export type ExitType = 'residential' | 'datacenter' | 'mobile' | 'public-service' | 'conflict';

export interface TravelerBadge {
  id: 'exits' | 'routing' | 'timezone' | 'network' | 'reputation' | 'language';
  label: string;
  detail: string;
}

export interface TravelerProfile {
  kind: TravelerKind;
  title: string;
  description: string;
  basis: string;
  badges: TravelerBadge[];
}

export async function travelerProfile({ countryCode, timeZone, language, locale, reputationScore, reputationSource, exitType, routing }: {
  countryCode?: string;
  timeZone?: string;
  language?: string;
  locale: string;
  reputationScore?: number;
  reputationSource?: string;
  exitType?: ExitType;
  routing?: RoutingSummary;
}): Promise<TravelerProfile> {
  if (!import.meta.env.SSR) {
    const { getCountry, getTimezone } = await import('countries-and-timezones');
    const code = countryCode?.trim().toUpperCase();
    const country = code ? getCountry(code)?.id : undefined;
    const zone = timeZone?.trim();
    const countries = zone ? getTimezone(zone)?.countries : undefined;
    const kind: TravelerKind = !country || !countries?.length
      ? 'unknown'
      : countries.includes(country) ? 'aligned' : 'cross-region';
    const preference = language?.trim();
    const copy = getPassportText(locale).traveler;
    let languageLabel = preference || copy.unknown;
    if (preference) {
      try {
        languageLabel = new Intl.DisplayNames([locale], { type: 'language' }).of(preference) || preference;
      } catch (error) {
        if (!(error instanceof RangeError)) throw error;
      }
    }
    const titles = { aligned: copy.titlesAligned, 'cross-region': copy.titlesCross, unknown: copy.titlesUnknown };
    const typeTitles = { residential: copy.typeResidential, datacenter: copy.typeDatacenter, mobile: copy.typeMobile, 'public-service': copy.typePublic, conflict: copy.typeConflict };
    const descriptions = { aligned: passportFormat(copy.descAligned, { language: languageLabel }), 'cross-region': passportFormat(copy.descCross, { language: languageLabel }), unknown: passportFormat(copy.descUnknown, { language: languageLabel }) };
    const basis = passportFormat(copy.basis, { zone: zone || copy.unknown, country: country || copy.unknown, language: preference || copy.unknown });
    const badges: TravelerBadge[] = [];
    if (routing) {
      const { comparison, sites } = routing;
      badges.push({ id: 'exits',
        label: comparison === 'different' ? copy.exitsDifferent : comparison === 'same' ? copy.exitsSame : copy.exitsUnknown,
        detail: comparison === 'different' ? copy.exitsDifferentDetail : comparison === 'same' ? copy.exitsSameDetail : copy.exitsUnknownDetail });
      const multiple = (sites.ipv4Observed >= 2 && sites.ipv4Exits >= 2) || (sites.ipv6Observed >= 2 && sites.ipv6Exits >= 2);
      const eligible = sites.total - sites.unsupported;
      badges.push({ id: 'routing', label: sites.observed === 0 ? copy.routingUnavailable : multiple ? copy.routingMultiple : copy.routingObserved,
        detail: eligible === 0 ? copy.routingNoSites : passportFormat(copy.routingDetail, { observed: sites.observed, eligible, ipv4: sites.ipv4Exits, ipv6: sites.ipv6Exits }) });
    }
    if (kind !== 'unknown') badges.push({ id: 'timezone', label: kind === 'aligned' ? copy.timezoneAligned : copy.timezoneCross,
      detail: passportFormat(kind === 'aligned' ? copy.timezoneAlignedDetail : copy.timezoneCrossDetail, { zone: zone!, country: country! }) });
    if (exitType) {
      const labels = { residential: copy.networkResidential, datacenter: copy.networkDatacenter, mobile: copy.networkMobile, 'public-service': copy.networkPublic, conflict: copy.networkConflict };
      const details = { residential: copy.networkResidentialDetail, datacenter: copy.networkDatacenterDetail, mobile: copy.networkMobileDetail, 'public-service': copy.networkPublicDetail, conflict: copy.networkConflictDetail };
      badges.push({ id: 'network', label: labels[exitType], detail: details[exitType] });
    }
    if (reputationScore != null && Number.isFinite(reputationScore) && reputationScore >= 0 && reputationScore <= 100) {
      const source = reputationSource ? ` · ${reputationSource}` : '';
      const label = reputationScore >= 90 ? copy.reputationHigh : reputationScore >= 75 ? copy.reputationGood : reputationScore >= 45 ? copy.reputationWatch : copy.reputationLow;
      badges.push({ id: 'reputation', label: `${label} · ${reputationScore}/100`, detail: passportFormat(copy.reputationDetail, { score: reputationScore, source }) });
    }
    if (preference) badges.push({ id: 'language', label: copy.languageLabel, detail: passportFormat(copy.languageDetail, { language: languageLabel }) });
    const multipleSites = routing && ((routing.sites.ipv4Observed >= 2 && routing.sites.ipv4Exits >= 2) ||
      (routing.sites.ipv6Observed >= 2 && routing.sites.ipv6Exits >= 2));
    const sameFamilySites = routing &&
      ((routing.sites.ipv4Observed >= 2 && routing.sites.ipv4Exits === 1 && routing.sites.ipv6Exits === 0) ||
       (routing.sites.ipv6Observed >= 2 && routing.sites.ipv6Exits === 1 && routing.sites.ipv4Exits === 0));
    const routeTitle = multipleSites ? copy.routeMultiple
      : routing?.comparison === 'different' ? copy.routeDual
        : routing?.comparison === 'same' || sameFamilySites ? copy.routeSame
          : undefined;
    const scoreValid = reputationScore != null && Number.isFinite(reputationScore) && reputationScore >= 0 && reputationScore <= 100;
    const comboKind = routing && (routing.comparison === 'different' && routing.sites.domesticMatches > 0 && routing.sites.overseasMatches > 0
      ? 'balanced' : multipleSites ? 'multi' : routing.comparison === 'different' ? 'dual'
        : routing.comparison === 'same' || sameFamilySites ? 'same' : undefined);
    if (routing && comboKind && scoreValid) {
      const tier = reputationScore >= 90 ? 'High' : reputationScore >= 75 ? 'Good' : reputationScore >= 45 ? 'Watch' : 'Low';
      const copy = getPassportText(locale).traveler;
      const key = `${comboKind}${tier}` as keyof typeof copy.comboTitles;
      const values: Record<string, string> = {
        domestic: String(routing.sites.domesticMatches),
        overseas: String(routing.sites.overseasMatches),
        observed: String(routing.sites.observed),
        eligible: String(routing.sites.total - routing.sites.unsupported),
        score: String(reputationScore),
      };
      const description = copy.comboDescriptions[comboKind].replace(/\{(domestic|overseas|observed|eligible|score)\}/g, (_, name: string) => values[name]);
      return { kind, title: copy.comboTitles[key], description, basis, badges };
    }
    return { kind, title: routeTitle ?? (exitType ? typeTitles[exitType] : titles[kind]), description: descriptions[kind], basis, badges };
  }
  throw new Error('Traveler profiles are available only in the browser.');
}
