import "dotenv/config";
import { ChatOpenAI } from "@langchain/openai";
import {
  StateGraph,
  Annotation,
  MessagesAnnotation,
  START,
  END,
} from "@langchain/langgraph";

// ============================================================
// 配置 DeepSeek 模型
// ============================================================
const model = new ChatOpenAI({
  model: "deepseek-v4-flash",
  apiKey: process.env.DEEPSEEK_API_KEY,
  configuration: { baseURL: "https://api.deepseek.com/v1" },
});

// ============================================================
// 演示 1: 最简单的 LangGraph — 一条直线
// ============================================================
console.log("=".repeat(55));
console.log("🧪 演示 1: 线性图 — 两个节点串联，像一条流水线");
console.log("=".repeat(55));

// MessagesAnnotation 是最简单的 State：只有一个 messages 字段（数组，自动累积）
const linearGraph = new StateGraph(MessagesAnnotation)
  .addNode("think", (state) => {
    const lastMsg = state.messages[state.messages.length - 1];
    console.log(`  📍 think 节点: 收到 "${lastMsg.content}"`);
    return {
      messages: [
        { role: "assistant", content: "[思考] 正在分析用户意图..." },
      ],
    };
  })
  .addNode("reply", (state) => {
    console.log(`  📍 reply 节点: 处理中...`);
    return {
      messages: [
        { role: "assistant", content: "你好！我是 LangGraph Agent。👋" },
      ],
    };
  })
  .addEdge(START, "think") // 入口 → think
  .addEdge("think", "reply") // think → reply
  .addEdge("reply", END) // reply → 出口
  .compile();

const r1 = await linearGraph.invoke({
  messages: [{ role: "user", content: "你好，介绍一下自己" }],
});

console.log("\n  最终 state.messages:");
for (const msg of r1.messages) {
  console.log(`  [${msg._getType()}] ${msg.content}`);
}
console.log();

// ============================================================
// 演示 2: 自定义 State — 不只是 messages，还能追踪业务数据
// ============================================================
console.log("=".repeat(55));
console.log("🧪 演示 2: 自定义 State — 用 Annotation 定义复杂状态");
console.log("=".repeat(55));

// Annotation.Root() 定义自定义 state 结构 + 每个字段的合并策略
const CounterState = Annotation.Root({
  // 字段 1: messages（使用内置的 messages 合并逻辑）
  messages: Annotation<
    { role: string; content: string }[]
  >({
    reducer: (left, right) => left.concat(right), // 新消息追加到尾部
    default: () => [],
  }),
  // 字段 2: count（简单覆盖）
  count: Annotation<number>({
    reducer: (_, right) => right, // 新值替换旧值
    default: () => 0,
  }),
  // 字段 3: notes（数组累积）
  notes: Annotation<string[]>({
    reducer: (left, right) => [...left, ...right],
    default: () => [],
  }),
});

const counterGraph = new StateGraph(CounterState)
  .addNode("process", (state) => {
    const userMsg = state.messages
      .filter((m) => m.role === "user")
      .pop() as { role: string; content: string };

    const newCount = state.count + 1;
    const note = `第 ${newCount} 轮: "${userMsg.content.slice(0, 30)}"`;

    console.log(`  📍 process: count ${state.count} → ${newCount}, note: ${note}`);

    return {
      count: newCount,
      notes: [note],
      messages: [
        {
          role: "assistant",
          content: `已处理（第 ${newCount} 次对话）。你说了: "${userMsg.content.slice(0, 20)}..."`,
        },
      ],
    };
  })
  .addEdge(START, "process")
  .addEdge("process", END)
  .compile();

// 第一轮
let state = await counterGraph.invoke({
  messages: [{ role: "user", content: "第一轮：你好" }],
});
console.log(`  → count: ${state.count}, notes: ${state.notes.length} 条\n`);

// 第二轮：把上一轮的结果作为初始状态传入（模拟多轮）
state = await counterGraph.invoke({
  messages: [...state.messages, { role: "user", content: "第二轮：再聊一次" }],
  count: state.count,
  notes: state.notes,
});
console.log(`  → count: ${state.count}, notes: ${state.notes.length} 条\n`);

// ============================================================
// 演示 3: 条件分支 — 根据内容走不同路径
// ============================================================
console.log("=".repeat(55));
console.log("🧪 演示 3: 条件分支 — 路由函数决定下一步");
console.log("=".repeat(55));

const branchGraph = new StateGraph(MessagesAnnotation)
  // 分类节点
  .addNode("classify", (state) => {
    const msg = state.messages[state.messages.length - 1] as {
      content: string;
    };
    const text = msg.content.toLowerCase();

    let intent = "chat";
    if (text.includes("算") || text.includes("+") || text.includes("*")) {
      intent = "calculate";
    } else if (text.includes("时间") || text.includes("几点")) {
      intent = "time";
    }

    console.log(`  🔍 classify: "${msg.content}" → route to "${intent}"`);

    return {
      messages: [{ role: "assistant", content: `[路由: ${intent}]` }],
    };
  })
  // 三种处理节点
  .addNode("calculate", () => ({
    messages: [{ role: "assistant", content: "[计算] 我会帮你算。" }],
  }))
  .addNode("time", () => ({
    messages: [
      {
        role: "assistant",
        content: `[时间] 当前: ${new Date().toLocaleString("zh-CN")}`,
      },
    ],
  }))
  .addNode("chat", () => ({
    messages: [{ role: "assistant", content: "[聊天] 你好！有什么可以帮你？" }],
  }))
  // 布线
  .addEdge(START, "classify")
  .addConditionalEdges("classify", (state) => {
    const msg = state.messages[state.messages.length - 1] as {
      content: string;
    };
    const c = msg.content.toLowerCase();
    if (c.includes("calculate") || c.includes("算")) return "calculate";
    if (c.includes("time") || c.includes("时间")) return "time";
    return "chat";
  })
  .addEdge("calculate", END)
  .addEdge("time", END)
  .addEdge("chat", END)
  .compile();

// 测试三种输入
for (const input of [
  "帮我算一下 (3 + 5) * 2",
  "现在几点？",
  "介绍一下你自己",
]) {
  const r = await branchGraph.invoke({
    messages: [{ role: "user", content: input }],
  });
  const last = r.messages[r.messages.length - 1] as { content: string };
  console.log(`  🤖 ${last.content}\n`);
}

// ============================================================
// 总结对比
// ============================================================
console.log("=".repeat(55));
console.log("📊 LangGraph vs createAgent — 选型指南");
console.log("=".repeat(55));
console.log(`
┌──────────────────┬────────────────────────┬──────────────────────────┐
│                  │ createAgent (ReAct)    │ LangGraph                │
├──────────────────┼────────────────────────┼──────────────────────────┤
│ 控制方式          │ Agent 自主决策          │ 你显式定义图结构            │
│ 确定性            │ 低（LLM 可能走偏）       │ 高（代码决定执行路径）      │
│ 适合场景          │ 开放域对话、灵活任务     │ 固定工作流、审批流、Pipeline │
│ 状态              │ 隐式（消息历史）         │ 显式（State + reducers）   │
│ 可调试性          │ 看消息历史              │ 每个节点独立追踪             │
│ 并行/条件分支     │ 不支持                  │ 原生支持                    │
│ 人工介入          │ 不支持                  │ interrupt() 挂起等待        │
└──────────────────┴────────────────────────┴──────────────────────────┘

经验法则：
  「用户说"帮我做 X"」                     → createAgent（自主）
  「你规定"先 A → 根据结果选 B 或 C → D"」 → LangGraph（可控）
`);
