# 本地知识显式检索

## 入口与语义

- `knowledge_read(action=search, query, mode=exact|semantic|hybrid)`，默认 exact。原 `action=exact` 保持可用。IPC `searchKnowledge` 和知识页面共用实现。
- Agent 精确：大小写敏感的原文字面子串，扫描当前 Markdown 小节；MCP 保持严格匹配。
- 人用「按文字」及混合搜索的文字部分：去除查询首尾空格、忽略大小写，标题命中优先，其次为文档标题相关的小节，再为正文命中。仍为连续子串，不承诺分词或拼写纠错。IPC 强制使用此规则，不改变 Agent exact。
- 语义：查询与正文窗口余弦相似度，默认最低 0.55；每个小节取最高窗口分数。分数不是可信度或用户认同。
- 混合：精确与语义小节排名用 RRF（k=60）合并。语义失败返回 `partial`、具体错误及精确结果；零条精确结果仍是 partial。
- 默认 10、最多 50 条，offset 分页。返回路径/锚点、当前小节预览、来源/日期、匹配方式、索引状态和 `knowledge_read` 指针。来源仅提取该小节的来源行，不借用其他小节的归属。`date` 为小节日期，`documentDate` 单独读取文档 frontmatter 的 created，不能代替事实生效时间。`sourceLabel` 是移除链接 URL 的简短显示文字；原 `source` 仍有预算限制，完整来源通过 detailRef 读取原小节。
- 未开启自动回召或 Jev 路由。知识正文始终作为资料，不能成为 Agent 指令。

## 本机模型与可重建索引

沿用设置中的向量模型选择，但 Knowledge 独立限定本机计算。Full 支持包内 bge-small-zh-v1.5（512 维）；Lite 使用已安装的本机 Ollama。仅允许 127.0.0.1/::1 字面回环地址，无 URL 凭据或重定向。不会下载模型或调用远端兼容接口。

Ollama 使用 `/api/tags` 的模型 digest 识别版本，`/api/embed` 设置 `truncate:false`。接口依据 [Ollama Embed](https://docs.ollama.com/api/embed) 和 [List models](https://docs.ollama.com/api/tags)。本机响应有 15 秒超时及 4 MiB 上限。包内编码先检查 token 数，超过模型窗口明确失败。

正文按 Unicode 字符切成 256 字窗口，相邻重叠 32 字，覆盖完整小节。查询最长 500 字符，长查询分段编码后平均归一化。正文、模型配置或切分算法改变后必须重新建索引。运行中替换已加载的包内模型会要求重启后再建。

`knowledge_index_rebuild(semantic=true,batchSize=20)` 每批最多 50 窗口；返回 building 时显式继续调用。页面按钮可连续执行，暂停只阻止下一批。默认不带 semantic 仍是结构索引重建。

缓存位于 Desktop userData 下当前根目录的哈希目录。只保存正文哈希、模型身份、向量及小节指针，无正文副本。上限 6000 窗口、64 MiB；超限明确失败，精确检索仍可用。构建中间态可恢复，完整验证后才原子替换活动索引；失败保留原索引。并发建库锁不会被自动删除；异常退出遗留锁需先确认进程停止。不索引 inbox，不写真实正文。

## 状态与验证

`index_missing`、`index_stale`、`index_corrupt`、`model_changed`、`model_unavailable`、`model_disabled`、`local_model_required`、`invalid_embedding` 与正常 `no_results` 分开。结构状态中的 semantic=current 仅表示缓存对应当前正文；实际查询还验证模型与向量。

HCT-2026-09-08-01：混合失败显式 partial，不能静默当作成功或无结果；构建失败不能覆盖活动索引。
HCT-2026-09-08-02：长文尾段完整参与编码，小节仍以当前 MD 为准，来源不跨小节挪用。

`npm run test:knowledge` 包括确定性向量、临时 Ollama 协议服务和内存 DOM 检查；`npm run test:knowledge:semantic` 另跑真实包内模型概念排序。测试使用临时目录并清理服务；这些证据不替代真实语料质量、窗口交互及安装包验收。

## 0.8.1 真实语料基准

`node scripts/knowledge-quality-baseline.js --root /path/to/knowledge --cases /path/to/private-cases.json --model bge-m3:latest`

可选 `--seed-index /path/to/semantic.json` 只复制既有向量到临时目录复用；所有构建写入均在临时目录，结束清理，不修改知识正文或运行中索引。模型固定为显式指定的已安装本机 Ollama 模型，不下载或请求外网。

样例依据当前库内容人工选定，包含 10 条文字检索、6 条自然语言语义检索、4 条无结果查询。正例检查期望小节是否进入前三项，负例要求正常 no_results；模型失败、partial、源变化均不计通过。不是独立盲测或总体准确率，也不证明对话已采用知识。首次结果见 [0.8.1 说明](RELEASE_NOTES_V0.8.1.md)。

案例 JSON 为数组，每项包含 `id`、`query`、`mode`、`expected`（期望小节指针数组；空数组表示应无结果），可选 `textMatch`。真实库案例和逐项结果保留在本地，不随公开源码或安装包分发。
