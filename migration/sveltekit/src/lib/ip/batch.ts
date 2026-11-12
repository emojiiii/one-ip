import { normalizeIp } from "./ip-address";

export function parseBatchInput(input: string) {
  const ips: string[] = [];
  const invalid: string[] = [];
  for (const item of input.split(/[\s,;，；]+/).filter(Boolean)) {
    const ip = normalizeIp(item);
    if (!ip) invalid.push(item);
    else if (!ips.includes(ip)) ips.push(ip);
  }
  return { ips, invalid, tooMany: ips.length > 10 };
}

export function toCsv(headers: string[], rows: string[][]) {
  const cell = (value: string) => {
    const safe = /^[\s]*[=+\-@\t\r]/.test(value) ? `'${value}` : value;
    return `"${safe.replaceAll('"', '""')}"`;
  };
  return [headers, ...rows].map((row) => row.map(cell).join(",")).join("\r\n");
}
