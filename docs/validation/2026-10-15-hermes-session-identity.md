# Hermes 动态会话身份修复

2026-10-15 用户明确要求按 B 修复：由 Hermes MCP 客户端传入当前真实会话 ID，
不使用全局固定值，不放宽 ClaraCore submit/resume 的会话归属检查。

Hermes 源码根：`/Volumes/E61/Developer/Hermes/hermes-agent`，本机链接
`~/.hermes/hermes-agent` 指向该目录，基础 HEAD 为 `297552a9d64`，当前 detached。
原有 contributors 邮件文件修改和 `.web_dist-previous-*` 未跟踪目录均保留。
源码及文档变更尚未提交/推送。完整补丁见
[可恢复补丁](2026-10-15-hermes-session-identity.patch)，已做 reverse apply --check。

## 根因与修复

Hermes 正常工具分发已传真实 `session_id`，但 HTTP 连接只在建立时合并静态或
profile 身份头；同一连接会供多个会话使用，调用者 ID 没有进入请求头。

扩展原有通用 `identity_header`，新增 `value_from: session`，没有将 ClaraCore
产品逻辑硬编码进 Hermes。调用者 ID 在 RPC 入队前放入 SDK 的每消息传输
metadata.headers，HTTP 发出时再成为请求头，不进入工具参数或 JSON `_meta`。
不从进程全局环境借用其他会话 ID，不生成替代 ID；缺会话仍由服务端拒绝写回。
同一会话跨轮、重连保持一致，并发会话隔离；不同动态头映射不能复用同一连接。
跨域重定向剥离该身份头，同源保留；显式静态 headers 的既有优先级继续保留。

此模式要求 Streamable HTTP 与 MCP SDK 2.x。不支持的 SSE/旧 HTTP 不会悄悄
降级为固定会话。已有 static/profile 模式保留。

本机 `~/.hermes/config.yaml` 仅新增：

```yaml
mcp_servers:
  claracore-desktop:
    identity_header:
      name: X-ClaraCore-Conversation-ID
      value_from: session
```

原有连接标识为 `Agent-ID=lara`、`Client-ID=hermes`，没有改动。写配置前已
保存 0600 权限的逐字节备份并读回核对；写后比较完整解析结果，只有上述字段
发生变化。备份：`~/.hermes/config.yaml.bak-conversation-header-20261015T073520Z`。
模型、写入权限、自动采集和其他 Agent 配置未变。

## 验证

- 修复前新增的两条真实 HTTP/SDK/registry 行为测试均失败，收到 NONE。
- 修复后 7 个相关测试文件 **166 项通过**，包括动态 ID、跨轮/线程、重连、
  静态头优先级、跨域剥离、MCP 1.x/2.x 流形状、信任门禁、会话过期和 profile
  连接隔离。使用 `scripts/run_tests.sh`，临时 HERMES_HOME，关闭文件级重试。
- 修改和新增 Python 文件的 pinned Ruff 检查通过，`git diff --check` 通过。
- 全量 `python scripts/check` 运行 12 项，仅 profile-archives 失败：仓库原有
  `.cache/desktop-inputs/packager/builder/` 下 4 个 tar.gz 打包缓存被档案防护拦截。
  这些缓存早于本轮（7zip/icons 文件日期为 2026-09-28），本轮不删除、不改动；
  代码健康检查当次为 0 blocking、12 条原有 advisory。不能宣称全量静检通过。
- 最终补丁单独执行 `scripts/check --only health --base HEAD`，6 个 Python 文件
  为 0 blocking、0 advisory；没有通过改动规则绕过上述已有缓存问题。
- 独立无窗口验证进程通过实际 Hermes registry 与 SDK 连接已安装 ClaraCore。
  在隔离 Hermes SessionDB 创建一个真实验证会话，读取不存在的 submission：
  无会话 ID 返回 conversation_identity_required；动态传入及同会话重复调用均
  返回 submission_not_found，证明身份检查已通过。没有触发模型或业务记录写入。
  后者不等于计划、跨域写回或真实对话完整性验收。

HCT-2026-09-08-01：无 ID 不回退到启动进程的旧身份，失败显式保留；
HCT-2026-09-08-02：会话含义来自真实调用者，跨轮保持、不同会话隔离；不以
固定字符串混同多个聊天。这些是本次试行证据，不代表长期可靠性。

## 当前待办与配置建议

当前日用 Hermes 进程没有被 Agent 重启或热改。**需要用户重启 Hermes 后加载
新 Python 代码**；仅刷新已有 MCP 连接不保证替换已加载模块。之后再在实际
Hermes 聊天调用 resume 检查身份。ClaraCore 应用无需因本补丁重新打包。

动态会话身份与权限配置是独立维度。软件可以按稳定 Agent-ID 设置长期默认，
对话表达本次临时允许或限制；例如当前 Hermes 为 lara，Codex 为 codex，可
分别配置。多个角色若共用同一 Agent-ID，按该 ID 的规则才会覆盖这些角色。
建议后续采用全局默认、Agent 覆盖、会话临时范围；当前版本尚未实现这样的
理解层权限设置页，本轮不扩展 UI 或自动采集。原 8 次合成模型验收预算已用完，
修复会话头不会开启额外模型调用。
