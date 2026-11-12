// SvelteKit prerenders a per-page script hash in a meta CSP. Cloudflare's
// JavaScript Detections needs a per-response nonce in an HTTP CSP header.
export async function documentResponse(response, method) {
  if (
    !response.ok ||
    !response.headers.get("Content-Type")?.startsWith("text/html")
  ) {
    return method === "HEAD" ? new Response(null, response) : response;
  }

  const html = await response.text();
  const meta = html.match(
    /<meta http-equiv="content-security-policy" content="([^"]+)">/i,
  );
  if (!meta) throw new Error("Prerendered HTML is missing its CSP meta tag");
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const nonce = btoa(String.fromCharCode(...bytes));
  const policy = meta[1].replace(
    /\bscript-src\s+([^;]+)/,
    `script-src $1 'nonce-${nonce}'`,
  );
  if (policy === meta[1])
    throw new Error("Prerendered CSP is missing script-src");

  const headers = new Headers(response.headers);
  const existing = headers.get("Content-Security-Policy");
  headers.set(
    "Content-Security-Policy",
    existing ? `${existing}; ${policy}` : policy,
  );
  headers.set("Cache-Control", "private, no-store");
  for (const name of [
    "Content-Length",
    "Content-Encoding",
    "Content-Range",
    "Accept-Ranges",
    "ETag",
    "Last-Modified",
  ])
    headers.delete(name);
  return new Response(method === "HEAD" ? null : html.replace(meta[0], ""), {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
