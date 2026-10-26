<p align="center"><img src="assets/brand/claracore-wordmark.svg" alt="ClaraCore" width="360"></p>

# 跨越对话，接着往下走。

ClaraCore Desktop 是供 AI 智能体使用的本地记忆与连续性工作区。
它把值得记住的事实、项目的当前位置和可追溯的资料留在你的电脑上，
让不同会话和客户端能够接着之前的工作继续。

[官网](https://xiaomao361.github.io/claracore-desktop/) · [下载](https://github.com/xiaomao361/claracore-desktop/releases/latest) · [文档](docs/README.md) · [English](README.md)

<img src="website/assets/continuity-art.webp" alt="连续的紫色丝带连接两个蓝色节点，象征不同对话之间的连续性。" width="760">

## 能做什么

| 模块 | 保存什么 |
| --- | --- |
| **Memoria · 记忆** | 确认过的事实、偏好、决定，以及记忆之间的关联。 |
| **Continuity · 共同线** | 一个可恢复目标的当前位置、依据和下一步。 |
| **InnerLife · 内在活动** | 可选的反思与建议，与已经确认的事实分开。 |
| **Knowledge · 知识** | 你选择的 Markdown 资料，保留来源、小节链接和检索入口。 |

智能体通过本机 MCP Gateway 接入。默认只取得足够继续工作的上下文，
需要更多时再明确读取某条记忆、共同线或资料小节。

<img src="docs/images/how-it-works.svg" alt="客户端经过本地 MCP Gateway 访问四个领域；结构数据保存在 SQLite，资料保留在所选 Markdown 目录。" width="900">

## 下载安装

当前版本为 **1.0.3**。Full 内置本地向量模型；Lite 不附带模型，
可以使用本机 Ollama，或者关闭向量能力。

| 版本 | macOS Apple Silicon | Windows x64 |
| --- | --- | --- |
| Full | [下载 DMG](https://github.com/xiaomao361/claracore-desktop/releases/download/v1.0.3/ClaraCore-Desktop-1.0.3-arm64.dmg) | [下载安装程序](https://github.com/xiaomao361/claracore-desktop/releases/download/v1.0.3/ClaraCore-Desktop-1.0.3-x64-Setup.exe) |
| Lite | [下载 DMG](https://github.com/xiaomao361/claracore-desktop/releases/download/v1.0.3/ClaraCore-Desktop-1.0.3-lite-arm64.dmg) | [下载安装程序](https://github.com/xiaomao361/claracore-desktop/releases/download/v1.0.3/ClaraCore-Desktop-1.0.3-lite-x64-Setup.exe) |

macOS 安装包已签名并公证，Windows 安装程序暂未签名。
校验清单和版本说明见 [Release](https://github.com/xiaomao361/claracore-desktop/releases/tag/v1.0.3)。
目前没有提供 Linux 和 Intel Mac 的预编译安装包。

## 三步接入

1. 安装并打开 Desktop。
2. 进入「智能体接入」，复制适合客户端的 MCP 配置。
3. 连接后调用 `claracore_connection_test`，再让智能体检索记忆或恢复指定共同线。

使用期间保持 Desktop 运行。默认地址为 `http://127.0.0.1:50668/mcp`，
实际地址和令牌以你的安装配置为准。完整步骤见 [入门指南](docs/GETTING_STARTED.md)。

## 数据与隐私

结构数据存放在本地 SQLite；知识正文保留在你选择的 Markdown 目录。
可选的模型服务会收到配置中相应的请求，连接的智能体也会得到它明确请求的上下文。
连接 MCP 本身不会安装会话钩子或采集全部聊天；自动上下文取决于宿主的集成。
InnerLife 可以关闭，生成内容不会自动成为已确认记忆。
详见 [隐私与数据](docs/PRIVACY.md) 和 [配置](docs/CONFIGURATION.md)。

## 参与开发

需要 Node.js 22 和 npm：

```sh
npm ci
npm run check
npm run start:next
```

`start:next` 打开隔离的开发实例。检查与测试方法见 [贡献指南](CONTRIBUTING.md)。
界面使用原生 JavaScript、HTML 和 CSS，核心为 Node.js / SQLite，使用 Electron Builder 打包。

- [架构](docs/ARCHITECTURE.md) · [代码地图](docs/CODE_MAP.md)
- [智能体接入契约](docs/AGENT_MCP_PLAYBOOK.md) · [更新记录](CHANGELOG.md)
- [提交问题](https://github.com/xiaomao361/claracore-desktop/issues) · [安全问题](SECURITY.md)

## 许可

采用 [MIT 许可证](LICENSE)。第三方依赖和随包模型遵循各自的许可。
