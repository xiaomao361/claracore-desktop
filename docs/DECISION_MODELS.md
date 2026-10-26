# 通用决策模型

支持两种服务商：OpenAI 兼容接口与 TypeSafe/Jev。用户可停用 Jev，保留决策模型配置能力。

## 配置

在智能能力 → 决策模型中选择服务商，填写 API 基础地址、模型名称、密钥并保存。模型名可以手动填写，获取模型列表是可选操作。OpenAI 兼容默认地址是 `https://api.openai.com/v1`，自定义地址需要包含完整 API 前缀；仅允许 HTTPS 或 localhost/127.0.0.1/::1 的 HTTP。不选择默认模型，也不隐式复用聊天或向量模型的凭据。

关闭 / 观察 / 采用建议分别控制零自动调用、只记录建议、可选实际路由。手动获取和连接测试即使关闭也可能请求所选服务；测试仅发送固定公开查询。采用建议仍需要宿主协商 `memory-knowledge-v1`，明确 domain/mode 优先，失败保留现有本地检索。Memory-only 宿主不会因切换服务商而获得知识投递能力。

切换服务或地址后需要保存独立配置。旧 TypeSafe 密钥不发送给新服务；切回原绑定可保留密钥。输入框留空保留当前绑定的已保存密钥，勾选删除只影响当前绑定。密钥使用 Electron safeStorage 加密；系统安全存储不可用时不降级为明文。

## 响应与失败

兼容适配使用 POST `/chat/completions`、`stream=false`、`response_format={type:json_object}`，只发送固定分类规则和一个有界查询。预期 JSON 包含 recall_domain 与 knowledge_search_mode，每项为 choice/confidence；本机验证选项、有限数值与范围。不支持 JSON 模式的端点返回明确错误，不偷偷改用自由文本。JSON 有效不保证语义与字段正确，仍需要本机验证，见 [官方结构化输出说明](https://developers.openai.com/api/docs/guides/structured-outputs)。

通用模型的置信度是模型自报值，标记 `confidenceSource=model_self_reported`，不是 Jev 概率分布，也不是校准正确率。保守门槛只是路由门槛；模型收益需真实对照，不因解析成功而成立。

模型列表使用 GET `/models` 的 data[].id，最多展示 100 项，失败不改变手填模型；TypeSafe 保留专用接口。响应有字节上限，拒绝/输出截断/格式错误、超时、鉴权、限流、HTTP 错误分别可见，错误不泄露响应正文、密钥或查询内容。

## 兼容和验证

旧配置未包含 provider 时按 TypeSafe 读取；新安装默认 OpenAI 兼容且关闭。保留旧 IPC 名称、文件名和 Gateway 的 jev 字段，核心适配器在 `core/decision-model/service.js`。现有配置状态不因源码改造自动修改，用户切换服务需显式保存。
