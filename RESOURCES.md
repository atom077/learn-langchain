# LangChain.js 深度学习资源

## Knowledge

- [LangChain overview](https://docs.langchain.com/oss/javascript/langchain/overview)
  官方总览，当前主线是 `createAgent`、模型、工具、Middleware、LangGraph 和 LangSmith。用来校准课程整体地图。
- [Agents](https://docs.langchain.com/oss/javascript/langchain/agents)
  官方 Agent 核心组件说明，涵盖模型、工具、system prompt、结构化输出、Agent state、调用和 Middleware 入口。
- [Models](https://docs.langchain.com/oss/javascript/langchain/models)
  标准模型接口、Provider 切换、模型配置和运行时模型选择。用来理解 LangChain 如何保持模型可替换。
- [Tools](https://docs.langchain.com/oss/javascript/langchain/tools)
  工具定义、schema、运行时 context、动态工具选择和工具错误处理。用来设计可靠的 Agent 能力边界。
- [Structured output](https://docs.langchain.com/oss/javascript/langchain/structured-output)
  `responseFormat`、Provider strategy、Tool strategy 以及 `structuredResponse`。用来处理需要稳定数据契约的场景。
- [Short-term memory](https://docs.langchain.com/oss/javascript/langchain/short-term-memory)
  线程级状态、checkpointer、消息历史和上下文压缩。用来连接已有的 Memory 课程与当前 Agent API。
- [Middleware overview](https://docs.langchain.com/oss/javascript/langchain/middleware/overview)
  Middleware 的定位、Agent loop 扩展点和与 LangGraph 的组合方式。用来建立高级控制的总览。
- [Prebuilt middleware](https://docs.langchain.com/oss/javascript/langchain/middleware/built-in)
  重试、回退、摘要、人机协同、限流、PII、工具选择、上下文编辑等生产级预置能力。
- [Custom middleware](https://docs.langchain.com/oss/javascript/langchain/middleware/custom)
  `beforeModel`、`afterModel`、`wrapModelCall`、`wrapToolCall`、state schema 和 context schema 的官方细节。
- [LangGraph overview](https://docs.langchain.com/oss/javascript/langgraph/overview)
  LangChain Agent 的底层运行时与显式工作流框架。用来理解何时从 Agent harness 下沉到图编排。
- [Trace LangChain applications](https://docs.langchain.com/langsmith/trace-with-langchain)
  LangSmith 官方追踪指南，用来学习如何观察模型调用、工具调用和状态转移。
- [LangSmith evaluation types](https://docs.langchain.com/langsmith/evaluation-types)
  离线评测、单元测试、回归测试、基准测试和在线监控的分类。用来建立 Agent 质量闭环。
- [LangChain.js GitHub](https://github.com/langchain-ai/langchainjs)
  官方源码、变更和 API 实现。遇到文档未覆盖的行为时，用源码和测试交叉验证。

## Wisdom (Communities)

- [LangChain Forum](https://forum.langchain.com/)
  官方社区，适合比较架构选择、排查集成问题和阅读实践讨论。
- [LangChain Academy](https://academy.langchain.com/)
  官方课程和工作流训练材料，适合在完成本仓库的短课后进行系统练习。
- [LangChain.js Discussions](https://github.com/langchain-ai/langchainjs/discussions)
  官方仓库讨论区，适合查找 JavaScript/TypeScript 生态中的具体实现经验。

## Gaps

- 不同模型 Provider 对工具调用、原生结构化输出和流式事件的支持会变化；进入对应专题时再补充 Provider 官方文档。
- Middleware API 迭代较快；每节课保留官方文档链接，并在运行本地依赖时以当前 `package-lock.json` 为准。
