# 0.7.0 — 个人 Mac Lite 包

2026-09-09。仅本机个人使用安装包，未公开发布。

- 默认使用 sqlite-vec 检索，原始向量保留；更新按变化 ID 同步。
- HTTP Gateway 增加 MCP 2026-07-28 核心，旧 HTTP/stdio 客户端继续可用。
- 沿用日用数据目录、正常后台调度和稳定 Gateway 端口，不需要试用启动脚本。

验证：真实副本新旧引擎对照、实际 embedding 自然语言查询、Node/CLI 搜索与恢复、
官方 SDK 2.0.0、协议边界及背压。签名/公证与最终包验证以打包完成记录为准。

边界：50k 首次建索引仍慢，完整性能矩阵、Windows、Claude/Hermes B3 未验收。
个人小库安装授权不等于上述范围已通过。可用环境变量
CLARACORE_DESKTOP_VECTOR_ENGINE=legacy 明确回到旧检索引擎。

安装前备份已保存至本机 claracore-desktop-backups/pre-0.7.0-20260909-085301.db；
SQLite quick_check 通过，记忆、embedding、schema_migrations 与只读源快照逐行一致。
默认切换后的关键词优先/10 条上限/0.55 阈值已用真实向量 fixture 验证新旧引擎；
本轮自然语言样本未作人工相关性评判。

## 打包完成

Mac arm64 Lite DMG：`dist-lite/ClaraCore-Desktop-0.7.0-lite-arm64.dmg`，126832795 bytes。
SHA-256：`e8ce68bf4d6b588e40e175278d6140f4e25004776b007e5ad86605ecda6a20e5`。
App 与 DMG Developer ID 签名、Apple 公证、staple 与 Gatekeeper 验证通过。
DMG submission：f72ff20b-e55e-41e4-a8d2-cf43a4358fbd（Accepted）。
签名包内 Node/CLI 向量加载、现代 SDK HTTP 测试、Lite 资源验证通过。
HCT-2026-09-08-01/02：默认切换后真实 fixture 验证关键词优先、10 条上限、阈值及失败边界；日用源库未迁移。
用户自行安装；未上传 GitHub、提交或推送。
