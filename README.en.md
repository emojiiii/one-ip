# <img src="migration/sveltekit/static/icon.svg" alt="One IP Logo" width="32" height="32" /> One IP

<p align="left">
  <img src="https://img.shields.io/badge/SvelteKit-3-FF3E00?logo=svelte&amp;logoColor=white" alt="SvelteKit 3" />
  <img src="https://img.shields.io/badge/Svelte-5-FF3E00?logo=svelte&amp;logoColor=white" alt="Svelte 5" />
  <img src="https://img.shields.io/badge/Vite-8-646CFF?logo=vite&amp;logoColor=white" alt="Vite 8" />
  <img src="https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&amp;logoColor=white" alt="TypeScript 6" />
  <img src="https://img.shields.io/badge/Cloudflare_Workers-F38020?logo=cloudflareworkers&amp;logoColor=white" alt="Cloudflare Workers" />
</p>

A toolbox for IP lookups, network diagnostics, browser checks and AI service status.

[中文](README.md) · **English**

[Live demo](https://ip.kitt.tools/) · [GitHub](https://github.com/emojiiii/one-ip)

![Desktop overview, redacted](docs/screenshots/desktop-home-redacted.png)

<table>
  <tr><th>Mobile · Light</th><th>Mobile · Dark</th></tr>
  <tr>
    <td><img src="docs/screenshots/mobile-home-light-redacted.png" alt="Redacted mobile light overview" width="360" /></td>
    <td><img src="docs/screenshots/mobile-home-dark-redacted.png" alt="Redacted mobile dark overview" width="360" /></td>
  </tr>
</table>

## Features

- **Current IP (home)**: IPv4 / IPv6 location, ISP, ASN, reputation score and maps; IP checks open in a new tab
- **Batch IP comparison**: compare up to 10 addresses, add the current egress, name and filter results, and export CSV with sources and unknown values
- **DNS record comparison**: compare A, AAAA, CNAME, MX and TXT records and their TTLs across Cloudflare and Google
- **Leak test**: DNS leaks and WebRTC leaks
- **Network unlock**: reachability and routed egress for AI, streaming and regional sites, plus ChatGPT and Claude diagnostics
- **Speed test**: download, upload and latency over Cloudflare's edge network
- **More tools**: WHOIS, global Ping, browser fingerprint and consistency checks, service status
- Chinese / English, light / dark themes, mobile layouts; native browser [WebMCP](https://developer.chrome.com/docs/ai/webmcp/) tools

Results rely on third-party services and may be affected by rate limits or CORS. IP classifications and scores are for reference only.

## Deploy

Create a Worker in Cloudflare and connect your Git repository directly. Use `pnpm build` as the build command and `pnpm run deploy` as the deploy command. Core features need no API keys.

Self-host with Docker:

```bash
cp .env.docker.example .env.docker   # optional settings
docker compose up -d --build         # open http://your-server:8080
```

Worker domains, reverse proxies, Tianditu maps, human verification and fork syncing are covered in [Deployment and configuration](docs/deploy.en.md).

## Local development

```bash
pnpm install --frozen-lockfile
pnpm worker:dev   # http://127.0.0.1:8787
pnpm build && pnpm test && pnpm lint
```

## Data sources

Net.Coffee, ip-api, Globalping, IANA / RDAP and official platform status feeds. Browser checks use FingerprintJS and CreepJS (see [vendor/browser-diagnostics](vendor/browser-diagnostics/README.md)); the Claude environment dictionary is based on [FuckClaude](https://github.com/LinXiaoTao/FuckClaude) (see `vendor/claude-environment/`). Results are for troubleshooting only and are not official decisions by any platform.

Issues are welcome. Redact IPs, locations and fingerprint identifiers before sharing screenshots.

## Origin and license

This project is based on and modified from [zhihui-hu/one-ip](https://github.com/zhihui-hu/one-ip) and is licensed under the [GNU AGPL-3.0](LICENSE). See the Git commit history for changes and their dates.

## Contact

[ip@kitt.tools](mailto:ip@kitt.tools)

## Star History

<a href="https://www.star-history.com/?repos=emojiiii%2Fone-ip&amp;type=date">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=emojiiii/one-ip&amp;type=Date&amp;theme=dark" />
    <img src="https://api.star-history.com/svg?repos=emojiiii/one-ip&amp;type=Date" alt="One IP GitHub star history" width="640" />
  </picture>
</a>
