import { z } from "zod";

export const dnsTypes = ["A", "AAAA", "CNAME", "MX", "TXT"] as const;
export type DnsType = (typeof dnsTypes)[number];
export type DnsProvider = "cloudflare" | "google";

const responseSchema = z.object({
  Status: z.number().int().nonnegative(),
  TC: z.boolean().optional(),
  Answer: z
    .array(
      z.object({
        name: z.string(),
        type: z.number().int().nonnegative(),
        TTL: z.number().int().nonnegative(),
        data: z.string(),
      }),
    )
    .optional(),
});

export type DnsAnswer = {
  name: string;
  type: number;
  ttl: number;
  data: string;
};
export type DnsResult = {
  status: number;
  answers: DnsAnswer[];
  truncated: boolean;
  checkedAt: number;
};

export function normalizeDomain(value: string): string | null {
  const input = value.trim().replace(/\.$/, "");
  if (!input || /[\s/:?#@\\]/u.test(input)) return null;
  try {
    const hostname = new URL(`https://${input}`).hostname.toLowerCase();
    if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname)) return null;
    const labels = hostname.split(".");
    if (
      hostname.length > 253 ||
      labels.some(
        (label) =>
          !label ||
          label.length > 63 ||
          !/^[a-z0-9_](?:[a-z0-9_-]*[a-z0-9_])?$/i.test(label),
      )
    )
      return null;
    return hostname;
  } catch {
    return null;
  }
}

export async function queryDns(
  domain: string,
  provider: DnsProvider,
  type: DnsType,
  signal: AbortSignal,
): Promise<DnsResult> {
  const url = new URL(
    provider === "cloudflare"
      ? "https://cloudflare-dns.com/dns-query"
      : "https://dns.google/resolve",
  );
  url.searchParams.set("name", domain);
  url.searchParams.set("type", type);
  const response = await fetch(url, {
    headers: { Accept: "application/dns-json" },
    credentials: "omit",
    cache: "no-store",
    referrerPolicy: "no-referrer",
    signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]),
  });
  if (!response.ok)
    throw new Error(`DNS request failed: HTTP ${response.status}`);
  const data = responseSchema.parse(await response.json());
  return {
    status: data.Status,
    truncated: data.TC === true,
    answers: (data.Answer ?? []).map((answer) => ({
      name: answer.name,
      type: answer.type,
      ttl: answer.TTL,
      data: answer.data,
    })),
    checkedAt: Date.now(),
  };
}
