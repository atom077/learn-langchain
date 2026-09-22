import "dotenv/config";
import { createAgent, tool } from "langchain";
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";

// ---- 配置 DeepSeek 模型 ----
// DeepSeek 提供 OpenAI 兼容 API（这个端点更成熟稳定）
const model = new ChatOpenAI({
  model: "deepseek-v4-flash", // DeepSeek-V3 对话模型
  apiKey: process.env.DEEPSEEK_API_KEY,
  configuration: {
    baseURL: "https://api.deepseek.com/v1",
  },
});

// ---- 工具 1: 计算器 ----
const calculator = tool(
  ({ expression }) => {
    // ⚠️ 生产环境不要用 eval，这里仅为演示
    const result = Function(`"use strict"; return (${expression})`)();
    return JSON.stringify({ expression, result });
  },
  {
    name: "calculator",
    description: "执行数学计算。expression 是一个数学表达式，如 '2 + 3 * 4'",
    schema: z.object({
      expression: z.string().describe("数学表达式，如 '2 + 3 * 4'"),
    }),
  }
);

// ---- 工具 2: 获取当前时间 ----
const getCurrentTime = tool(
  () => new Date().toISOString(),
  {
    name: "get_current_time",
    description: "获取当前的日期和时间（ISO 8601 格式）",
    schema: z.object({}),
  }
);

// ---- 创建 Agent ----
const agent = createAgent({
  model,
  tools: [calculator, getCurrentTime],
});

// ---- 运行 ----
console.log("🤖 Agent 启动，正在推理...\n");

const result = await agent.invoke({
  messages: [
    {
      role: "user",
      content: "现在是几点？然后帮我算一下 15 * 37 + 200 等于多少。",
    },
  ],
});

// 输出最终回复
const messages = result.messages as Array<{ role: string; content: string }>;
const lastMsg = messages[messages.length - 1];
console.log("✅ Agent 回复:\n");
console.log(lastMsg.content);
