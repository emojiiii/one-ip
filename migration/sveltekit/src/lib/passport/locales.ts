import { messageCatalog } from '../message-catalog';
import type { Locale } from '../i18n';

const { t } = messageCatalog('passport');
const uiKeys = ["title","description","name","english","issued","location","network","browser","device","language","timezone","screen","processors","unknown","loading","mark","footer","save","share","refresh","failed","saveFailed","shareFailed","source","reputationSource","flagFailed","traveler","travelerLoading","travelerFailed","badges","unknownReputation","unknownReputationDetail","routing","routingLoading","routingFailed","domesticProbe","overseasProbe","observedRegionUnknown","sameExit","differentExit","unknownExit","routeDetails","routeDomestic","routeOverseas","routeBoth","routeOther","routeUnknown","siteUnavailable","siteUnsupported","siteNotAttempted","routeInfo","sitesSummary","familySummary","groupsSummary","shareX","shareXHint","xPostText"] as const;
const travelerKeys = ["unknown","titlesAligned","titlesCross","titlesUnknown","typeResidential","typeDatacenter","typeMobile","typePublic","typeConflict","routeMultiple","routeDual","routeSame","descAligned","descCross","descUnknown","basis","exitsDifferent","exitsSame","exitsUnknown","exitsDifferentDetail","exitsSameDetail","exitsUnknownDetail","routingUnavailable","routingMultiple","routingObserved","routingNoSites","routingDetail","timezoneAligned","timezoneCross","timezoneAlignedDetail","timezoneCrossDetail","networkResidential","networkDatacenter","networkMobile","networkPublic","networkConflict","networkResidentialDetail","networkDatacenterDetail","networkMobileDetail","networkPublicDetail","networkConflictDetail","reputationHigh","reputationGood","reputationWatch","reputationLow","reputationDetail","languageLabel","languageDetail"] as const;
const comboKeys = ["balancedHigh","balancedGood","balancedWatch","balancedLow","multiHigh","multiGood","multiWatch","multiLow","dualHigh","dualGood","dualWatch","dualLow","sameHigh","sameGood","sameWatch","sameLow"] as const;
const descriptions = ['balanced', 'multi', 'dual', 'same'] as const;

export function getPassportText(locale: string) {
  const get = (key: string) => t(key, [], locale as Locale);
  const ui = Object.fromEntries(uiKeys.map(key => [key, get('ui.' + key)])) as Record<(typeof uiKeys)[number], string>;
  const traveler = Object.fromEntries(travelerKeys.map(key => [key, get('traveler.' + key)])) as Record<(typeof travelerKeys)[number], string>;
  const comboTitles = Object.fromEntries(comboKeys.map(key => [key, get('traveler.' + key)])) as Record<(typeof comboKeys)[number], string>;
  const comboDescriptions = Object.fromEntries(descriptions.map(key => [key, get('traveler.' + key + 'Description')])) as Record<(typeof descriptions)[number], string>;
  return { ui, traveler: { ...traveler, comboTitles, comboDescriptions } };
}

export function passportFormat(template: string, values: Record<string, string | number>) {
  return template.replace(/\{([a-zA-Z][a-zA-Z0-9]*)\}/g, (_, key: string) => String(values[key]));
}
