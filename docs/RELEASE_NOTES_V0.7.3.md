# 0.7.3 — 数据维护与召回覆盖

2026-09-09，个人 Mac arm64 Lite 版本，未公开发布。

- 后台向量任务识别有效普通记忆的 provider/model 不匹配，按当前配置重新生成；
  不把模型别名视为历史向量等价证明。受限、归档、已删除记录不进入后台队列，
  failed 状态保留可见，不进行无限自动重试；Disabled 时不生成。
- 夜间维护前执行可选的每日备份，复用现有备份登记和验证流程。
  内部配置 `backup.schedule=daily`、`backup.enabled=true`；
  `backup.mirror_dir` 可指定已存在的独立备份目录。默认仍为 manual。
  本机每天最多创建一次成功快照；镜像失败时复用同日快照重试。
  只有本机完整性、外键检查及镜像哈希一致后才标记当天完成；失败阻止本轮清理。
  外盘目录缺失不会在内部磁盘创建替代目录。不会自动删除旧备份。
  调度仅在 Desktop 运行时随现有维护流程执行，默认本地时间 03:00，错过后补跑。
- InnerLife 的会话启动、briefing 和 convergence 先按 Agent 过滤，再限制数量，
  避免繁忙 Agent 的新候选挤掉其他 Agent 的旧候选。
- 保留候选原文及状态；不按年龄强行关闭会话或删除待分享内容。

## 本机维护结果

升级前审计发现普通有效记忆中 267 条属于当前 `bge-m3:latest`，165 条仍是 `bge-m3`。
本轮通过本地 Ollama 重建后，432 条普通有效记忆全部覆盖当前模型；
267 条 restricted 记忆及归档向量保持原状。
165/165 副本向量自召回通过，受限结果为 0；其他领域表和非目标向量未改变，
向量及 Memory Controller revision 触发器按预期更新。
本机和 E61 的操作前快照均恢复打开并核对全部 37 张表的行数及内容哈希。
实际数据库定向写入后 quick_check / foreign_key_check 通过，现代 HTTP MCP 读取正常。

每日备份配置已在本机启用，并手动执行一轮验证成功；持续调度及代码修复需安装此版本生效。
待分享内容 208 条和活跃会话 15 个保留；没有充分证据证明其应关闭或删除。
日志仍采用原有保留策略：成功 Trace 30 天、失败 Trace 180 天及数量上限；
本轮按原有 30 天规则清理 166 条过期成功 Trace，326 条错误 Trace 全部保留。
删除前逐条核对本机与 E61 恢复副本中的完整记录；不清空日志或执行 VACUUM。

## 验证边界

`npm run test:data-maintenance` 覆盖模型错配/隐私/归档/失败/禁用边界、
备份失败不标记完成且不执行清理、外盘恢复后重试复用、跨 Agent 候选分页。
HCT-2026-09-08-02：在写入前识别模型名无法证明历史等价，采用定向重建；
同时检查并修复三处先分页后按 Agent 过滤的问题。
HCT-2026-09-08-01：验证备份失败明确返回失败，并阻止清理和成功标记。
无 UI 自动操作、替用户安装、Git 提交推送或公开发布。

## 安装包与回归结果

`dist-lite/ClaraCore-Desktop-0.7.3-lite-arm64.dmg` 已完成签名、公证及 staple，
App 和 DMG 的 Gatekeeper 检查通过；DMG submission
`588076a8-d639-48fb-a316-ef69b357338c`。
SHA-256：`4a9457a27adb9a0c5f3f68389b473a8c90955faf3c1d7a4fd9c5ea7d347784c6`。
Lite 展开约 293.1 MiB。

通过：`npm run check`、`npm run test:data-maintenance`、`npm run test:backup`、
持久任务、检索边界、InnerLife 会话服务与保留策略、Trace 保留策略、夜间调度回归。
实际 ASAR 内的四组 data-maintenance 测试经 Electron 的 Node 模式运行通过；
`npm run test:package:lite` 通过，关键文件与已检查源码逐字节一致。
本机已安装程序仍是 0.7.2；未替用户安装或启动图形界面。

## 用户安装后复核（2026-09-09）

用户安装后，`/Applications/ClaraCore Desktop.app` 的版本、运行中 HTTP 服务均为
0.7.3，已安装 ASAR 与签名包哈希一致，进程连接预期的日用数据库。
实际服务现代 2026-07-28 和传统 2025-06-18 握手、工具读取通过；
三条已修复记忆的查询均返回 hybrid，432 条普通有效记忆均为当前模型 ready。
SQLite quick_check / foreign_key_check 通过，最近一小时无 runtime error。
四组数据维护测试直接使用已安装 ASAR、临时数据目录运行通过。
每日备份已开启，今天已有成功记录；下一个计划窗口为 9 月 10 日本地 03:00。
尚未等待实际夜间定时触发，页面长驻及交互体验仍由日常使用观察。
