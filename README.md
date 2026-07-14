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
└── lessons/                   # 课程 HTML 页面（含交互式测验）
    ├── 01-first-agent.html
    ├── 02-agent-internals.html
    ├── 03-tool-design.html
    ├── 04-rag.html
    ├── 05-memory.html
    ├── tool-design-reference.html
    └── style.css
```

## 技术栈

- **Runtime**: Node.js 20+, TypeScript
- **框架**: [LangChain.js](https://github.com/langchain-ai/langchainjs) v1.x (Agent-first API)
- **模型**: DeepSeek (deepseek-chat) via `@langchain/openai`
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
```

## 学习路线

| 编号 | 课程 | 核心概念 |
|------|------|---------|
| 01 | 第一个 Agent | `createAgent()`, `tool()`, Zod schema |
| 02 | Agent 内部机制 | ReAct 循环, 消息类型, `stream()` vs `invoke()` |
| 03 | 工具设计模式 | 复杂 Schema, 结构化错误, 异步工具, 描述法则 |
| 04 | RAG 检索增强 | Agent RAG, 检索策略, 防幻觉 |
| 05 | 对话记忆 | Buffer / Window / Summary Memory |
| 06 | 实战项目 | 综合 RAG + Memory + Tools（即将推出） |

## 环境变量

| 变量 | 说明 |
|------|------|
| `DEEPSEEK_API_KEY` | DeepSeek API Key ([获取地址](https://platform.deepseek.com/api_keys)) |

## 相关资源

- [LangChain.js 官方文档](https://docs.langchain.com/oss/javascript/langchain/overview)
- [Microsoft LangChain.js for Beginners](https://github.com/microsoft/langchainjs-for-beginners)
- [LangChain.js GitHub](https://github.com/langchain-ai/langchainjs)
