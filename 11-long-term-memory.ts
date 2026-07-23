import "dotenv/config";
import { ChatOpenAI } from "@langchain/openai";
import {
  StateGraph,
  Annotation,
  MessagesAnnotation,
  START,
  END,
  InMemoryStore,
  getStore,
  MemorySaver,
} from "@langchain/langgraph";

const model = new ChatOpenAI({
  model: "deepseek-chat",
  apiKey: process.env.DEEPSEEK_API_KEY,
  configuration: { baseURL: "https://api.deepseek.com/v1" },
});

// ============================================================
// 演示 1: Store API 基础 — 命名空间、增删查
// ============================================================
console.log("=".repeat(55));
console.log("🧪 演示 1: Store API — 持久化键值存储");
console.log("=".repeat(55));

const store = new InMemoryStore();

// put: 写入 — 三级路径: [namespace, id] + key
await store.put(["users", "user-001"], "profile", {
  name: "小明",
  email: "xiaoming@example.com",
  preferences: { language: "zh", notifications: true },
});
await store.put(["users", "user-002"], "profile", {
  name: "小红",
  email: "xiaohong@example.com",
  preferences: { language: "en", notifications: false },
});

// get: 精确读取
const p1 = await store.get(["users", "user-001"], "profile");
console.log("get users/user-001:", (p1?.value as any)?.name);

// search: 按命名空间前缀搜索
const allUsers = await store.search(["users"], { limit: 10 });
console.log("search users/*:", allUsers.map((i) => (i.value as any).name).join(", "));

// 组织数据的最佳实践: 用命名空间分层
await store.put(["memories", "user-001", "facts"], "job", {
  value: "高级前端工程师",
  source: "conversation-2026-07",
});
await store.put(["memories", "user-001", "facts"], "project", {
  value: "AI Agent 平台",
  source: "conversation-2026-07",
});
await store.put(["memories", "user-001", "preferences"], "tone", {
  value: "简洁",
  confidence: 0.9,
});

// search 支持跨命名空间
const allFacts = await store.search(["memories", "user-001", "facts"]);
console.log(
  "用户 facts:",
  allFacts.map((i) => `${i.key}: ${(i.value as any).value}`).join(", ")
);

console.log();

// ============================================================
// 演示 2: Memory-Aware Agent — 加载→使用→提取→保存
// ============================================================
console.log("=".repeat(55));
console.log("🧪 演示 2: Memory 生命周期 — 加载→使用→提取→保存");
console.log("=".repeat(55));
console.log("  架构: 每个请求: Load Profile → Agent处理 → Extract & Save\n");

const memoryStore = new InMemoryStore();

// 预置用户档案
await memoryStore.put(["users", "current"], "profile", {
  name: "小明",
  bio: "AI平台组高级前端工程师，负责 Agent 平台前端架构",
  preferences: { tone: "简洁直接", detail: "中等" },
  facts: [
    "在用 LangChain.js + LangGraph 构建 AI Agent 平台",
    "喜欢早晨 coding，效率最高",
    "最近在学习系统设计和分布式系统",
  ],
  conversationCount: 0,
});

const MemoryState = Annotation.Root({
  messages: Annotation<any[]>({
    reducer: (l, r) => l.concat(r),
    default: () => [],
  }),
  memoryContext: Annotation<string>({
    reducer: (_, r) => r,
    default: () => "",
  }),
});

// 1️⃣ Load: 从 Store 加载用户记忆
const loadNode = async (state: typeof MemoryState.State) => {
  const st = getStore();
  const profile = await st.get(["users", "current"], "profile");
  if (!profile) return { memoryContext: "" };

  const p = profile.value as any;
  const ctx = [
    `用户: ${p.name} (${p.bio})`,
    `偏好: ${p.preferences.tone}, 详细度: ${p.preferences.detail}`,
    `已知: ${p.facts.join(" | ")}`,
  ].join("\n");

  return {
    memoryContext: ctx,
    messages: [
      { role: "system", content: `你是个人助手。关于用户:\n${ctx}\n\n用${p.preferences.tone}的风格回复。` },
    ],
  };
};

// 2️⃣ Agent: 使用记忆上下文处理请求
const respondNode = async (state: typeof MemoryState.State) => {
  const sysMsg = state.messages.find((m) => (m as any).role === "system") as any;
  const userMsg = state.messages
    .filter((m) => (m as any).role === "user")
    .pop() as any;

  const response = await model.invoke([
    { role: "system", content: sysMsg?.content },
    { role: "user", content: userMsg?.content },
  ]);
  return { messages: [response] };
};

// 3️⃣ Extract & Save: 从对话中提取新信息
const saveNode = async (state: typeof MemoryState.State) => {
  const st = getStore();
  const profile = await st.get(["users", "current"], "profile");
  if (!profile) return {};

  const p = profile.value as any;
  const userMsg = state.messages
    .filter((m) => (m as any).role === "user")
    .pop() as any;
  const input = (userMsg?.content || "") as string;

  // 用 LLM 提取新的事实
  const extractPrompt = `从用户消息中提取新的事实信息。只提取明确陈述的事实，不要推断。
用户消息: "${input}"
已知事实: ${JSON.stringify(p.facts)}

如果消息中包含新的事实（不在已知事实中），用 JSON 数组返回。如果没有新事实，返回空数组 []。
只返回 JSON 数组，不要其他文字。`;

  const extraction = await model.invoke([
    { role: "user", content: extractPrompt },
  ]);

  try {
    const jsonStr = ((extraction.content as string) || "[]")
      .replace(/```json|```/g, "")
      .trim();
    const newFacts: string[] = JSON.parse(jsonStr);

    if (newFacts.length > 0) {
      console.log(`  💾 提取到新事实: ${newFacts.join(", ")}`);
      const updated = {
        ...p,
        facts: [...p.facts, ...newFacts],
        conversationCount: p.conversationCount + 1,
        updatedAt: new Date().toISOString(),
      };
      await st.put(["users", "current"], "profile", updated);
    }
  } catch {
    // LLM 返回格式不对，跳过
  }

  return {};
};

const memoryGraph = new StateGraph(MemoryState)
  .addNode("load", loadNode)
  .addNode("respond", respondNode)
  .addNode("save", saveNode)
  .addEdge(START, "load")
  .addEdge("load", "respond")
  .addEdge("respond", "save")
  .addEdge("save", END)
  .compile({ checkpointer: new MemorySaver(), store: memoryStore });

const tid = "memory-demo";
const cfg = { configurable: { thread_id: tid } };

// 多轮对话: 记忆在每轮中累积
const conversations = [
  "你好，我今天学了 Rust 语言",
  "推荐一些跟我工作相关的学习资源",
  "帮我记一下：下周要做 Q3 Review 的 PPT",
  "总结一下你知道关于我的所有信息",
];

for (const input of conversations) {
  console.log(`\n  👤 ${input}`);
  const r = await memoryGraph.invoke(
    { messages: [{ role: "user", content: input }], memoryContext: "" },
    cfg
  );
  const last = r.messages[r.messages.length - 1] as any;
  console.log(`  🤖 ${(last.content || "").slice(0, 200)}`);
}

// 验证持久化
const finalProfile = await memoryStore.get(["users", "current"], "profile");
console.log(`\n  📊 记忆统计:`);
console.log(`    对话次数: ${(finalProfile?.value as any).conversationCount}`);
console.log(`    已知事实: ${(finalProfile?.value as any).facts.length} 条`);
console.log(`    事实列表: ${(finalProfile?.value as any).facts.join(" | ")}\n`);

// ============================================================
// 演示 3: 跨线程共享记忆 — 多个对话线程共享同一个 Store
// ============================================================
console.log("=".repeat(55));
console.log("🧪 演示 3: 跨线程记忆 — 不同对话共享长期记忆");
console.log("=".repeat(55));

const sharedStore = new InMemoryStore();

// 预置公司知识
await sharedStore.put(["org", "products"], "ai_platform", {
  name: "AI Agent 平台",
  status: "MVP 阶段",
  team: "AI平台组",
  techStack: ["LangChain.js", "LangGraph", "Fastify", "PostgreSQL"],
  launchDate: "2026 Q3",
});
await sharedStore.put(["org", "policies"], "remote_work", {
  policy: "每周 2 天远程办公",
  effective: "2025-01",
});

// 跨线程 state: 极简，不需要存储记忆上下文
const CrossThreadState = Annotation.Root({
  messages: Annotation<any[]>({
    reducer: (l, r) => l.concat(r),
    default: () => [],
  }),
});

// 节点: 从 sharedStore 加载组织知识 + 用户档案
const crossLoadNode = async (state: typeof CrossThreadState.State) => {
  const st = getStore();
  const userProfile = await st.get(["users", "current"], "profile");
  const productInfo = await st.get(["org", "products"], "ai_platform");

  let context = "";
  if (userProfile) {
    context += `用户: ${(userProfile.value as any).name}, ${(userProfile.value as any).bio}. `;
  }
  if (productInfo) {
    const pi = productInfo.value as any;
    context += `产品: ${pi.name}(状态: ${pi.status}, 上线: ${pi.launchDate}), 技术栈: ${pi.techStack.join(", ")}.`;
  }

  return {
    messages: [
      { role: "system", content: `你是公司内部助手。上下文: ${context}` },
    ],
  };
};

const crossRespondNode = async (state: typeof CrossThreadState.State) => {
  const sysMsg = state.messages.find((m) => (m as any).role === "system") as any;
  const userMsg = state.messages
    .filter((m) => (m as any).role === "user")
    .pop() as any;

  const response = await model.invoke([
    { role: "system", content: sysMsg?.content },
    { role: "user", content: userMsg?.content },
  ]);
  return { messages: [response] };
};

const crossGraph = new StateGraph(CrossThreadState)
  .addNode("load_context", crossLoadNode)
  .addNode("respond", crossRespondNode)
  .addEdge(START, "load_context")
  .addEdge("load_context", "respond")
  .addEdge("respond", END)
  .compile({ store: sharedStore });

// 同时预置用户档案到 sharedStore
await sharedStore.put(["users", "current"], "profile", {
  name: "小明",
  bio: "AI平台组高级前端工程师",
});

// 两个不同的 thread_id，共享同一个 Store
console.log("  [Thread A: 询问产品信息]");
const rA = await crossGraph.invoke(
  { messages: [{ role: "user", content: "我们的 AI 平台什么时候上线？" }] },
  { configurable: { thread_id: "thread-a" } }
);
const lastA = rA.messages[rA.messages.length - 1] as any;
console.log(`    🤖 ${(lastA.content || "").slice(0, 150)}\n`);

console.log("  [Thread B: 询问远程办公政策]");
const rB = await crossGraph.invoke(
  { messages: [{ role: "user", content: "公司远程办公政策是什么？" }] },
  { configurable: { thread_id: "thread-b" } }
);
const lastB = rB.messages[rB.messages.length - 1] as any;
console.log(`    🤖 ${(lastB.content || "").slice(0, 150)}`);

console.log(`\n  ─────────────────────────────────────`);
console.log(`  Thread A 和 Thread B 是不同的对话线程`);
console.log(`  但它们共享同一个 Store 中的组织知识`);
console.log(`  用户档案也是一致的 — Store 是全球共享的\n`);

// ============================================================
// 总结
// ============================================================
console.log("=".repeat(55));
console.log("📊 短期记忆 vs 长期记忆 — 完整对照");
console.log("=".repeat(55));
console.log(`
┌──────────────────┬────────────────────────┬─────────────────────────┐
│                  │ 短期记忆 (Messages)     │ 长期记忆 (Store)          │
├──────────────────┼────────────────────────┼─────────────────────────┤
│ 存储位置          │ State.messages 数组     │ Store (put/get/search)   │
│ 生命周期          │ 单个对话线程内           │ 跨线程、跨会话持久化      │
│ 数据类型          │ LLM 消息 (user/ai/tool) │ 任意 JSON                │
│ 访问方式          │ state.messages         │ getStore().get/search    │
│ 典型用途          │ 当前对话上下文           │ 用户档案、偏好、事实      │
│ 类比              │ 工作记忆                │ 长期记忆                 │
│ Checkpointer 依赖 │ 是                     │ 否 (独立持久化)           │
└──────────────────┴────────────────────────┴─────────────────────────┘

Store 命名空间最佳实践:
  ["users",    "<userId>"]        → 用户档案
  ["users",    "<userId>", "facts"] → 提取的事实
  ["org",      "products"]        → 组织/产品信息
  ["sessions", "<sessionId>"]     → 会话摘要
`);
