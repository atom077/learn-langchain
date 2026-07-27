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
// 场景: 个人助手 — 记住用户偏好，跨对话个性化回复
// ============================================================
console.log("=".repeat(60));
console.log("🔬 Mem0 对比实验: Store API vs Mem0 模式");
console.log("=".repeat(60));
console.log("场景: 个人助手记住用户偏好并跨对话个性化回复\n");

// ============================================================
// Part A: Store API 方案（Lesson 11 的做法）
// ============================================================
console.log("─".repeat(60));
console.log("📦 方案 A: LangGraph Store API（我们已掌握的方案）");
console.log("─".repeat(60));

const storeA = new InMemoryStore();

// 预置记忆
await storeA.put(["users", "alice"], "profile", {
  name: "Alice",
  facts: ["前端工程师", "React 熟练"],
  preferences: {},
});

// Graph: Load → Respond → Extract → Save
const StoreState = Annotation.Root({
  messages: Annotation<any[]>({ reducer: (l, r) => l.concat(r), default: () => [] }),
  memoryContext: Annotation<string>({ reducer: (_, r) => r, default: () => "" }),
});

// 1. Load — 我们自己写逻辑
const loadStoreNode = async (state: typeof StoreState.State) => {
  const st = getStore();
  const profile = await st.get(["users", "alice"], "profile");
  if (!profile) return { memoryContext: "" };
  const p = profile.value as any;
  const ctx = `用户: ${p.name}。已知: ${p.facts.join("; ")}。偏好: ${JSON.stringify(p.preferences)}`;
  return {
    memoryContext: ctx,
    messages: [{ role: "system", content: `助手。用户上下文: ${ctx}` }],
  };
};

// 2. Respond
const respondStoreNode = async (state: typeof StoreState.State) => {
  const sys = state.messages.find((m) => (m as any).role === "system") as any;
  const user = state.messages.filter((m) => (m as any).role === "user").pop() as any;
  const r = await model.invoke([
    { role: "system", content: sys?.content },
    { role: "user", content: user?.content },
  ]);
  return { messages: [r] };
};

// 3. Extract & Save — 我们自己写 LLM prompt 提取事实
const extractStoreNode = async (state: typeof StoreState.State) => {
  const st = getStore();
  const profile = await st.get(["users", "alice"], "profile");
  if (!profile) return {};
  const p = profile.value as any;
  const user = state.messages.filter((m) => (m as any).role === "user").pop() as any;

  // 手动写提取 prompt（Lesson 11 的做法）
  const extractPrompt = `从消息中提取新事实（JSON数组）。已知: ${JSON.stringify(p.facts)}。消息: "${(user?.content || "")}"。只返回 ["fact1","fact2"] 或 []。`;
  const r = await model.invoke([{ role: "user", content: extractPrompt }]);
  try {
    const newFacts: string[] = JSON.parse(
      ((r.content as string) || "[]").replace(/```json|```/g, "").trim()
    );
    if (newFacts.length > 0) {
      await st.put(["users", "alice"], "profile", {
        ...p, facts: [...p.facts, ...newFacts],
      });
      console.log(`  💾 Store: 提取到 ${newFacts.join(", ")}`);
    }
  } catch { /* ignore parse errors */ }
  return {};
};

const storeGraph = new StateGraph(StoreState)
  .addNode("load", loadStoreNode)
  .addNode("respond", respondStoreNode)
  .addNode("extract", extractStoreNode)
  .addEdge(START, "load").addEdge("load", "respond")
  .addEdge("respond", "extract").addEdge("extract", END)
  .compile({ checkpointer: new MemorySaver(), store: storeA });

const tidA = "store-demo";
const cfgA = { configurable: { thread_id: tidA } };

console.log("  [Store API — 3轮对话]");
for (const input of [
  "你好！我喜欢简洁的回复风格",
  "我下周要去东京出差",
  "帮我总结一下我的偏好和计划",
]) {
  process.stdout.write(`  👤 ${input.slice(0, 40)}... → `);
  const r = await storeGraph.invoke(
    { messages: [{ role: "user", content: input }], memoryContext: "" },
    cfgA
  );
  const last = r.messages[r.messages.length - 1] as any;
  console.log(`${(last.content || "").slice(0, 80)}`);
}

// 验证持久化
const finalA = await storeA.get(["users", "alice"], "profile");
console.log(`\n  📊 Store 最终状态: ${(finalA?.value as any)?.facts.length} 条事实`);
console.log(`     事实: ${(finalA?.value as any)?.facts.join(" | ")}`);

// ============================================================
// Part B: Mem0 模式（如果用 Mem0，代码会怎样）
// ============================================================
console.log("\n" + "─".repeat(60));
console.log("📦 方案 B: Mem0 SDK 模式（概念演示）");
console.log("─".repeat(60));

// 模拟 Mem0 MemoryClient API（真实使用时 import { MemoryClient } from "mem0ai"）
// const mem0 = new MemoryClient({ apiKey: process.env.MEM0_API_KEY });

// 为了演示，我们用一个实现了相同 API 模式的模拟版本
class Mem0Simulator {
  private memories: Array<{ id: string; content: string; metadata: any }> = [];
  private id = 0;

  async add(messages: Array<{ role: string; content: string }>, meta: { userId: string }) {
    // Mem0 内部做的事: LLM 提取事实 → 去重 → 存储
    const userContent = messages.filter((m) => m.role === "user").map((m) => m.content).join("; ");

    // 这一步在真实 Mem0 中是内置的，你不需要写 prompt
    const extractPrompt = `Extract key facts from this message as a JSON array of strings: "${userContent}"`;
    const r = await model.invoke([{ role: "user", content: extractPrompt }]);

    const added: string[] = [];
    try {
      const facts: string[] = JSON.parse(
        ((r.content as string) || "[]").replace(/```json|```/g, "").trim()
      );
      for (const fact of facts) {
        const id = `mem-${++this.id}`;
        this.memories.push({ id, content: fact, metadata: meta });
        added.push(fact);
      }
    } catch { /* ignore */ }
    return added;
  }

  async search(query: string, opts: { filters: { userId: string }; limit?: number }) {
    const { userId } = opts.filters;
    const limit = opts.limit || 5;

    // Mem0 内部做的事: 语义搜索 + BM25 + 实体匹配 + 时序推理
    // 这里简化为关键词匹配
    const q = query.toLowerCase();
    const userMemories = this.memories.filter((m) => m.metadata.userId === userId);

    const scored = userMemories.map((m) => ({
      content: m.content,
      score: q.split(/\s+/).filter((w) => m.content.toLowerCase().includes(w)).length,
    }));

    return scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
}

const mem0 = new Mem0Simulator();

// Mem0 模式的 Graph — 更简单，因为 extract 和 search 都是 Mem0 内置的
const Mem0State = Annotation.Root({
  messages: Annotation<any[]>({ reducer: (l, r) => l.concat(r), default: () => [] }),
});

const mem0Node = async (state: typeof Mem0State.State) => {
  const user = state.messages.find((m) => (m as any).role === "user") as any;
  const userId = "alice";

  // 1. 搜索相关记忆（Mem0 内置语义搜索，不需要自己写 prompt）
  const memories = await mem0.search(user?.content || "", {
    filters: { userId },
    limit: 5,
  });

  const memoryText = memories.map((m) => `- ${m.content}`).join("\n");
  if (memoryText) console.log(`  🧠 Mem0 检索到:\n${memoryText}`);

  // 2. 将记忆注入 system prompt
  const response = await model.invoke([
    {
      role: "system",
      content: `助手。用户相关记忆:\n${memoryText || "(暂无)"}`,
    },
    { role: "user", content: user?.content },
  ]);

  // 3. 保存交互到 Mem0（Mem0 内置事实提取 + 去重，不需要自己写 prompt）
  const added = await mem0.add(
    [{ role: "user", content: user?.content }, { role: "assistant", content: response.content as string }],
    { userId }
  );
  if (added.length > 0) console.log(`  💾 Mem0 自动提取: ${added.join(", ")}`);

  return { messages: [response] };
};

const mem0Graph = new StateGraph(Mem0State)
  .addNode("chat", mem0Node)
  .addEdge(START, "chat")
  .addEdge("chat", END)
  .compile();

const tidB = "mem0-demo";
const cfgB = { configurable: { thread_id: tidB } };

console.log("  [Mem0 模式 — 3轮对话]");
for (const input of [
  "你好！我喜欢简洁的回复风格",
  "我下周要去东京出差",
  "帮我总结一下我的偏好和计划",
]) {
  process.stdout.write(`  👤 ${input.slice(0, 40)}... → `);
  const r = await mem0Graph.invoke(
    { messages: [{ role: "user", content: input }] },
    cfgB
  );
  const last = r.messages[r.messages.length - 1] as any;
  console.log(`${(last.content || "").slice(0, 80)}`);
}

// ============================================================
// 深度对比
// ============================================================
console.log("\n" + "=".repeat(60));
console.log("📊 深度对比: Store API vs Mem0");
console.log("=".repeat(60));

console.log(`
┌──────────────────────┬────────────────────────────┬─────────────────────────────┐
│                      │ Store API (方案A)           │ Mem0 (方案B)                 │
├──────────────────────┼────────────────────────────┼─────────────────────────────┤
│ 代码行数              │ ~80 行 (含 extract prompt)  │ ~30 行                       │
│ 记忆提取              │ 自己写 LLM prompt           │ 内置，一个方法调用             │
│ 检索方式              │ get/search by key           │ 语义搜索 + 关键词 + 实体     │
│ 去重/冲突处理          │ 手动覆盖                    │ 自动去重 + 实体链接           │
│ 部署依赖              │ 0 (LangGraph 自带)          │ API key or 自建 OSS         │
│ 成本                  │ 免费                        │ Free(10K) → $19/mo → $249/mo│
│ 控制粒度              │ 完全控制每一步               │ 信任 Mem0 的黑盒决策          │
│ 学习曲线              │ 需理解 Store API            │ 需理解 Mem0 概念 + 平台      │
│ 适用规模              │ 原型→中型项目                │ 中型→企业级                  │
│ 时序推理              │ 需自己实现                   │ 2026.4 起内置                │
│ 知识图谱              │ 不支持                      │ Pro tier (实体→关系图)       │
└──────────────────────┴────────────────────────────┴─────────────────────────────┘

核心差异总结:

1. Store API 是"工具" — 给你 put/get/search，你怎么用是你的事
   Mem0 是"产品" — 内置了提取、去重、语义搜索、实体链接

2. Store API 代码量更大，但控制力更强
   - 你可以自定义提取 prompt（例如只提取技术相关的事实）
   - Mem0 的提取逻辑是黑盒，你调不了

3. Mem0 的检索质量远超 Store API
   - 语义搜索: "出差去东京" 能匹配到 "日本旅行计划"
   - Store API 只能按 key 精确匹配，除非你手动实现 embedding

4. 两者可以组合使用
   - Store API 管理应用状态（step, approved, iteration）
   - Mem0 管理用户记忆（偏好、事实、历史）
   - 互补而非替代
`);
