# Learn LangChain.js

中文 LangChain.js / LangGraph 实践课程：13 个 TypeScript 演示与交互式 HTML 讲义，从 Agent、工具、RAG、记忆到工作流与 Middleware。

这是社区学习项目，适合有 JavaScript/TypeScript 基础的读者。示例用于理解 API 和工程模式；涉及公司政策、账户、个人笔记与用户档案的示例数据均为教学用途。依赖版本以 `package-lock.json` 为准。

## 快速开始

需要 **Node.js 22 或更新版本**和 npm，CI 覆盖 Node.js 22、24。

```bash
git clone https://github.com/atom077/learn-langchain.git
cd learn-langchain
nvm use                 # 可选：已安装 nvm 时使用
npm ci
npm run demo:13         # 离线 Middleware 演示，无需密钥
npm run check           # 类型、单元测试、本地链接与离线演示
```

可直接在浏览器打开 [第 1 课](lessons/01-first-agent.html)，通过页底链接逐课阅读。HTML 讲义无需模型服务。

## 运行真实模型示例

第 01–12 课需要 DeepSeek 账户。先复制配置，再在本地填写 API Key 和账户可用的模型 ID：

```bash
cp .env.example .env
# 编辑 .env，填写 DEEPSEEK_API_KEY 和 DEEPSEEK_MODEL
npm start               # 第 01 课
npm run demo:02         # 第 02 课，其余依次为 demo:03 至 demo:13
npm run demo:06         # 交互式个人助手；输入 /exit 退出
```

| 环境变量 | 用途 |
| --- | --- |
| `DEEPSEEK_API_KEY` | DeepSeek API Key，从 [DeepSeek 平台](https://platform.deepseek.com/) 获取 |
| `DEEPSEEK_MODEL` | 账户当前可用且支持工具调用的模型 ID；请按服务商控制台填写 |

模型配置集中在 [src/model.ts](src/model.ts)。缺少配置或仍为占位符时会在请求前报错。每次请求最多等待 60 秒、最多重试 2 次；多轮演示仍可能持续更长时间。

**费用与数据：**在线示例会多次调用模型并产生费用，提示词、工具结果和输入数据会发送到 DeepSeek。请使用示例数据，不要输入内部资料或敏感信息。模型生成结果具有不确定性，讲义中的输出仅供参考。

## 课程导航

| 编号 | 课程 | 核心概念 |
|------|------|---------|
| 01 | [第一个 Agent](lessons/01-first-agent.html) | `createAgent()`, `tool()`, Zod schema |
| 02 | [Agent 内部机制](lessons/02-agent-internals.html) | ReAct 循环, 消息类型, `stream()` vs `invoke()` |
| 03 | [工具设计模式](lessons/03-tool-design.html) | 复杂 Schema, 结构化错误, 异步工具, 描述法则 |
| 04 | [RAG 检索增强](lessons/04-rag.html) | Agent RAG, 检索策略, 防幻觉 |
| 05 | [对话记忆](lessons/05-memory.html) | Buffer / Window / Summary Memory |
| 06 | [实战项目](lessons/06-capstone.html) | 个人 AI 助手：RAG + Memory + Tools 综合应用 |
| 07 | [LangGraph 入门](lessons/07-langgraph-intro.html) | StateGraph、Annotation、条件分支、状态管理 |
| 08 | [LangGraph Agent](lessons/08-langgraph-agent.html) | LLM 节点 + 工具节点、手动 ReAct、注入审核/日志 |
| 09 | [多 Agent 协作](lessons/09-multi-agent.html) | Pipeline、Router、Supervisor 三种协作模式 |
| 10 | [Human-in-the-loop](lessons/10-human-in-the-loop.html) | interrupt + Command、MemorySaver、审批工作流 |
| 11 | [长期记忆](lessons/11-long-term-memory.html) | Store API(put/get/search)、Memory生命周期、跨线程共享 |
| 12 | [Mem0 对比实验](lessons/12-mem0-comparison.html) | Store API vs Mem0 风格模拟器（非 SDK 集成） |
| 13 | [Agent Harness 与 Middleware](lessons/13-modern-agent-harness.html) | Agent loop 扩展点、state/context、node-style 与 wrap-style hooks |

## 示例边界

- 第 04 课是内存中的关键词检索，未接入向量数据库。
- 第 06 课的笔记、第 10–12 课的 MemorySaver / InMemoryStore 仅在进程内保存；跨线程共享不等于重启后持久化。
- 第 12 课使用本地 Mem0 风格模拟器，并未接入真实 Mem0 SDK 或云服务，也不需要 MEM0_API_KEY。
- 计算器只解析数字和 `+ - * / % ()`，不执行模型生成的 JavaScript。
- 本项目不包含生产部署、身份鉴权或租户隔离。生产集成前需根据实际业务补充这些能力。

## 项目结构

- `01-*.ts` 至 `13-*.ts`：独立课程示例，与 `npm run demo:XX` 对应。
- [lessons/](lessons/)：中文 HTML 讲义、测验及共享样式。
- [src/](src/)：共享模型配置、计算器及工具返回值适配。
- [tests/](tests/)：不调用模型服务的单元测试。
- [reference/](reference/)：概念与 API 速查。
- [MISSION.md](MISSION.md)、[NOTES.md](NOTES.md)、[RESOURCES.md](RESOURCES.md)：课程目标、范围和官方参考资源。
- [learning-records/](learning-records/)：课程演进记录，不记录个人学习状态。

## 常见问题

- **Node 版本不满足要求：**运行 `node --version` 检查，再切换至 22 或更新版本并执行 `npm ci`。
- **401 / 403：**在服务商平台检查密钥与账户权限；不要把密钥贴到 Issue。
- **模型不可用 / 不支持工具：**检查 `DEEPSEEK_MODEL`，选择账户实际可用且支持工具调用的模型。
- **429 / 超时：**检查额度和限流，稍后重试；可先用 `npm run demo:13` 验证本地环境。
- **进程重启后记忆消失：**本仓库的 Store 与 checkpointer 使用内存实现，这是示例的预期行为。

## 贡献、来源与许可

欢迎提交问题和改进，见 [CONTRIBUTING.md](CONTRIBUTING.md)。安全问题见 [SECURITY.md](SECURITY.md)。教学框架与参考来源见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

本仓库沿用项目已声明的 **ISC License**，许可正文见 [LICENSE](LICENSE)。第三方依赖及外链内容各自遵循其许可。
