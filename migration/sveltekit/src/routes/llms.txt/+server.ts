import { localizedPath } from "../../lib/i18n";
import { siteOrigin } from "../../lib/seo";
import type { RequestHandler } from "./$types";

export const prerender = true;

export const GET: RequestHandler = ({ url }) => {
  const origin = siteOrigin ?? url.origin;
  const link = (path: string) => new URL(localizedPath(path, "zh-CN"), origin).href;
  const text = `# One IP

> One IP 是用于 IP 查询、网络诊断、浏览器检测和服务状态查询的工具箱。

检测结果依赖浏览器、网络环境和第三方数据源，仅供排查参考。

## 工具

- [网络概览](${link("/")}): 查看当前出口 IP、网络连通性和服务状态。
- [IP 查询](${link("/ip")}): 查询 IP 地址的归属地、运营商等信息。
- [DNS 记录](${link("/dns-records")}): 对照查询 DNS 记录。
- [DNS 泄漏检测](${link("/leak/dns")}): 检查 DNS 解析出口。
- [WebRTC 泄漏检测](${link("/leak/webrtc")}): 检查 WebRTC 地址和网络出口。
- [网站解锁检测](${link("/unlock/sites")}): 查看网站连通性及分流出口。
- [全球 Ping](${link("/ping")}): 从全球探针测试网络连通性。
- [服务状态](${link("/status")}): 查看服务提供商公布的状态。

## 其他

- [隐私政策](${link("/privacy")}): 数据处理与联系方式。
- [使用条款](${link("/terms")}): 服务范围和使用要求。
- [源代码](https://github.com/emojiiii/one-ip): 项目说明、数据来源和问题反馈。
`;
  return new Response(text, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
};
