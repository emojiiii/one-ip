# Deployment and configuration

[Back to README](../README.en.md) · [中文](deploy.md)

## Deploy with Cloudflare Workers Git integration

1. In **Workers & Pages**, create a Worker and import your Git repository. You can use your own repository or fork this project first. [Cloudflare dashboard](https://dash.cloudflare.com/) · [Fork this project](https://github.com/emojiiii/one-ip/fork)
2. Select a production branch such as `main`. The Worker's name in the dashboard must match `name` in the root `wrangler.toml`, which defaults to `one-ip`. [Worker name requirement](https://developers.cloudflare.com/workers/ci-cd/builds/troubleshoot/#workers-name-requirement)
3. Use the repository root as the root directory, `pnpm build` as the build command and `pnpm run deploy` as the deploy command. The repository specifies Node.js 24 and pnpm 10.32.1. [Workers Builds settings](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/)
4. After the first deployment, verify it at the assigned `workers.dev` address. In the Worker settings, use **Domains & Routes → Add → Custom Domain** to bind `ip.kitt.tools` or your site's domain. [Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)

Workers Builds builds and deploys commits on the connected production branch. The root `wrangler.toml` deploys `worker/index.js` and the static assets in `dist` together. Core features require no application environment variables or API keys. See “Verification” for Turnstile setup.

For map access from mainland China, configure `TIANDITU_TOKEN` under Worker → Settings → Variables and Secrets (or run `pnpm exec wrangler secret put TIANDITU_TOKEN`). Maps prefer Tianditu and fall back to OpenStreetMap when unavailable; without the token, OpenStreetMap remains the default.

The default map requires no account or API key. OpenStreetMap's public tiles are subject to its [usage policy](https://operations.osmfoundation.org/policies/tiles/): keep attribution visible, load tiles on demand, respect browser caching, and do not offer offline downloads or bulk prefetching. Availability is not guaranteed. Tile requests send only this site's origin as the Referer, excluding page paths containing queried IPs. Failed maps can be retried independently while location text and coordinates remain available.

## Language URLs and SEO

Unprefixed paths such as `/status` default to English. Each public page has static HTML for English (`/en`), Simplified Chinese (`/zh`), Latin American Spanish (`/es`), Brazilian Portuguese (`/pt-br`), French (`/fr`), German (`/de`), Japanese (`/ja`), Korean (`/ko`), Arabic (`/ar`), and Hindi (`/hi`). Results for individual IP addresses load in the browser.

Production builds use `https://ip.kitt.tools` by default for canonical URLs, hreflang and the sitemap. To deploy to another domain, set the build variable `VITE_SITE_ORIGIN` under the Worker's **Settings → Build**. For Docker Compose, set the environment variable of the same name. For `docker build`, use `--build-arg VITE_SITE_ORIGIN=https://ip.example.com`.

`/robots.txt` advertises the absolute URL of `/sitemap.xml`. The sitemap lists the public canonical URLs and hreflang alternates for all 10 languages. English canonicals use `/en` paths, and `x-default` points to the unprefixed path.

## Docker deployment

The image includes the frontend and a standalone Node.js API server. The Compose configuration requires Docker Compose 2.24 or later. The multi-stage build copies only static assets, the bundled server and license into the runtime image, which runs as a non-root user.

```bash
# Optional map and verification settings; edit the file if it already exists
cp .env.docker.example .env.docker
docker compose up -d --build
```

Open `http://your-server:8080`. Override the host port with `PORT=8088 docker compose up -d --build`. To build and run manually:

```bash
docker build -t one-ip:local .
docker run -d --name one-ip --restart unless-stopped -p 8080:8080 --env-file .env.docker one-ip:local
```

Settings are read when the container starts and are never embedded in the frontend. Apply changes with `docker compose up -d --force-recreate`. The `/healthz` endpoint checks container health without an external provider. To run the same server without Docker, use `pnpm build:docker` followed by `pnpm start`.

Use an HTTPS reverse proxy in production; some browser diagnostics require a secure context. By default, the server uses the socket address and ignores client-supplied `CF-Connecting-IP` and forwarded identity. When using a proxy, list its immediate IP or dedicated CIDR in `.env.docker` as `TRUSTED_PROXIES`, comma-separated. For a proxy on the same host, bind locally with `BIND_ADDRESS=127.0.0.1 docker compose up -d --build`, then allow the proxy address actually seen by the container. Example Nginx location:

```nginx
location / {
    proxy_pass http://127.0.0.1:8080;
    proxy_set_header Host $http_host;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

The proxy must overwrite forwarded headers. The server trusts only the rightmost client address supplied by an allowlisted proxy; resolve real client identity at the ingress for multi-proxy setups. If an allowlisted proxy omits `X-Forwarded-For`, the server logs `proxy_missing_client_ip` once.

Set `PUBLIC_ORIGIN` to the address visitors use, such as `https://ip.example.com`. Same-origin checks and challenge hostnames then use it instead of relying on `X-Forwarded-Proto`. It is required when the HTTPS proxy is not allowlisted; otherwise Ping and challenge POST requests fail the same-origin check.

When Docker sits behind the Cloudflare proxy, set `TRUST_CF_CONNECTING_IP=true` to read the visitor from `CF-Connecting-IP` relayed by an allowlisted proxy. The allowlist must contain [Cloudflare IP ranges](https://www.cloudflare.com/ips/) or a proxy that accepts only Cloudflare traffic; the header is discarded from any other source.

Docker geolocation uses public providers and does not present private socket addresses as public egress. Missing Cloudflare JA3/JA4/TLS metadata remains null. Docker replaces the Cloudflare edge cache with an in-process cache (1000 entries, 32 MB) that honours each endpoint's TTL and clears on restart.

Cloudflare Workers uses native rate limiting. Docker limits ordinary and icon requests separately to 180 per minute and POST requests to five per minute, counting each IPv6 /64 as one client. Each instance keeps its own counts in memory and resets them on restart.

## Verification (optional)

Provide a Turnstile Site Key, Secret and allowed hostname. New Ping measurements require configured Turnstile (managed or Non-interactive), alongside the existing five-request-per-minute limit. Each batch uses a fresh token; the server validates its `ping_start` action, hostname and validity, and rejects measurements when verification is unconfigured. WebMCP calls also show the verification dialog.

| Provider  | Settings                                                        |
| --------- | --------------------------------------------------------------- |
| Turnstile | `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET`, `TURNSTILE_HOSTNAMES` |

For local development, copy the [configuration example](config/challenges.env.example) to `.dev.vars` in the project root, fill in your keys and restart. Edit the existing file if present. Use comma-separated hostnames such as `example.com`, and allow those hostnames in the provider's console.

For production, enter the settings under Worker → Settings → Variables and Secrets, or run `pnpm exec wrangler secret put NAME`. To use a configuration file, copy `.secrets.example` to `.secrets.production.env`, fill it in and run:

```bash
node scripts/sync-worker-secrets.mjs production --check
node scripts/sync-worker-secrets.mjs production
```

The script uploads non-empty values, preserves existing secrets and skips missing optional files. Use `.env.docker` for Docker. Sensitive files are in the Git ignore list. Store secrets in server settings, not `VITE_*` variables. Check the `configured` fields at `/api/browser/challenges` to inspect the setup.

## Update your fork

Click **Sync fork → Update branch** on your GitHub repository page. Review differences if you have code changes, and resolve merge conflicts.

For scheduled updates, enable `Sync upstream`:

1. Enable workflows in your fork's Actions tab.
2. Under Settings → Secrets and variables → Actions → **Variables**, add `AUTO_SYNC_UPSTREAM=true`.
3. The workflow checks for updates at 04:23 UTC each day. You can run it from the Actions page.

The workflow uses GitHub's `merge-upstream` API to merge updates from the upstream repository GitHub associates with the fork into its default branch. It requires no personal access token, stops on conflicts and preserves your commits. Use GitHub's Sync fork if you want to review updates.

- The sync workflow updates the fork. With the production branch connected, check Cloudflare's build history for deployments of synchronized commits.
- If branch protection blocks a merge, use a PR.
- Enable scheduled workflows in your fork. GitHub may disable schedules after 60 days of inactivity in a public repository; use the Actions page to enable them.

[Syncing a fork](https://docs.github.com/en/pull-requests/how-tos/work-with-forks/syncing-a-fork) · [Workflow disabling rules](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/disable-and-enable-workflows)

## WebMCP

In browsers with native `document.modelContext`, the site registers structured tools for IP and WHOIS lookups, network and AI checks, service status, and browser diagnostics. `one_ip_catalog` lists supported sites, platforms and pages; `one_ip_open_page` opens the interactive permission page. Tools reuse the site's existing sources and request limits, and support cancellation. Browsers without WebMCP continue to use the normal UI.

WebMCP is experimental. For local testing, enable `chrome://flags/#enable-webmcp-testing` and inspect `await document.modelContext.getTools()`. Live Chrome use requires the [WebMCP Origin Trial](https://developer.chrome.com/docs/ai/webmcp/) or later native support; this repository does not include an origin trial token. Tools are exposed only to the current same-origin page, with no cross-origin iframe delegation. Results can contain third-party content; users should decide whether to share browser fingerprints, egress IPs or WebRTC results with an agent.
