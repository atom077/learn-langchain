# CLAUDE.md — learn-langchain

LangChain.js 学习项目。用于教学演示和技能练习。

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
npx tsx <file>.ts        # 运行任意演示文件
```

## 关键依赖

- `langchain` — 主框架（`createAgent`, `tool`）
- `@langchain/openai` — OpenAI 兼容 ChatModel（用于 DeepSeek）
- `zod` — Tool schema 定义
- `dotenv` — 环境变量加载
- `tsx` — TypeScript 执行器

## 架构模式

- **Agent-first**：所有功能以 Agent + Tool 的方式实现
- **RAG via Tool**：检索封装为 `search_knowledge_base` tool，而非独立 Chain
- **Memory via 消息数组管理**：手动维护消息历史，Buffer / Window / Summary 三种策略
