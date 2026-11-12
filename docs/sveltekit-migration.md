# SvelteKit 迁移与渲染方式

## 渲染选择

预渲染只生成所有访客共享的页面结构。诊断数据在浏览器加载后取得，不能在构建时写入访客数据；这同时保留浏览器网络出口和设备环境的测量语义。

| 路由 | 建议 | 访客数据 |
| --- | --- | --- |
| `/terms`、`/privacy` | 完整预渲染 | 无 |
| `/`、`/ip`、`/whois` | 预渲染页面外壳 | IP、地理信息、查询结果由浏览器获取 |
| `/leak/dns`、`/leak/webrtc` | 预渲染页面外壳 | DNS 和 WebRTC 检测在浏览器运行 |
| `/unlock/sites`、`/unlock/gpt`、`/unlock/claude` | 预渲染页面外壳 | 连通性与解锁检测在浏览器运行 |
| `/speedtest`、`/ping`、`/status` | 预渲染页面外壳 | 测速、Ping、状态在访问时获取 |
| `/browser/environment`、`/browser/fingerprint`、`/browser/checks`、`/browser/privacy` | 预渲染页面外壳 | 浏览器环境、权限及指纹在浏览器读取 |
| `/ip/:ip` | 动态路径回退或运行时渲染公共外壳 | 指定 IP 的结果在访问时获取 |

目前没有必须动态 SSR 的页面。如果未来要求搜索引擎索引每个 IP 的查询结果，或要求服务端在首屏填充实时数据，再单独评估动态 SSR。包含访客 IP 等个性化数据的 HTML 不应使用共享缓存。

## 实施约束

- 现有 API 继续由 Worker 提供，迁移时保留接口路径、限流和缓存语义。
- `/ip/:ip` 参数不能穷举预渲染；必须验证直接访问、刷新及旧地址重定向，不能只验证站内跳转。
- 页面语言由 URL 路径决定。无前缀和 `/zh` 使用简体中文，`/en` 使用英语。预渲染和浏览器翻译使用同一语言。前缀列表见[部署文档](deploy.md#多语言与-seo)。
- 发布前验证 Cloudflare Worker 和独立 Docker 服务的静态资源及路由回退行为。
- 对比同环境下首页和工具页的 FCP、LCP、传输 JavaScript 体积、可交互时间与诊断完成时间。框架更换和静态 HTML 不能单独证明实际提速。

## 翻译词表

`migration/sveltekit/src/i18n/<语言>/<功能>.json` 保存页面和诊断文案。SvelteKit 在渲染前按 URL 加载当前语言的词表，`messageCatalog` 通过 i18next 按功能查找文案。`tests/i18n.test.mjs` 检查 10 种语言的词条和插值参数一致。

## 部署切换

前端使用静态适配器，构建将预渲染 HTML 和 `200.html` 回退页写入根目录 `dist`。Workers 配置使用 `assets.not_found_handling = "none"` 和 `run_worker_first = true`。Worker 先尝试静态资源；未命中的页面路径转交 `200.html`，缺失脚本等文件仍返回 404。

Workers Builds 从 Git 仓库根目录运行 `pnpm build` 和 `pnpm run deploy`，根据 `wrangler.toml` 发布 Worker 与静态资源。Docker 静态服务采用同一回退规则。两种部署都要验证普通预渲染页面、IPv4 和 IPv6 参数路径、旧 `.html` 页面、缺失资源以及 API。

SvelteKit 对每个预渲染页面生成包含内联脚本哈希的 CSP meta 标签；`_headers` 单独保留不能通过 meta 生效的 `frame-ancestors` 及其他响应头。不要复制旧 React 首页固定脚本哈希，否则会阻止 Svelte 页面水合。

根目录的 pnpm 锁文件统一管理前端与 Worker 依赖。Workers Builds 和 Docker 都使用 `pnpm build` 生成静态资源。
