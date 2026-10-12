# 0.8.3 — 通用决策模型配置

2026-10-09，开发版本，已生成本地 Lite 试用包，尚未正式发布。基于 0.8.2 可选路由，增加通用服务适配，原 0.8.2 Lite 试用包未重新标记；其本地安装包已于 2026-10-09 按用户要求清理。

新增 OpenAI 兼容服务商、API 基础地址和可手填模型名；模型列表只在显式点击获取时请求。TypeSafe/Jev 保留为可选兼容适配。新安装默认 OpenAI 兼容、关闭、无默认模型；旧配置按原 provider/mode/model 读取，不自动启用、切换或发送旧密钥。
密钥按 provider + 规范化基础地址独立加密保存；改变服务或地址时不会继承其他服务密钥，切回原地址可使用该地址保留的密钥。删除操作只删除当前绑定的密钥。
兼容接口使用 `/chat/completions` JSON 模式和 `/models`，基础地址需包含 API 前缀（例如 `/v1`）；HTTPS 或 loopback HTTP，无内嵌凭据/查询参数/重定向。结构错误、拒绝、截断、超时、HTTP 错误均明确回退，HTTP 错误码可见。通用模型 confidence 标记为 model_self_reported，不伪造概率分布或声称已校准。
既有 IPC 名称、`jev-settings.json` 与 Gateway 的 `jev` 字段保持兼容；实际生产适配由 `core/decision-model/service.js` 提供。
旧 Lite DMG 是 9 月 30 日的 TypeSafe 试用包，不含此次通用改造；此次另行生成 0.8.3 Lite 包，未上线。真实模型连接和窗口验收仍需用户配置后验证。

## 验证

版本更新后 `npm run check`、`git diff --check` 及版本/Agent Guide 一致性检查通过；Gateway 回归已在通用改造阶段通过。真实模型连接、窗口交互和实际使用效果尚待用户验证。HCT-2026-09-08-01/02：迁移保持关闭状态与原配置含义，失败不变成正常空结果，密钥不跨服务绑定，模型自报值不冒充校准概率。

配置方法见 [通用决策模型](DECISION_MODELS.md)。

## 本地 Lite 试用包

2026-10-09 生成 macOS Apple Silicon（arm64）Lite DMG，未签名、未公证。

- 路径：`/Volumes/E61/claracore/builds/claracore-desktop/dist-lite/ClaraCore-Desktop-0.8.3-lite-arm64.dmg`
- 大小：127639570 bytes
- SHA-256：`120d945e4e0e2f5cfb526b4fa32347759249ec9692c15a9bc16fb64a16d3f9ce`
- `npm run test:package:lite` 与 `hdiutil verify` 通过；包内版本 0.8.3、flavor lite，374 个源码文件与工作区一致，包含通用服务适配。
- 实际模型连接、窗口交互与用户试用仍待验证；未提交源码或发布 GitHub Release。

2026-10-09 构建清理：保留 0.8.1 Full/Lite 和 0.8.3 Lite DMG；删除 0.7.7、0.8.0 beta、0.8.2 旧包及已展开的构建中间目录。保留的三个 DMG 清理前后 SHA-256 一致。
