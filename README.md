# Learn LangChain.js

LangChain.js 系统学习项目 — 从零到掌握 Agent 开发，覆盖 Agent 架构、工具设计、RAG、对话记忆等核心模块。

## 项目结构

```
learn-langchain/
├── 01-first-agent.ts          # Lesson 01: 第一个 Agent（createAgent + tool）
├── 02-stream-demo.ts          # Lesson 02: ReAct 循环、消息类型、流式输出
├── 03-tool-design-demo.ts     # Lesson 03: 复杂 Schema、结构化错误、异步工具
├── 04-rag-demo.ts             # Lesson 04: RAG 检索增强生成
├── 05-memory-demo.ts          # Lesson 05: 对话记忆（Buffer/Window/Summary）
├── 06-capstone.ts             # Lesson 06: 实战项目 — 个人 AI 助手
├── 07-langgraph-intro.ts      # Lesson 07: LangGraph 入门 — 有状态工作流
├── 08-langgraph-agent.ts      # Lesson 08: LangGraph Agent — LLM + Tool 节点
├── 09-multi-agent.ts           # Lesson 09: 多 Agent 协作 — Pipeline/Router/Supervisor
├── 10-human-in-the-loop.ts     # Lesson 10: Human-in-the-loop — interrupt/Command
├── 11-long-term-memory.ts      # Lesson 11: 长期记忆 — Store API 跨线程持久化
├── 12-mem0-comparison.ts       # Lesson 12: Mem0 对比实验 — Store API vs Mem0
└── lessons/                   # 课程 HTML 页面（含交互式测验）
    ├── 01-first-agent.html
    ├── 02-agent-internals.html
    ├── 03-tool-design.html
    ├── 04-rag.html
    ├── 05-memory.html
    ├── 06-capstone.html
    ├── 07-langgraph-intro.html
    ├── 08-langgraph-agent.html
    ├── 09-multi-agent.html
    ├── 10-human-in-the-loop.html
    ├── 11-long-term-memory.html
    ├── 12-mem0-comparison.html
    ├── tool-design-reference.html
    └── style.css
```

## 技术栈

- **Runtime**: Node.js 20+, TypeScript
- **框架**: [LangChain.js](https://github.com/langchain-ai/langchainjs) v1.x (Agent-first API)
- **模型**: DeepSeek (deepseek-v4-flash) via `@langchain/openai`
- **Schema 校验**: Zod
- **运行工具**: tsx

## 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 配置 API Key
cp .env.example .env
# 编辑 .env，填入 DEEPSEEK_API_KEY

# 3. 运行各课演示
npm start              # 课 01
npm run demo:02        # 课 02: 流式输出
npm run demo:03        # 课 03: 工具设计
npm run demo:04        # 课 04: RAG
npm run demo:05        # 课 05: Memory
npm run demo:06        # 课 06: 实战项目
npm run demo:07        # 课 07: LangGraph 入门
npm run demo:08        # 课 08: LangGraph Agent
npm run demo:09        # 课 09: 多 Agent 协作
npm run demo:10        # 课 10: Human-in-the-loop
npm run demo:11        # 课 11: 长期记忆
npm run demo:12        # 课 12: Mem0 对比实验
```

## 学习路线

| 编号 | 课程 | 核心概念 |
|------|------|---------|
| 01 | 第一个 Agent | `createAgent()`, `tool()`, Zod schema |
| 02 | Agent 内部机制 | ReAct 循环, 消息类型, `stream()` vs `invoke()` |
| 03 | 工具设计模式 | 复杂 Schema, 结构化错误, 异步工具, 描述法则 |
| 04 | RAG 检索增强 | Agent RAG, 检索策略, 防幻觉 |
| 05 | 对话记忆 | Buffer / Window / Summary Memory |
| 06 | 实战项目 | 个人 AI 助手：RAG + Memory + Tools 综合应用 |
| 07 | LangGraph 入门 | StateGraph、Annotation、条件分支、状态管理 |
| 08 | LangGraph Agent | LLM 节点 + 工具节点、手动 ReAct、注入审核/日志 |
| 09 | 多 Agent 协作 | Pipeline、Router、Supervisor 三种协作模式 |
| 10 | Human-in-the-loop | interrupt + Command、MemorySaver、审批工作流 |
| 11 | 长期记忆 | Store API(put/get/search)、Memory生命周期、跨线程共享 |
| 12 | Mem0 对比实验 | Store API vs Mem0，同一场景两种实现，选型决策 |

## 环境变量

| 变量 | 说明 |
|------|------|
| `DEEPSEEK_API_KEY` | DeepSeek API Key ([获取地址](https://platform.deepseek.com/api_keys)) |

## 相关资源

- [LangChain.js 官方文档](https://docs.langchain.com/oss/javascript/langchain/overview)
- [Microsoft LangChain.js for Beginners](https://github.com/microsoft/langchainjs-for-beginners)
- [LangChain.js GitHub](https://github.com/langchain-ai/langchainjs)
