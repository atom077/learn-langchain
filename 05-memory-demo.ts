import "dotenv/config";
import { createAgent, tool } from "langchain";
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";

const model = new ChatOpenAI({
  model: "deepseek-chat",
  apiKey: process.env.DEEPSEEK_API_KEY,
  configuration: { baseURL: "https://api.deepseek.com/v1" },
});

// ---- 简单工具 ----
const rememberNote = tool(
  ({ note }) => `已记录: ${note}`,
  {
    name: "remember_note",
    description: "记录一条备注信息，供后续对话引用",
    schema: z.object({
      note: z.string().describe("要记录的内容"),
    }),
  }
);

const agent = createAgent({
  model,
  tools: [rememberNote],
});

// ============================================================
// 演示 1: 无记忆 — 每次调用都是"失忆症患者"
// ============================================================
console.log("=".repeat(55));
console.log("🧪 演示 1: 无记忆 — 每次 invoke 都是全新的对话");
console.log("=".repeat(55));

// 第一轮：告诉 Agent 名字
const r1 = await agent.invoke({
  messages: [
    { role: "system", content: "你是友好的助手。用中文回复，简短。" },
    { role: "user", content: "我叫小明，记住这个名字。" },
  ],
});
console.log("第1轮:", lastContent(r1));

// 第二轮：问 Agent 我的名字（但不传历史！）
const r2 = await agent.invoke({
  messages: [
    { role: "system", content: "你是友好的助手。用中文回复，简短。" },
    { role: "user", content: "我叫什么名字？" },
  ],
});
console.log("第2轮:", lastContent(r2));
console.log("   ⚠️ Agent 不记得了！因为第2轮没有传入第1轮的消息。\n");

// ============================================================
// 演示 2: 有记忆 — 手动维护消息历史
// ============================================================
console.log("=".repeat(55));
console.log("🧪 演示 2: 手动记忆 — 把历史消息传给下一轮");
console.log("=".repeat(55));

// 把消息数组维护在外部，每次 invoke 后追加 AI 回复
let history: Array<{ role: string; content: string }> = [
  { role: "system", content: "你是友好的助手。用中文回复，简短。" },
];

// 第1轮
history.push({ role: "user", content: "我叫小明，记住这个名字。" });
const h1 = await agent.invoke({ messages: [...history] });
const h1Msg = { role: "assistant" as const, content: lastContent(h1) };
history.push(h1Msg);
console.log("第1轮:", lastContent(h1));

// 第2轮
history.push({ role: "user", content: "我叫什么名字？" });
const h2 = await agent.invoke({ messages: [...history] });
const h2Msg = { role: "assistant" as const, content: lastContent(h2) };
history.push(h2Msg);
console.log("第2轮:", lastContent(h2));
console.log("   ✅ Agent 记得了！因为历史中包含第1轮的对话。\n");

// 第3轮：引用之前的上下文
history.push({ role: "user", content: "用我之前告诉你的名字，写一句问候语。" });
const h3 = await agent.invoke({ messages: [...history] });
console.log("第3轮:", lastContent(h3));
console.log("   ✅ Agent 能引用多轮之前的上下文。\n");

// ============================================================
// 演示 3: 窗口记忆 — 只保留最近 N 条，控制 token 消耗
// ============================================================
console.log("=".repeat(55));
console.log("🧪 演示 3: 窗口记忆 — 只保留最近的消息，节省 token");
console.log("=".repeat(55));

// 模拟长对话后"遗忘"早期信息
let windowHistory: Array<{ role: string; content: string }> = [
  { role: "system", content: "你是友好的助手。用中文回复，简短。" },
  { role: "user", content: "我叫小明。" },
  { role: "assistant", content: "你好小明！" },
  { role: "user", content: "我喜欢看电影。" },
  { role: "assistant", content: "电影是个好爱好！" },
  { role: "user", content: "我最喜欢科幻片。" },
  { role: "assistant", content: "科幻片确实精彩。" },
  { role: "user", content: "我还喜欢打篮球。" },
  { role: "assistant", content: "篮球是很好的运动。" },
  // ... 很多轮对话后
];

// 只保留 system prompt + 最近 4 条消息（2 轮问答）
const WINDOW_SIZE = 5; // system(1) + 最近 4 条
const systemMsg = windowHistory[0];
const recentMsgs = windowHistory.slice(-(WINDOW_SIZE - 1));
const truncated = [systemMsg, ...recentMsgs];

console.log(`完整历史: ${windowHistory.length} 条消息`);
console.log(`窗口截断后: ${truncated.length} 条消息`);
console.log("截断后的消息:");
truncated.forEach((m, i) =>
  console.log(`  [${i}] ${m.role.padEnd(10)} | ${m.content.slice(0, 40)}`)
);

const wResult = await agent.invoke({
  messages: [
    ...truncated,
    { role: "user", content: "还记得我叫什么名字吗？" },
  ],
});
console.log("\nAgent 回答:", lastContent(wResult));
console.log("   ⚠️ 早期信息（名字）被窗口截掉了！\n");

// ============================================================
// 演示 4: 摘要记忆 — 压缩早期对话
// ============================================================
console.log("=".repeat(55));
console.log("🧪 演示 4: 摘要记忆 — 压缩早期对话为一段摘要");
console.log("=".repeat(55));

// 把窗口外的早期对话压缩成一段摘要，注入 system prompt
const earlySummary =
  "[对话摘要] 用户叫小明，喜欢看电影（尤其是科幻片）和打篮球。";

const summaryResult = await agent.invoke({
  messages: [
    {
      role: "system",
      content:
        "你是友好的助手。用中文回复，简短。\n" +
        `以下是之前对话的摘要，请记住: ${earlySummary}`,
    },
    ...recentMsgs,
    { role: "user", content: "推荐一部适合我的电影。" },
  ],
});
console.log("Agent 回答:", lastContent(summaryResult));
console.log("   ✅ Agent 通过摘要知道了用户喜欢科幻片！");

// ---- helper ----
function lastContent(r: { messages: Array<{ content: string }> }): string {
  return r.messages[r.messages.length - 1].content.slice(0, 200);
}
