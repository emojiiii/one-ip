# SvelteKit 前端

此目录包含 SvelteKit 前端；项目依赖由仓库根目录的 pnpm 管理，构建产物输出到根目录 `dist`。

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm worker:dev
```

以上命令在仓库根目录执行。`worker:dev` 会同时启动前端开发服务器和本地 Worker。静态 HTML 在构建时生成，当前 IP 等访客数据在浏览器端请求。页面语言由 URL 路径决定，无语言前缀的地址默认显示英语。

页面渲染方式及迁移约束见 [渲染分析](../../docs/sveltekit-migration.md)。
