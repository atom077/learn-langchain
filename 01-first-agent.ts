import { calculate } from "./src/calculator.js";
import { createAgent, tool } from "langchain";
import { createDemoModel } from "./src/model.js";
import { z } from "zod";

// ---- 配置 DeepSeek 模型 ----
const model = createDemoModel();

// ---- 工具 1: 计算器 ----
const calculator = tool(
  ({ expression }) => {
    const result = calculate(expression);
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
const messages = result.messages;
const lastMsg = messages[messages.length - 1];
console.log("✅ Agent 回复:\n");
console.log(lastMsg.content);
