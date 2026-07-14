import "dotenv/config";
import { createAgent, tool } from "langchain";
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";

// ---- 配置 DeepSeek 模型 ----
const model = new ChatOpenAI({
  model: "deepseek-chat",
  apiKey: process.env.DEEPSEEK_API_KEY,
  configuration: {
    baseURL: "https://api.deepseek.com/v1",
  },
});

// ---- 工具 ----
const getCurrentTime = tool(
  () => new Date().toISOString(),
  {
    name: "get_current_time",
    description: "获取当前的日期和时间（ISO 8601 格式）",
    schema: z.object({}),
  }
);

const calculator = tool(
  ({ expression }) => {
    const result = Function(`"use strict"; return (${expression})`)();
    return JSON.stringify({ expression, result });
  },
  {
    name: "calculator",
    description: "执行数学计算。expression 是一个数学表达式",
    schema: z.object({
      expression: z.string().describe("数学表达式，如 '2 + 3 * 4'"),
    }),
  }
);

// ---- 创建 Agent ----
const agent = createAgent({
  model,
  tools: [calculator, getCurrentTime],
});

// ============================================================
// 演示 1: stream() — 观察每一步推理过程
// ============================================================
console.log("=".repeat(50));
console.log("📡 流式输出 — 实时观察 Agent 每一步推理");
console.log("=".repeat(50));

const stream = await agent.stream({
  messages: [
    {
      role: "system",
      content: "你是一个简洁的助手。用中文回复。每次回答不超过 3 句话。",
    },
    {
      role: "user",
      content: "帮我算 100 ÷ 3，保留两位小数。再告诉我现在几点。",
    },
  ],
});

let step = 0;
for await (const chunk of stream) {
  step++;
  const [source] = Object.keys(chunk) as string[];
  const payload = (chunk as Record<string, { messages: Array<{ content?: string; type?: string; tool_calls?: Array<{ name: string; args: unknown }> }> }>)[source];

  console.log(`\n── Step ${step}: [${source}] ──`);

  for (const msg of payload.messages) {
    // @ts-expect-error - LangChain internal _getType
    const msgType = typeof msg._getType === "function" ? msg._getType() : msg.type ?? "?";

    if (msgType === "ai" && msg.tool_calls?.length) {
      console.log("🤔 思考 → 调用工具:", msg.tool_calls.map((tc) => tc.name).join(", "));
    } else if (msgType === "tool") {
      const preview = typeof msg.content === "string" ? msg.content.slice(0, 60) : "";
      console.log("🔧 工具返回:", preview);
    } else if (msgType === "ai" && msg.content) {
      console.log("💬 最终回答:", msg.content.slice(0, 100));
    }
  }
}

// ============================================================
// 演示 2: 分析最终消息历史 — 理解每条消息的角色
// ============================================================
console.log("\n" + "=".repeat(50));
console.log("📋 invoke() 返回的完整消息历史");
console.log("=".repeat(50));

const result = await agent.invoke({
  messages: [
    {
      role: "system",
      content: "你是一个总是先算一遍再确认的助手。用中文回复。",
    },
    {
      role: "user",
      content: "1 + 1 等于几？",
    },
  ],
});

const messages = result.messages as Array<{
  _getType?: () => string;
  content?: string;
  name?: string;
  tool_calls?: Array<{ name: string; args: unknown }>;
}>;

console.log(`共 ${messages.length} 条消息:\n`);
for (let i = 0; i < messages.length; i++) {
  const m = messages[i];
  const msgType = m._getType?.() ?? "?";
  const contentPreview =
    typeof m.content === "string"
      ? m.content.slice(0, 100).replace(/\n/g, " ")
      : JSON.stringify(m.content)?.slice(0, 60) ?? "";
  const tcInfo = m.tool_calls?.length
    ? ` [tool_calls: ${m.tool_calls.map((tc) => tc.name).join(", ")}]`
    : "";

  console.log(`[${i}] ${msgType.padEnd(8)} | ${contentPreview}${tcInfo}`);
}
