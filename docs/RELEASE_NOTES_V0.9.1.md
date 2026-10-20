# 0.9.1 — 共同理解与会话身份接入修复

2026-10-15，本地测试版本，未公开发布。用户确认本次共同理解改版为 0.9.0，
随后修复的检查点为 0.9.1。此前 Lite .1/.2 包误沿用 0.8.4 元数据；旧产物、
哈希和安装检查保留真实历史值，当前 package、lockfile、Agent Guide 已同步到 0.9.1。
0.9.0 是本轮改版的版本归属，不声称曾生成标注 0.9.0 的安装包或发布记录。

## 当前行为

- `understanding_context/submit/resume` 提供有界共同上下文、逐事件证据规划、
  四域授权执行及可恢复回执，原模块保留数据所有权。
- 模型调用和执行仍需明确授权；宿主事件桥默认关闭，没有自动采集全部对话。
- submit/resume 要求真实 Agent 与 conversation 身份。配套 Hermes 客户端修复
  支持按每次工具调用的 session_id 动态注入会话头，保留并发隔离与跨域剥离。
  此补丁在 Hermes 源码和 MCP 配置中，不包含于 ClaraCore DMG，须重启 Hermes 加载。
- 没有新增权限配置页或 1.0 UI；建议的软件长期默认与会话临时授权尚未开发。

契约见 [共同理解](UNDERSTANDING_CONTRACT.md)、[宿主接入](UNDERSTANDING_HOST.md)。
Hermes 修复的 166 项回归与真实客户端只读探针见
[验证记录](validation/2026-10-15-hermes-session-identity.md)；日用 Hermes 实际聊天仍待验收。

## 验证与剩余边界

0.9.1 Lite 的路径、哈希及重新验证结果以
[包回执](validation/2026-10-15-understanding-lite-package.md) 为准。
使用本地 ad-hoc 签名，不进行 Apple 公证、上传发布、安装或窗口操作。
已批准的 8 次真实模型验收预算用完，1 次请求失败和两处引导修正仍待新授权复验；
本次版本修正与打包不追加模型调用。包内自动化检查不代表已安装应用、真实对话
增量完整性或用户界面验收。
