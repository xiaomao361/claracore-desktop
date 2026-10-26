# Desktop v0.8 本地知识 — 下一 Session 交接

更新：2026-10-26（Asia/Shanghai）。这是当前交接入口；[初始讨论快照](HANDOFF_LOCAL_KNOWLEDGE_INITIAL.md)仅供查历史。

## 当前工程位置：1.0.3 已正式发布

用户持续试用暂未反馈问题，并于 10 月 26 日授权 Release。17:41:04（Asia/Shanghai）已公开为 Latest、非预发布，`v1.0.3` 指向 `3f12e0b`。macOS arm64 与 Windows x64 Full/Lite 四安装包、两平台校验清单已发布；macOS 已签名公证，Windows 未签名。见[正式发布记录](validation/2026-10-26-v1.0.3-release.md)。用户的日用安装不被此次发布替换或重启；后续按实际反馈继续，不创建自动监控或扩展功能。下方保留 10 月 22 日试用与源码收口的历史边界。

用户已安装 macOS arm64 Lite 1.0.3（`v1.0.3-20261022.2`），实际安装包、运行进程、实时 Gateway 和只读日用审计已验证，见 [安装验证](validation/2026-10-22-v1.0.3-installed.md)。当前包含 1.0.1 的 InnerLife 候选池/生命周期修复、1.0.2 的 MCP 默认 25 / core-compat 38 / full 83 及 16 旧名适配，以及 1.0.3 的 pending 独立审计和补算后状态快照。594 条 active 非 restricted 记忆在观察时全部为当前模型 ready，维护各异常计数为零；这不是长期运行或视觉验收。

2026-10-22 用户授权本轮收口，源码、文档及必要验证按当前 `codex/v0.8.0-local-knowledge` 分支提交推送；详情见 [收口记录](validation/2026-10-22-v1.0.3-closeout.md)。原有 `CLAUDE.md` 继续保留，不纳入。此后由用户持续试用；不自动升级、重打包、发布、重启或创建监控，按实际问题反馈继续。16 旧名兼容和历史会话结束证据门槛保持不变。

## 1.0.1 历史工程与安装记录

源码、锁文件与 Agent Guide 已更新为 1.0.1：InnerLife 候选池按 Agent 合计最多 10 条、创建后 7 天有效，退出候选保留原文和回执；统一 Agent 开关与全局门控，迁移保留已有 daemon 的实际选择。详见 [1.0.1 说明](RELEASE_NOTES_V1.0.1.md)。用户随后要求 Lite 包，已完成并验证 macOS arm64 本地试用 DMG（ad-hoc、未公证），见 [打包回执](validation/2026-10-21-v1.0.1-lite-package.md)。用户现已安装，实际 /Applications 包 hash 与打包回执一致、实时 Gateway=1.0.1、日用库012迁移已执行；候选10/10/8、开关一致、正文保留和完整性检查通过，见 [安装验证](validation/2026-10-21-v1.0.1-installed.md)。测试未操作UI或切换日用开关；下一次自然调度与长期体验待观察。未提交、打 tag 或公开发布。之前已安装的个人 Codex hook 修复继续有效，Desktop 包不会覆盖宿主配置。

## 1.0.0 发布记录

用户已确认 GUI／品牌效果，批准 1.0.0，并授权正式 release。当时源码、锁文件和
Agent Guide 均为 1.0.0，已按 macOS arm64 与 Windows x64 Full/Lite 矩阵发布，
源码标签 `v1.0.0` 指向 `252e258`。
实际发布状态、资产与验证边界以 [1.0.0 说明](RELEASE_NOTES_V1.0.0.md) 为准。
以下各节保留为阶段历史，不再表示当前版本或尚未实现 GUI。

## 0.9.2 工程记录（2026-10-15）

- 用户确认共同理解改版为 0.9.0，随后修复为 0.9.1；本次首页长标题布局修复为 0.9.2，package、lockfile 和 Agent Guide 已同步。此前 .1/.2 测试包误沿用 0.8.4，保留作历史记录。
- 当前实现与验证边界见 [0.9.2 说明](RELEASE_NOTES_V0.9.2.md)、[共同理解契约](UNDERSTANDING_CONTRACT.md) 和 [Lite 包回执](validation/2026-10-15-understanding-lite-package.md)。Hermes 动态会话头修复已完成源码与隔离测试，日用进程仍待用户重启；权限配置页未实现。
- 0.9.2 为本地测试版本，未公开发布，未提交推送。以下为原 0.8.4 阶段记录。

## 0.8.4 工程记录（2026-10-12）

- 仓库、分支和远端仍为下方记录的独立 Desktop 仓库。接手时 HEAD 为 `6f2997015f5102e1e9893e2ac53bb772344a77dd`；原有 0.8.2 路由、0.8.3 通用决策配置未提交，已保留并纳入本轮整体版本收尾（当前分支提交，不覆盖 main）。
- 本轮接续 2026-10-12 日常运维授权交接，逐项审查撤回归档，修复 Shared Line 精确目标回执、InnerLife 分区分页/Agent 明细边界、Memory Controller 显式反馈与 timeout。见 [0.8.4 说明](RELEASE_NOTES_V0.8.4.md) 和 [维护契约](DESKTOP_MAINTENANCE.md)。
- 公开版本仍为 0.8.1。0.8.3 的 10 月 9 日包（`120d945...`）是通用配置试用；日常运维撤回包（`e349735...`）只供历史证据，不是安装建议。新工程使用 0.8.4，避免同版本不同内容。
- 日常 Jev 与 Knowledge 自动投递保持关闭；当前 Codex 宿主为 Memory-only。Desktop 1.0 UI 方向暂停；没有本轮设计重做。
- 宿主 hook 原版未替换。仓库维护路径识别策略和离线准备脚本，安装属于宿主操作方；49 个历史后台 active 会话没有结束证据，未更改状态。没有数据库恢复或维护回滚。
- 用户试用、实际模型连接、真实宿主使用和 UI 交互仍是独立待验证边界。构建/静态回归不证明这些层面。
- 继续前检查实际 Git 状态与当前版本；不要用此处历史 HEAD 覆盖工作区。构建记录和验证以 0.8.4 发布说明为准。

## 历史交接记录（以下为 2026-09-29 状态，已被上方当前位置取代）

## 0. 0.8.1 历史进展

已完成搜索恢复、文字容错与排序、日期来源展示、收录时搜索状态提示，并建立真实语料 20 条基准，20/20 通过。`npm run check`、Lite flavor/包检查、DMG verify、7 文件包内一致性通过。当前本地包及哈希见 [0.8.1 说明](RELEASE_NOTES_V0.8.1.md)。工作区仍未提交，保留原有改动；未安装或改运行中索引。宿主知识投递受 Memory-only 指令限制，仍待宿主接入。下方 0.8.0-beta.1 包记录为历史。

## 1. 先看这里

- 仓库：`/Users/zhouwei/Documents/ClaraCore/apps/claracore-desktop`，独立 Desktop 仓库。
- 分支：`codex/v0.8.0-local-knowledge`。
- 本次交接时 HEAD：`54bbd6b23bc2193a9fecd76efeb2c9716d0c52c9`。**大量实现尚未提交，包括 untracked 新模块；HEAD 不包含当前完整成果。**
- 远端：`git@github.com:xiaomao361/claracore-desktop.git`。
- 在这个现有工作目录继续；只从分支创建干净 worktree 会丢失未提交成果。先检查实际状态，不 reset/clean/覆盖。原有 untracked `CLAUDE.md` 不属于本次成果。
- 开发版本：`0.8.1`；公开版本仍为 `0.7.7`。package、lockfile、Agent Guide 与版本文档已同步。
- 决策模型已移入「智能能力」，模型列表接入 TypeSafe `GET /v1/models`；待用户窗口验收。
- 知识阅读器已完成源码与自动化回归，**实机视觉未验收**；新版 Lite 测试包已生成，待用户安装试用。
- 用户在 Lite 窗口反馈目录配置流程不合常理；已移除“选择后另点使用”的暂存步骤，选择后直接保存。后续又确认清除配置是低频操作，已将它收进当前路径框右端的小清除按钮，明确不删原文件；新版 Lite 已重打，待窗口复核。
- 用户确认接入近期整理的 `/Volumes/E61/Knowledge`。已将运行中 Desktop 的 `knowledge-root.json` 从空目录 `/Volumes/E61/Claracore-Knowledge` 改为原库路径；实时 MCP 目录返回 43 篇，精确检索和已知来源指针读取成功。正文没有复制或搬动；**现有资料接入无需安装新包**。另因先前提出的未来写入规则，源码补齐了新笔记的 `kb_id` 格式并重打 Lite；仅使用该新写入格式才需要安装更新包。
- 已在运行中 Desktop 为该目录建立结构索引与本机 Ollama `bge-m3:latest` 语义索引：43 篇、287 节、426 个窗口，状态 `current`；一次语义查询返回正常结果。索引位于 Desktop userData，不改 Markdown，也不代替原 `kb.py` 的索引。
- 用户认可知识阅读布局后，按约定先做两项交互调整：目录栏略加宽，文档列表独立滚动且翻页常驻底部，翻页/切换范围回到列表顶部；“返回上一篇”改为“返回刚才阅读”，复制按钮随文档路径或小节锚点显示准确动作。`knowledge-page-smoke.js` 覆盖翻页位置与文档/段落指针，`npm run check` 通过。窗口手感仍由用户验收。

## 2. 用户已确认的产品与设计

### 知识与收录

Markdown 是知识正文的唯一权威副本；目录可配置，不硬编码 E61，不复制一套正文到产品数据库。Agent 负责来源核对、清洗、分段和有意义的链接，Desktop 提供受约束的预览/提交、检查、索引、读取与回执。材料也包括对话中整理的 MD 和各种来源链接，不只是手动复制现成文件。外部编辑器仍可改原文件。

一个当前知识目录；无后台抓取所有对话/应用；不迁移旧 Memoria 卡片、不把未确认观点升格成用户立场。真实知识库 `/Volumes/E61/Knowledge` 只做读取与根目录说明/整理约定的窄文档更新；收录写入测试始终在临时目录。

### 阅读器（用户明确确认）

- 简单的人用阅读器，Agent 和页面通过接口获取文档。
- 左侧文档目录可收起；默认单栏；正文内部链接在右侧参考栏打开并定位章节，主文档保持。
- 参考栏继续点击链接只更新参考栏，独立返回；可关闭或显式「在主栏阅读」。两栏独立滚动。
- 篇内目录定位本栏；外部 HTTP/HTTPS 来源交系统打开，不嵌入抓取网页。
- 沿用软件主视觉：现有品牌、暖白背景、绿色链接、灰色边界及导航样式；支持原有深色主题。
- 搜索和维护按需展开，不让索引操作占据阅读主体。

Figma 文件：[知识页改版](https://www.figma.com/design/2BltGrbXOxUvNxhI15TM1o)。当前参考：`6:2` 双栏、`6:204` 默认单栏。`2:2` / `3:67` 是较早稿，不要以早期管理式布局覆盖新版。Figma 中已连接示例链接打开/关闭参考栏；不是软件实机验收。

### 决策模型（已实现，待实机验收）

界面模块名称用「决策模型」，放在设置的「智能能力」。Jev/TypeSafe 是具体服务，不当作普通聊天模型的另一个名称。模型列表需要走接口获取，不能继续只放 `jev-latest` 文本输入。

关闭时零 Jev 请求；已有自动回召基线仍可运行。启用目前只做 query-only shadow，不赋予实际路由权。只有查询文本与固定选项可发送；正文、路径、结果和对话历史不发送。显式搜索的默认模式仍是精确；不要把“无 Jev 自动回召基线”误写成所有人用搜索都必须向量。

## 3. 已实现与源码入口

| 模块 | 当前实现 | 主要入口 |
| --- | --- | --- |
| 目录/读取 | 单根目录、分页列表、完整小节、锚点/链接/反向链接及区分错误 | `core/knowledge/preferences.js`、`library.js` |
| 收录 | preview/commit、冲突检查、重试恢复、回执、inbox 原文保留 | `core/knowledge/intake.js`、`storage.js` |
| 检索 | 精确/语义/混合，本机 embedding，分批建索引/暂停、过期/损坏/失败状态 | `core/knowledge/search.js`、`embedding.js` |
| 页面 | 文档路径分组/分页、双栏、各自 TOC/历史、关闭/提升主栏、拖动/键盘调宽 | `app/views/knowledge.js`、`app/knowledge-markdown.js` |
| 布局 | 单一阅读面板，默认收起搜索/更多，窄屏上下对照 | `styles/views/knowledge.css`、`index.html`、`app/dom.js`、`app/i18n/{zh,en}.js` |
| Jev | 专用适配、默认关闭、安全密钥、固定样例连接测试、query-only 观察 | `core/jev/service.js`、`app/views/jev-settings.js` |
| 接口 | Knowledge MCP/IPC/HTTP 接入与约束 | `core/gateway/tool-{definitions,handlers}/knowledge.js`、`electron/{ipc-contracts,ipc-handlers,preload,http-agent-gateway}.js` |
| 自动上下文 | 旧 Memory-only 兼容、新协议 memory-knowledge-v1、完整小节校验与共享预算 | `core/gateway/{knowledge-context,turn-context,auto-context}.js` |

最近阅读器实现细节：两栏分别请求序号；关闭、换目录、停用后旧参考响应不生效；重复文档使用不同 DOM ID；参考读取错误不影响主文档。目录每页 10 篇按路径分组，不是一次加载全库树。主栏历史恢复滚动；参考移入主栏重新定位章节以适应宽度。960px 以下上下对照，600px 以下目录在上方。维护和最近收录放在「更多」。

Jev 设置已作为 `#modelView[data-settings-panel="capabilities"]` 的「决策模型」卡片；`#jevModel` 为 select，显式获取模型。主进程读取安全密钥调用 TypeSafe，页面只接收模型元数据及状态。

## 4. 下一步按此顺序

1. **实机验收与必要修正**：用户操作窗口，检查决策模型卡片、模型获取/选择，以及阅读器布局、内部链接定位、原文保持、两栏返回/滚动、拖动、窄屏和深色主题。源码测试不能证明 Figma 视觉一致。发现实际问题后在已确认方向内修复。
2. **现有库窗口复核**：配置已指向 `/Volumes/E61/Knowledge`，运行中服务看到 43 篇笔记/主题；用户可在当前应用窗口刷新知识页，核对目录、来源链接和清除入口，无需安装新包。`sources/` 及根目录说明保留在同一原库，但不进入默认目录/正文索引。
3. **Lite 试用与后续重打**：0.8.1 改善知识搜索及恢复，当前验证与产物以 [0.8.1 说明](RELEASE_NOTES_V0.8.1.md) 为准。历史 0.8.0-beta.1 包保留；公开发行另按验收和授权推进。
4. **自动上下文宿主验收**：实现有 `memory-knowledge-v1`，但当前 Codex 宿主仍是 Memory-only 指令。需要宿主接入后才能确认对话知识投递/使用；不能仅因服务测试成功就宣称宿主已启用。Jev 实际路由权也未开放。

## 5. 验证位置

决策模型迁移及模型列表接入后，`npm run check` 和 `git diff --check` 通过，包含语法、SQL/IPC lint、架构、上下文预算/投递、InnerLife、Knowledge 和 Jev。Jev 定向测试覆盖模型列表成功、鉴权失败、空列表、无效响应及页面刷新；使用模拟 HTTP 和内存 DOM，未进行当前环境的真实 TypeSafe 调用或窗口验收。

```sh
npm run check
node core/tests/knowledge-page-smoke.js
npm run test:jev
git diff --check
```

`knowledge-page-smoke.js` 使用 LinkeDOM + 临时知识库，覆盖分页、两栏正文/历史/滚动、提升与返回、TOC、键盘调宽、重复 ID、参考缺章/缺文件、旧响应与关闭、目录切换、收录重试和安全转义。不是浏览器布局测试。Full 真实内置 embedding 与临时 Ollama 协议在此前阶段已验证；不等于用户真实 Ollama 环境验收。

- HCT-2026-09-08-01：参考失败独立可见，不能变成正常空结果或覆盖主文档。
- HCT-2026-09-08-02：正文链接去参考栏、TOC 留本栏的规则有用户确认；未改变知识内容或做数据迁移。

2026-09-22 接入现有库的 HCT-2026-09-08-02 核对：用户确认源是 `/Volumes/E61/Knowledge`，不是旧的 `/Volumes/E61/claracore/knowledge`；76 个 MD 中 `notes/` 38、`topics/` 5、`sources/` 30、根目录 3。Desktop 默认目录/索引只收前 43，来源快照通过已知路径可读；`kb.py check` 为 76 文件、238 条内部链接、断链 0。真实库未做正文迁移或批量改写。隔离互操作测试确认 Desktop 新建笔记的 `kb_id` 可被原 `kb.py check` 接受。
HCT-2026-09-08-01：新笔记 `kb_id` 默认生成只对 `notes/` 新建生效；缺少目标路径仍明确返回 `invalid_reference`，测试确认没有将坏输入当成成功。

本次文档交接只做文档核对与 diff 检查，不重复全套代码测试。

## 6. 版本、旧包与凭据

2026-09-29：知识页按搜索数据状态显示准备、更新、暂停、继续及模型设置入口；查找方式改为按文字／按含义／文字与含义，搜索结果区限制高度。细节见 `KNOWLEDGE_PAGE.md`。新版同名 arm64 Lite 包 SHA-256 `fc20aace781bb380376c6a979d2f56829e63a3f793e1461a05b22f2e5f158ca9`，127609120 字节。`npm run check`、Lite 功能及包检查、DMG 校验通过；打包目录 ASAR 内 6 个相关前端文件与当前源码逐字节一致。包未签名、未公证，实机视觉与交互待用户验收。以下旧包记录仅保留历史。


旧版正式 Lite 包（**不包含新版双栏与版本更新**）：
`/Volumes/E61/claracore/builds/claracore-desktop/dist-lite/ClaraCore-Desktop-0.7.7-lite-arm64.dmg`。

历史 0.8.0-beta.1 测试包（包含决策模型与知识阅读器改动）：
`/Volumes/E61/claracore/builds/claracore-desktop/dist-lite/ClaraCore-Desktop-0.8.0-beta.1-lite-arm64.dmg`。
2026-09-22 完成知识页中英文与暗色主题静态核对后再次重打 Lite；`hdiutil verify` 通过，当时包 SHA-256 为 `84caa6a9e778cee33e2ed86ae1c3e2dee674991a74b5f4fb18896f0c32d963fc`。ASAR 中页面、知识页源码、翻译、CSS 与当时工作树逐文件一致。修复了主按钮悬停时的文字对比度、文档指针复制提示，并统一语义索引说明/进度用词；知识页 52 个静态界面键在中英文中均存在、117 个知识键的占位变量一致。`npm run check`、`git diff --check` 通过；这些都不是安装后的窗口验收。包未签名、未公证。

2026-09-23 同名 Lite 包已按当前源码重打，包含 Jev 知识检索方式 exact/semantic 的观察建议与凭据不可解密状态区分。新包 SHA-256 为 `73c39c433d0c7dda702a13dc52dca3b0779cc7078f5995414249bc022ac86c4e`，大小 127592679 字节。`npm run check`、Lite 功能检查、Lite 包检查、`hdiutil verify` 均通过；挂载 DMG 后核对版本、Lite 标记及 Jev 源码哈希一致。包未签名、未公证。真实 Jev 新双问题调用与安装后的窗口体验仍待验证。

2026-09-22 清理了 5 个 `before-*` 对照安装包和 1 个与 0.7.7 Lite 正式包哈希相同的知识测试副本；当前安装测试请使用上方 0.8.0 beta.1 Lite 包。用户尚未验收当前包安装后的窗口效果。

此前已通过 Lite 资源检查、包内隔离读取与 DMG 校验，用户安装后的截图暴露了布局/旧版本问题，因此不能视为当前 UI 验收通过。包 unsigned、未公证。

后续本地构建可参考已成功命令（Electron 下载曾失败，使用已安装同版本运行时）：

```sh
npm run dist:mac:lite -- --arm64 --config.electronDist=node_modules/electron/dist
```

`dist-lite` 指向 E61 构建目录，先检查挂载与实际路径。Lite 语义检索需要本机 Ollama；没有内置模型。不要运行会启动 UI 的 smoke 而绕过用户窗口权限。

用户此前提供的测试密钥已通过 Electron safeStorage 保存，固定公开样例的真实连接在此前阶段验证过。**不在 handoff、Git 或日志写密钥，不重读/打印安全存储。** 配置变更保留已有密钥；公共配置只返回 keyConfigured。环境变化后连接是否仍可用需重新验证，不能拿旧连接结果冒充当前测试。

## 7. 继续开发边界与文档

- 最近一轮已完成决策模型设置与模型接口开发；尚未提交、推送、创建新任务、安装或发布。
- UI 操作归用户；一般继续开发不授权点击、导航、启动窗口、浏览器验收。可以改代码、运行非交互测试和构建。
- 真实库已由用户确认并绑定到 Desktop；不复制、清空或批量改写正文。收录写入测试使用临时目录。
- 不改变 Jev 隐私与 shadow 边界；接模型发现接口也不等于授权真实路由。
- 当前共同线：`line_muai9s5o_0eok41t6`（E61 本地 Markdown 知识库），阶段完成后更新并读回；长期目标未完成，不归档。
- 原任务 ID：`01a0c369-ec5e-7162-a68d-a081aa2a3443`。可按需读历史，先以本 handoff 和当前源码为入口。

进一步阅读：

- [实施计划与阶段记录](V0.8.0_LOCAL_KNOWLEDGE_PLAN.md)
- [阅读器契约及验收](KNOWLEDGE_PAGE.md)
- [设计与实现差异](KNOWLEDGE_DESIGN_REVIEW.md)
- [Jev 服务与隐私](JEV_RECALL.md)
- [收录](KNOWLEDGE_INTAKE.md) / [检索](KNOWLEDGE_SEARCH.md) / [上下文协议](KNOWLEDGE_CONTEXT.md)

新 Session 首条消息可用：

> 阅读 apps/claracore-desktop/docs/HANDOFF_LOCAL_KNOWLEDGE.md，在现有 codex/v0.8.0-local-knowledge 未提交工作树继续。用户已在 Lite 窗口反馈决策模型对齐和知识目录流程，当前源码已分别修正；知识目录清除入口改为路径框右端的小按钮，需核对最新包和用户实际窗口反馈。用户拥有所有实际窗口操作。不要丢失现有未提交成果。
