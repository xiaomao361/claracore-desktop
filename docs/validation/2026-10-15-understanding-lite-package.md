# 共同理解 Lite 本地安装测试包

当前应安装的测试版本为 **0.9.2 / understanding-20261015.4**（见文末第四次打包）。
用户确认本次改版为 0.9.0、随后修复为 0.9.1；此前 .1/.2 包误沿用 0.8.4 元数据，
下方原记录保留当时真实版本与哈希，不作为当前版本判断。

2026-10-15 用户提出“打一个 lite 包，我安装你验证”，本轮据此构建本地 macOS
Apple Silicon 测试 DMG。保留仓库与包版本 `0.8.4`，独立构建标识为
`understanding-20261015.1`，不代表 0.9.x 正式发布。

产物位于仓库 `out/understanding-lite-20261015.1/`：

- `ClaraCore-Desktop-0.8.4-understanding-20261015.1-lite-arm64.dmg`
- `SHA256SUMS.txt`
- `verification.json`（构建标识、逐文件指纹及验证层次）

DMG 为 126340721 字节，SHA-256：
`5e2b27783ecdfaf27b22cb9b26431083f07372ff10b062ab915dcc12a45592af`。

构建入口：

```sh
CSC_IDENTITY_AUTO_DISCOVERY=false ./node_modules/.bin/electron-builder --mac dmg --arm64 --config scripts/understanding-lite-builder-config.js --publish never
```

使用本地 ad-hoc 临时签名，`codesign --verify --deep --strict` 通过；没有使用
Developer ID 发布证书、Apple 公证或上传发布。首包沿用默认 identity=null，
签名检查失败；专用配置已改为显式 ad-hoc、既有 JIT/库加载 entitlements，重建
最终 DMG 后重新验证。临时签名完整性不等于 Apple 公证或 Gatekeeper 接受。

## 已完成验证

- `npm run check` 与 `git diff --check` 通过。
- Lite 包体检查通过，展开约 293.3 MiB，无内置模型和 Full 依赖树。
  `verify-lite-package.js` 增加可选 `--app`，可核对这个独立输出目录。
- 最终 ASAR 的 397 个业务、Electron、界面与资源文件与当前工作区字节一致；
  包内版本为 0.8.4、flavor=lite、localBuildId 正确。
- `hdiutil verify` 校验最终 DMG 通过；应用深层严格签名检查通过。
- 最终包的 SQLite Node 与 CLI 两条 sqlite-vec 路径通过。
- 最终包的隔离 Gateway smoke 通过。
- 最终包使用自带 Electron 的 `ELECTRON_RUN_AS_NODE=1` 执行 ASAR 内五组共同
  理解测试：召回、材料、共同线、写入/恢复、认证 HTTP，均通过。模型为替身；
  HTTP 测试客户端借用工作区开发依赖，产品服务代码来自最终 ASAR。

所有运行验证均为无窗口测试，使用临时数据根并停止验证服务；没有打开用户
应用、迁移真实数据或触发额外真实模型调用。本次开发未新增数据库 migration。
尚未安装，不能将上述验证视作已安装应用或真实数据兼容性验收。

## 用户安装后的下一步

用户退出旧版，手动安装并打开这个测试包，再通知本 chat。Agent 随后只读核对
安装目录构建标识、运行中实例、Gateway 连接、新三个 understanding 接口与错误
日志；不追加真实模型调用，不向业务记忆或知识写测试数据。窗口与界面操作由
用户完成。如系统阻止打开，先保留原始提示，再判断签名/公证问题，不自动修改
系统安全策略。

安装本包只把新服务端能力带到实际应用；不会自动安装 Codex 宿主事件桥，仍不
承诺实际对话增量完整交付。此前 8 次模型预算已用完，两处引导修正和失败用例
的真实复验仍待另行授权。1.0.x UI 尚未开始，未提交推送或公开发布。

## 安装后首轮只读检查

用户随后确认已安装并要求简单试用、说明与旧版差异及其他 Agent 是否需重新阅读。
本轮确认：

- `/Applications/ClaraCore Desktop.app` 包内版本 0.8.4、flavor=lite，
  `localBuildId=understanding-20261015.1`，包含共同理解实现。
- 运行进程 PID 32889 来自该安装目录；同一 PID 监听 127.0.0.1:50668。
  进程启动时间为 2026-10-15 06:44:11 UTC。
- `/health` 返回 ok。认证 MCP initialize 返回新版共同理解 instructions，
  core 的实时 tools/list 为 38 项，三个 understanding 工具均存在。
- 对新 `understanding_context` 发送超出 UTF-8 字节预算的合成查询，实际处理器
  在任何召回前返回 `bounded_query_required`。本次接口探测没有读取业务记忆、
  执行语义计划、创建业务记录或调用外部模型，不等于有效查询/语义写回验收。
- 本轮检查时，runtime_events 中自上述进程启动以来没有 error/warn/warning
  记录。查询使用 SQLite -readonly，同一次 SQL 核对数据库真实路径，只取级别、
  来源和数量，不读取消息正文。该结论仅覆盖这张运行事件表和这段窗口。
- 新版 `gateway_docs(query="understanding")` 可读。首次查询误把 section/query
  同时传入，被参数校验拒绝，已改为单独 query 成功；另一次预算错误是主动探测，
  不将这两项调用错误记为应用运行故障。

仍有两个接入缺口：当前 chat 暴露给 Agent 的工具清单仍没有三个新工具，
`gateway_docs.section` 枚举也是旧形状，说明服务端已更新而本会话尚未刷新发现；
其他 Agent 是否缓存需各自检查。当前标准 MCP 连接的 conversationId 为空；
服务端 submit/resume 的 ownerKey 明确要求真实 agentId 和 conversationId。
这意味着当前连接尚不具备统一提交/恢复所需的会话身份，不通过伪造固定 ID
或放宽服务端检查绕过。真实对话自动增量接入仍未完成。

建议各 Agent 更新后刷新工具发现并读一次共同理解指南；旧分域工具继续可用。
宿主须为每个真实对话传递稳定唯一的 `X-ClaraCore-Conversation-ID`，模型与写入
权限沿用各自已有授权。刷新清单/读指南本身不能解决宿主回调或会话身份缺失。

## 第二次打包：understanding-20261015.2

用户在 Hermes 动态会话身份修复后要求重新打 Lite 包。本次仍构建 ClaraCore
macOS Apple Silicon 本地测试 DMG，版本保持 0.8.4；原 `.1` 产物完整保留。
专用 builder 配置现在指向 `.2`，上文 `.1` 构建命令的配置输出已随之更新。

新产物：
`out/understanding-lite-20261015.2/ClaraCore-Desktop-0.8.4-understanding-20261015.2-lite-arm64.dmg`。
大小 126340968 字节，SHA-256：
`eab1b811e8b3a8ce6963d82c51591275fe5ddc251bfda17052029914da239e3a`。
同目录保存 `SHA256SUMS.txt` 与 `verification.json`。

本次重新完成 `npm run check`、`git diff --check`、Lite 包边界、ad-hoc 深层严格
签名、DMG 完整性、包内 SQLite Node/CLI sqlite-vec、隔离 Gateway、包内共同理解
召回/材料/共同线/恢复/认证 HTTP 五组测试，均通过。SQLite 包检查首次因传入相对
路径被脚本拒绝，改用其要求的绝对路径后两条引擎均通过，不属于产品运行故障。

最终 ASAR 的 397 个文件与当前源码逐字节一致；与 `.1` 的文件指纹相比，仅
`core/gateway/README.md` 改变，运行代码与界面没有新增变化。Lite 展开约
293.3 MiB，无内置模型和生产依赖树。没有 Apple 公证、上传发布、模型调用、
真实数据访问、安装或启动用户窗口；新包尚待用户手动安装后的验收。

Hermes 的补丁位于 Hermes 客户端源码及其 MCP 配置中，不包含在 ClaraCore DMG；
需用户重启 Hermes 加载。权限配置页只是前轮建议，本次未实现。重装 ClaraCore
不能代替重启 Hermes，也不代表真实聊天 submit/resume 或自动采集已经验收。

## 第三次打包：0.9.1 / understanding-20261015.3

用户纠正版本归属后，已同步 package.json、lockfile、Agent Guide、版本说明、
共同理解契约与当前交接入口。没有将旧包重命名冒充新版本，.1/.2 保持原样。

- 路径：`out/understanding-lite-20261015.3/ClaraCore-Desktop-0.9.1-understanding-20261015.3-lite-arm64.dmg`
- 大小：126340953 字节。
- SHA-256：`354da4916a0ec199c2d7e93710e3de0860c1e136539dc2349fbf784b95ee94fb`。
- 同目录保存 `SHA256SUMS.txt` 和 `verification.json`。

`npm run check`、`git diff --check`、Lite 边界、ad-hoc 深层严格签名、DMG
完整性、包内 SQLite Node/CLI sqlite-vec、包内隔离 Gateway 全部通过。Gateway
initialize 与 Agent Guide 均实际返回 0.9.1；macOS Info.plist 的
CFBundleShortVersionString、ASAR package、源码、lockfile 和指南均为 0.9.1。

最终 ASAR 的 397 个文件与源码逐字节一致；比 .2 仅 core/gateway/docs.js
的指南版本更新，另有 package 元数据版本变化。共同理解功能回归已包含于本次
npm run check，没有重复执行未变化的五组包内测试。展开约 293.3 MiB。

本包未安装，未启动用户窗口、访问真实数据或调用真实模型；没有公证、上传、
提交推送。Hermes 客户端补丁仍不在 DMG 中，须重启 Hermes 后验证真实聊天身份。

## 第四次打包：0.9.2 / understanding-20261015.4

用户提供已安装 0.9.1 首页截图：含路径的长标题将摘要与按钮挤入固定动态线区域。
本次修复首页布局，改为文字、场景、最近活动依次正常占位；长文本换行、重复标签省略、
场景标记与 Canvas 同宽断点。变更契约见 HOME_SHARED_HORIZON.md 和 0.9.2 说明。

- 路径：`out/understanding-lite-20261015.4/ClaraCore-Desktop-0.9.2-understanding-20261015.4-lite-arm64.dmg`
- 大小：126341754 字节。
- SHA-256：`a92bfbeaa5ec75021141084b9c1941c9617734aadd4975371e95cb0b09f09a8a`。
- 同目录保存 `SHA256SUMS.txt` 和 `verification.json`。

本次 npm run check、diff 检查、Lite 包边界、ad-hoc 严格深层签名、DMG 校验、
包内 SQLite Node/CLI sqlite-vec、隔离 Gateway/指南通过，包版本、macOS Bundle、
lockfile 与指南均 0.9.2。397 个包内文件与源码逐字节一致；HTML 无重复 ID，
首页 DOM 的文字/场景/最近活动顺序及内嵌错误提示结构核对通过（不证明渲染几何）。

窗口回归已补 1440/1100/900/720 宽度、含路径和连续英文标题的布局断言，但没有
本轮窗口操作授权，因此未运行该窗口回归、浏览器或截图；CSS 修改仅源码审阅，
没有可用独立 CSS parser，不将源码与包验证冒充视觉通过。待用户手动安装后复核
同一长标题、按钮/动态线间隔、窄窗和深色主题。

原 .1/.2/.3 产物保留。本轮未启动用户窗口、安装、访问真实数据、调用真实模型、
提交推送或公开发布，仍为本地 ad-hoc 测试包。Hermes 客户端补丁不在 DMG 内。

## 0.9.2 用户安装后的只读检查

2026-10-15（Asia/Shanghai），用户表示已部署并要求测试，随后确认窗口打开后能正常保持。

- 安装目录 `/Applications/ClaraCore Desktop.app` 的 ASAR、macOS Bundle 均 0.9.2，
  flavor=lite，localBuildId=understanding-20261015.4；397 个文件哈希均匹配 .4 产物。
  已安装应用的深层严格签名检查通过。
- 最初 16:41 左右的检查未发现进程/50668 监听，MCP 返回 502；直接绕过代理的
  本地连接也明确拒绝。后续确认主进程 PID 16412 于 16:42:57 启动，路径为上述
  安装目录，同一 PID 监听 127.0.0.1:50668；初次不可用早于本次启动，不定为崩溃。
  当前用户 DiagnosticReports 下没有匹配 ClaraCore 名称的崩溃报告。
- 后续 `/health` HTTP 200/ok；认证 MCP initialize 实际返回版本 0.9.2，core
  tools/list 为 38 个，三个 understanding 工具齐全；Agent Guide 为 0.9.2。
- 使用本 chat 的真实 conversation ID 与独立验证 Client-ID，合成超预算 query
  在召回前返回 bounded_query_required；不存在的合成 submissionId 在缺会话头时
  返回 conversation_identity_required，带会话头时返回 submission_not_found。
  这些是预期拒绝探针，不是应用故障；未调用 submit、执行计划或外部模型，不证明
  Hermes 日用进程已加载客户端补丁或真实语义写回正确。
- 在同次 SQLite -readonly 连接中核对真实数据库路径为
  `/Users/zhouwei/Library/Application Support/claracore-desktop/data/claracore.db`，
  最新 desktop 启动事件为 08:42:57 UTC，与进程启动时间一致。自此启动至检查时，
  runtime_events 只有 1 条 desktop/info，无 warn/warning/error；只覆盖该表和该窗口，
  未读取业务记忆、知识正文或日志 metadata。

本次未启动、重启或操作用户窗口；接口探针会留下正常运维痕迹，不写业务测试数据。
用户目前只确认窗口保持打开，尚未确认长标题与动态线的实际显示。视觉仍待用户在
同一长标题下检查按钮/动态线间距，并按需复核窄窗/深色主题；不能把上述 API/日志
结果写成页面样式已通过验收。
