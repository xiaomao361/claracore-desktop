# ClaraCore Desktop 1.0.1

2026-10-21（Asia/Shanghai）。本地源码与 macOS arm64 Lite 试用包已完成，用户已安装，实际升级与非 UI 技术检查通过；尚未公开发布。Lite 为 ad-hoc 签名、未公证的本地包，约 126 MB；见 [打包验证](validation/2026-10-21-v1.0.1-lite-package.md) 和 [安装验证](validation/2026-10-21-v1.0.1-installed.md)。

## InnerLife 候选不会无限积压

每个 Agent 的 pending、deferred、approved 合计最多 10 条，创建后 7 天到期；反复延期不会续期。优先保留 approved，其次 pending、deferred，同类保留较新内容。数据库写入/状态更新时执行容量限制，既有调度器执行过期维护；读取候选时也检查有效期，不依赖 Agent 自律或下一次清理。

超额、过期和时间无效的记录退出候选池，状态为 discarded，分别记录 capacity、expired、invalid_created_at 原因和动作回执。回执保存退出前的状态、原因和更新时间。原文、思想、来源、已使用回执及未完成 drafting 工作保留；完整历史仍可显式读取。升级迁移对已有候选执行同一策略，不声称这些内容已分享。

## Agent 开关与实际运行一致

以每 Agent 的 daemon 选择为准，profile 镜像该选择。升级将旧 profile 与已有 daemon 对齐，保留升级前实际运行/暂停状态，不因旧 profile=false 把正在运行的 Agent 关掉。新 profile 默认暂停。

全局开关控制运行门槛，不再在读取时抹去每 Agent 的选择。启用某个 Agent 可以打开全局开关；暂停某个 Agent 只影响该 Agent。全局关闭时，profileEnabled=true、loopEnabled=false 表示保留选择但暂停执行。

自动会话后记的认领同样遵守全局和 Agent 开关，暂停时保留未认领队列，不调用模型。已认领工作可以完成，显式手动处理仍可执行。任务完成或失败，不会把随后已暂停的 daemon 重新开启。

## 验证与边界

新回归覆盖双 Agent 总量限制、approved/deferred、7 天边界、延期不续期、时间无效、读取无写入、清理失败原子回滚、升级保留全部原文与运行选择、Agent 之间暂停隔离、全局门控保留选择及自动后记的模型调用隔离。`npm run check` 纳入该回归，并使用 Node SQLite 与随包 SQLite CLI 两条路径执行。

`git diff --check`、完整 `npm run check`（含候选池双 SQLite 路径）通过。另行通过 InnerLife 主链路、持久后记/重试与租约保护、历史保留、来源采集及多 Agent 候选隔离回归。package、lockfile 根版本和 Agent Guide 均为 1.0.1。验证使用临时数据根或离线替身，不调用日用模型。

开发与打包阶段未更改日用数据库。用户安装后，012 迁移已在真实数据库执行：候选池 Clara/Codex/Lara 为 10/10/8，889 条过期、81 条超额退出，相关正文仍保留，profile 与 daemon 一致、完整性检查正常。测试未关闭历史 active 会话或操作 UI；下一次自然调度、界面和长期运行仍待观察。此前个人 Codex hook 的修复和备份保持独立；宿主准备/验证脚本不会由安装包自动写入个人配置。
