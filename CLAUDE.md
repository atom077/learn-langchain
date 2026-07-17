# CLAUDE.md — learn-langchain

LangChain.js 学习项目，用于教学演示和技能练习。

> 本项目基于 Matt Pocock 的 [teach skill](https://github.com/mattpocock/skills/blob/main/skills/productivity/teach/SKILL.md) 教学框架构建。
> 教学 workspace 位于 `~/.claude/skills/teach/`，包含 MISSION.md、GLOSSARY.md、学习记录等。
> 课程 HTML 页面遵循 teach skill 的课程格式规范（Tufte 风格、知识检查、推荐阅读等）。

## 项目约定

- TypeScript 源码，使用 `tsx` 运行（无需编译）
- 模型：DeepSeek (deepseek-chat)，通过 `@langchain/openai` 的 `ChatOpenAI` + 自定义 `baseURL` 接入
- API Key 通过 `.env` 文件配置，不硬编码
- 每个 `.ts` 文件是独立的演示，可直接 `npx tsx <file>.ts` 运行
- 文件命名：`<编号>-<描述>.ts`，编号对应课程编号

## 常用命令

```bash
npm install              # 安装依赖
npm start                # 运行课 01
npm run demo:02          # 运行课 02
npm run demo:03          # 运行课 03
npm run demo:04          # 运行课 04
npm run demo:05          # 运行课 05
npm run demo:06          # 运行课 06（实战项目）
npm run demo:07          # 运行课 07（LangGraph 入门）
npm run demo:08          # 运行课 08（LangGraph Agent）
npm run demo:09          # 运行课 09（多 Agent 协作）
npx tsx <file>.ts        # 运行任意演示文件
```

## 关键依赖

- `@langchain/langgraph` — LangGraph.js（StateGraph、条件分支、多 Agent 编排）
- `langchain` — 主框架（`createAgent`, `tool`）
- `@langchain/openai` — OpenAI 兼容 ChatModel（用于 DeepSeek）
- `zod` — Tool schema 定义
- `dotenv` — 环境变量加载
- `tsx` — TypeScript 执行器

## 架构模式

- **Agent-first**：所有功能以 Agent + Tool 的方式实现
- **RAG via Tool**：检索封装为 `search_knowledge_base` tool，而非独立 Chain
- **Memory via 消息数组管理**：手动维护消息历史，Buffer / Window / Summary 三种策略
- **Graph-based workflows (LangGraph)**：显式定义节点、边、条件分支，构建有状态的 Agent 工作流
