# 0.7.2 — HTTP 接入收敛

2026-09-09，个人 Mac arm64 Lite 版本，未公开发布。

- HTTP MCP 是唯一 Agent 传输，保留 2026-07-28 和 2025-06-18 协议。
- 移除 stdio 服务、启动配置、接入状态卡、备用文案及兄弟进程清理。
- Gateway 与主进程共用资源，移除旧的独立 Gateway 进程扫描和重复统计路径。
- 内部 CLI 保留；README、架构、代码地图、接入手册、运行内存策略和打包说明已同步。
- 原 stdio 功能回归迁至隔离 HTTP 测试进程；不删除领域功能覆盖。
- 修复交接写入可能落到 Desktop 当前线的问题：按调用者或明确 lineId 选线，
  多线歧义时拒绝写入，返回包与实际交接记录使用同一条线。

迁移步骤见 [HTTP MCP 迁移](HTTP_MCP_MIGRATION.md)。历史版本说明保留原始证据。
没有新增数据迁移，也没有修改历史 stdio Trace、日用数据库或客户端配置。

验证：npm run check、npm run test:gateway、CLI、8 进程 SQLite 并发通过。
HCT-2026-09-08-01：HTTP 不可用时接入邀请禁用并显示错误；交接歧义明确失败且无写入。
HCT-2026-09-08-02：交接回归覆盖调用者所属线、另一 Agent 的当前线、显式跨线及歧义分支。
UI 检查为无界面契约测试，实际客户端重连和页面操作仍需安装后人工验收。

## 安装包验证

`dist-lite/ClaraCore-Desktop-0.7.2-lite-arm64.dmg`，126819700 bytes。
SHA-256：`5cb874e0031f3bb793f20e9cf711f1d55443fb5e282dd8999000b54d3a68ca48`。
App 与 DMG 的签名、公证、staple、Gatekeeper 检查通过。
DMG submission：9926c7c9-fb0a-4cea-bef9-c4a6b92439a2（Accepted）。
实际 ASAR 验证：stdio 服务文件缺失、维护 CLI 存在；完整 HTTP 功能、现代协议、
Node/SQLite CLI 两种原生向量扩展路径通过。
测试使用临时目录，未驱动 UI、替用户安装、提交、推送或公开发布。
