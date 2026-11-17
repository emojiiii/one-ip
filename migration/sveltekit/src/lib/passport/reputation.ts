export async function passportReputation(ip: string, signal: AbortSignal) {
  const { lookupIp } = await import('../ip/lookup');
  const { coffee, fallback } = await lookupIp(ip, AbortSignal.any([signal, AbortSignal.timeout(5000)]));
  if (fallback) return {};

  const score = coffee.trust_score;
  const reputationScore = score != null && Number.isFinite(score) && score >= 0 && score <= 100 ? score : undefined;
  const exitType = coffee.is_public_service ? 'public-service'
    : coffee.isResidential && coffee.is_datacenter ? 'conflict'
      : coffee.is_mobile ? 'mobile'
        : coffee.isResidential ? 'residential'
          : coffee.is_datacenter ? 'datacenter'
            : undefined;
  return { reputationScore, exitType, reputationSource: 'Net.Coffee' } as const;
}
