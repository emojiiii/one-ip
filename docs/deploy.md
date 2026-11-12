# 部署与配置

[返回 README](../README.md) · [English](deploy.en.md)

## Cloudflare Workers Git 部署

1. 在 Cloudflare 控制台的 **Workers & Pages** 创建 Worker 并导入 Git 仓库。使用自己的仓库，或先 Fork 本项目。[Cloudflare 控制台](https://dash.cloudflare.com/) · [Fork 本项目](https://github.com/emojiiii/one-ip/fork)
2. 选择生产分支，例如 `main`。控制台中的 Worker 名称应与根目录 `wrangler.toml` 的 `name` 一致，默认是 `one-ip`。[Worker 名称要求](https://developers.cloudflare.com/workers/ci-cd/builds/troubleshoot/#workers-name-requirement)
3. 根目录使用仓库根目录。构建命令填 `pnpm build`，部署命令填 `pnpm run deploy`。仓库配置指定 Node.js 24 和 pnpm 10.32.1。[Workers Builds 设置](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/)
4. 完成首次部署后，可用 `workers.dev` 地址验证。在 Worker 的 **Settings → Domains & Routes → Add → Custom Domain** 绑定 `ip.kitt.tools` 或你的站点域名。[自定义域名](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)

Workers Builds 处理所连接生产分支的构建和发布。根目录的 `wrangler.toml` 将 `worker/index.js` 与 `dist` 静态资源部署到同一个 Worker。基础功能无需应用环境变量或 API Key。Turnstile 的配置见“验证体验”。

国内网络访问地图时，建议在 Worker → Settings → Variables and Secrets 配置 `TIANDITU_TOKEN`（也可以用 `pnpm exec wrangler secret put TIANDITU_TOKEN`）。配置后地图优先使用天地图，失败时回退到 OpenStreetMap；未配置时保持 OpenStreetMap。

默认地图无需注册或 API Key。OpenStreetMap 公共瓦片须遵守[使用政策](https://operations.osmfoundation.org/policies/tiles/)，保留地图署名、按需加载并使用浏览器缓存，不提供离线下载或批量预取；公共服务不保证可用性。瓦片请求仅发送本站 origin 作为 Referer，不包含查询 IP 的页面路径。地图加载失败时可单独重试，位置文字和坐标仍可查看。

## 多语言与 SEO

无语言前缀的地址默认显示英语，例如 `/status`。公开页面为以下语言前缀生成静态 HTML，具体 IP 的查询结果在浏览器加载。

| 前缀 | 语言 |
| --- | --- |
| `/en` | 英语 |
| `/zh` | 简体中文 |
| `/es` | 拉美西班牙语 |
| `/pt-br` | 巴西葡萄牙语 |
| `/fr` | 法语 |
| `/de` | 德语 |
| `/ja` | 日语 |
| `/ko` | 韩语 |
| `/ar` | 阿拉伯语 |
| `/hi` | 印地语 |

生产构建默认使用 `https://ip.kitt.tools` 生成 canonical、hreflang 和站点地图。部署到其他域名时，在 Worker 的 **Settings → Build** 中设置构建变量 `VITE_SITE_ORIGIN`。Docker Compose 使用同名环境变量，`docker build` 使用 `--build-arg VITE_SITE_ORIGIN=https://ip.example.com`。

`/robots.txt` 声明 `/sitemap.xml` 的完整地址。站点地图列出 10 种语言的公开 canonical 地址和对应的 hreflang。每个英文页面的 canonical 使用 `/en` 地址，`x-default` 指向无前缀地址。

## Docker 部署

Docker 镜像包含前端和 Node.js API 服务，可独立运行，不需要另设 Worker。Compose 配置需要 Docker Compose 2.24 或更新版本。多阶段构建只将静态资源、API 服务和许可证放入运行镜像，默认使用非 root 用户。

```bash
# 可选：填写地图和验证服务配置，已有文件请直接编辑
cp .env.docker.example .env.docker
docker compose up -d --build
```

打开 `http://服务器地址:8080`。宿主机端口可通过 `PORT=8088 docker compose up -d --build` 修改。也可以手动构建和运行：

```bash
docker build -t one-ip:local .
docker run -d --name one-ip --restart unless-stopped -p 8080:8080 --env-file .env.docker one-ip:local
```

环境变量在容器启动时读取，修改后执行 `docker compose up -d --force-recreate`；密钥不会编译进前端。`/healthz` 是容器健康检查入口，不依赖外部数据源。本机直接运行同一服务可用 `pnpm build:docker` 后执行 `pnpm start`。

生产环境建议在前方配置 HTTPS 反向代理，浏览器部分检测需要安全上下文。默认使用 TCP 连接地址，不信任请求中自带的 `CF-Connecting-IP` 或转发头。使用代理时，在 `.env.docker` 的 `TRUSTED_PROXIES` 中填写紧邻容器的代理 IP 或专用 CIDR，多个值用逗号分隔。以下 Nginx 示例用于同机代理；同时用 `BIND_ADDRESS=127.0.0.1 docker compose up -d --build` 限制端口仅在本机监听，并按容器实际看到的代理地址配置白名单：

```nginx
location / {
    proxy_pass http://127.0.0.1:8080;
    proxy_set_header Host $http_host;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

代理须覆盖转发头。服务仅信任白名单代理提供的最后一跳访客地址；多层代理需在入口完成真实 IP 解析。白名单代理没有传 `X-Forwarded-For` 时，日志会输出一次 `proxy_missing_client_ip`。

`PUBLIC_ORIGIN` 填写访客实际使用的地址（如 `https://ip.example.com`）。设置后，同源校验和人机验证域名都以它为准，不再依赖代理传 `X-Forwarded-Proto`。HTTPS 代理不在白名单中时，必须设置此项，否则 Ping 和人机验证的 POST 请求会被同源校验拒绝。

Docker 前面套 Cloudflare 代理时，可设置 `TRUST_CF_CONNECTING_IP=true`，从白名单代理转发的 `CF-Connecting-IP` 读取访客地址。白名单须为 [Cloudflare IP 段](https://www.cloudflare.com/ips/)，或只接受 Cloudflare 回源流量的代理；其他来源带的此请求头会被丢弃。

Docker 访客归属地使用公开数据源；私网连接地址不会当作公网出口。Docker 缺少 Cloudflare 的 JA3/JA4/TLS 元数据时返回空值。Docker 用进程内缓存替代 Cloudflare 边缘缓存，最多 1000 条、32 MB，按接口原有的 TTL 过期，重启后清空。

Workers 使用原生限流。Docker 使用每个实例内的内存限流（普通查询和图标各 180 次/分钟，POST 5 次/分钟），IPv6 按 /64 计数，重启会重置，多个实例不共享计数。

## 验证体验（可选）

为 Turnstile 填写 Site Key、Secret 和允许访问的域名。发起新的 Ping 测量必须配置 Turnstile（普通或 Non-interactive），保留每分钟 5 次限流；每个批次使用独立 token，服务端校验 `ping_start` action、hostname 和凭证有效性，未配置时拒绝发起测量。WebMCP 调用同样需要完成弹出的人机校验。

| 提供商    | 配置项                                                          |
| --------- | --------------------------------------------------------------- |
| Turnstile | `TURNSTILE_SITE_KEY`、`TURNSTILE_SECRET`、`TURNSTILE_HOSTNAMES` |

本地开发：把[配置示例](config/challenges.env.example)复制到根目录 `.dev.vars`，填写密钥并重启。文件存在时编辑原文件。域名用逗号分隔，填写格式为 `example.com`，提供商控制台需要允许对应域名。

线上部署：在 Worker → Settings → Variables and Secrets 填写配置，或执行 `pnpm exec wrangler secret put 名称`。使用配置文件时，把 `.secrets.example` 复制为 `.secrets.production.env`，填写后运行：

```bash
node scripts/sync-worker-secrets.mjs production --check
node scripts/sync-worker-secrets.mjs production
```

脚本上传非空项，保留已有 Secret，跳过缺失的可选文件。Docker 使用 `.env.docker`。敏感文件在 Git 忽略列表中。Secret 应放在服务端配置中，不能放进 `VITE_*`。`/api/browser/challenges` 的 `configured` 字段用于检查配置结果。

## Fork 更新

在 GitHub 仓库页面点击 **Sync fork → Update branch**。有代码改动时检查差异，通过合并处理冲突。

定时同步使用 `Sync upstream` 工作流：

1. 在 Fork 的 Actions 页面启用工作流。
2. 在 Settings → Secrets and variables → Actions → **Variables** 添加 `AUTO_SYNC_UPSTREAM=true`。
3. 工作流在每天 UTC 04:23 检查更新。Actions 页面提供运行入口。

工作流使用 GitHub 的 `merge-upstream` 接口，将 GitHub 为当前 Fork 关联的上游更新合并到默认分支，无需个人访问令牌（PAT）。遇到冲突时停止，保留你的提交。需要审核更新时，使用 GitHub 的 Sync fork。

- 同步工作流只更新 Fork。连接生产分支后，可在 Cloudflare 的构建历史中检查同步提交的部署记录。
- 分支保护阻止合并时，通过 PR 处理。
- Fork 的定时工作流需要启用。公开仓库 60 天无活动可能导致 GitHub 停用定时任务，恢复入口在 Actions 页面。

[同步 Fork](https://docs.github.com/en/pull-requests/how-tos/work-with-forks/syncing-a-fork) · [定时工作流停用规则](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/disable-and-enable-workflows)

## WebMCP

支持浏览器原生 WebMCP：在提供 `document.modelContext` 的浏览器中，页面会注册结构化工具，覆盖 IP / WHOIS 查询、网络与 AI 检测、服务状态及浏览器诊断。`one_ip_catalog` 可列出支持的站点、平台和页面；`one_ip_open_page` 可导航到需要用户操作的权限页面。工具使用现有数据源和请求限制，支持取消；不支持 WebMCP 的浏览器仍可正常使用网页。

WebMCP 仍处于实验阶段。本地可在 Chrome 开启 `chrome://flags/#enable-webmcp-testing` 后检查 `await document.modelContext.getTools()`；线上 Chrome 访问需要参与 [WebMCP Origin Trial](https://developer.chrome.com/docs/ai/webmcp/) 或等待浏览器正式支持。本站没有内置试验令牌。工具只在当前页面同源暴露，不向跨源 iframe 授权。查询结果可能包含第三方数据；浏览器指纹、出口 IP 和 WebRTC 结果可能涉及隐私，调用前应由用户决定是否交给代理处理。

## 人机校验与 Claude 环境对照

可选的第二个 Turnstile 组件使用 `TURNSTILE_NONINTERACTIVE_SITE_KEY`、`TURNSTILE_NONINTERACTIVE_SECRET` 和 `TURNSTILE_NONINTERACTIVE_HOSTNAMES`，并须在 Cloudflare 中选择 **Non-interactive** 模式；未配置时不显示。

Claude 页面比较 `claude.ai` 与 `claude.com` 出口，并检查 DNS、WebRTC、语言、时区及浏览器特征。检测字典参考 [FuckClaude](https://github.com/LinXiaoTao/FuckClaude)，许可证和来源说明见 `vendor/claude-environment/`。

以上结果仅用于环境排查，不代表 Claude 官方判定、账号风险或封禁概率；页面不读取本机 Claude Code 配置，也不展示 Cloudflare 企业版 Bot Management 分数。

社区友链：[LINUX DO](https://linux.do/) · 真诚、友善、团结、专业。
