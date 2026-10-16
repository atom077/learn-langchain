import { toolOutputText } from "./src/tools.js";
import { calculate } from "./src/calculator.js";
import { createDemoModel } from "./src/model.js";
import { tool } from "langchain";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import {
  StateGraph,
  Annotation,
  MessagesAnnotation,
  START,
  END,
} from "@langchain/langgraph";

const model = createDemoModel();

// ============================================================
// 公共工具
// ============================================================
const calculator = tool(
  ({ expression }) => {
    try {
      return `计算结果: ${expression} = ${calculate(expression)}`;
    } catch {
      return "计算失败";
    }
  },
  {
    name: "calculator",
    description: "执行数学计算",
    schema: z.object({ expression: z.string() }),
  }
);

const getCurrentTime = tool(
  () => new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" }),
  {
    name: "get_current_time",
    description: "获取当前日期和时间",
    schema: z.object({}),
  }
);

const searchDocs = tool(
  ({ query }) => {
    const docs: Record<string, string> = {
      架构: "系统采用微服务架构，使用 Fastify + TypeScript。服务间通信通过 gRPC，消息队列使用 RabbitMQ。数据库: PostgreSQL 主库 + Redis 缓存 + Elasticsearch 搜索。",
      部署: "CI/CD 使用 GitLab CI，部署到 K8s 集群（AWS EKS）。灰度发布策略: 5% → 30% → 100%，每阶段观察 10 分钟。回滚时间 < 2 分钟。",
      AI平台: "AI Agent 平台 2025 Q3 上线 MVP。核心能力: 多 Agent 协作、工具调用、RAG 检索。LangChain.js + LangGraph 技术栈。当前日活 2000+。",
      团队: "团队 12 人: 前端 4 人(React/Next.js)，后端 5 人(Node.js/Go)，AI 工程师 2 人，DevOps 1 人。在招: 高级 AI 工程师 1 名。",
    };
    const q = query.toLowerCase();
    const key = Object.keys(docs).find((k) => q.includes(k) || k.includes(q));
    return key ? docs[key] : `未找到"${query}"相关文档。可查: ${Object.keys(docs).join("、")}`;
  },
  {
    name: "search_docs",
    description: "搜索技术文档: 架构、部署、AI平台、团队",
    schema: z.object({ query: z.string() }),
  }
);

// ---- 工具转 OpenAI function calling 格式 ----
const allTools = [calculator, getCurrentTime, searchDocs];
const toolDefs = allTools.map((t) => ({
  type: "function" as const,
  function: {
    name: t.name,
    description: t.description,
    parameters: t.schema
      ? JSON.parse(JSON.stringify(zodToJsonSchema(t.schema)))
      : { type: "object", properties: {} },
  },
}));

const toolMap: Record<string, (args: any) => Promise<string> | string> = {
  calculator: async (a) => toolOutputText(await calculator.invoke(a)),
  get_current_time: async (a) => toolOutputText(await getCurrentTime.invoke(a)),
  search_docs: async (a) => toolOutputText(await searchDocs.invoke(a)),
};

// ---- 通用: 执行工具调用 ----
async function executeTools(toolCalls: Array<{ name: string; args: any; id?: string }>) {
  return Promise.all(
    toolCalls.map(async (tc) => {
      if (!tc.id) throw new Error("模型返回的工具调用缺少 id");
      const fn = toolMap[tc.name];
      const output = fn ? await fn(tc.args) : `未知工具: ${tc.name}`;
      console.log(`     🔧 ${tc.name} → ${String(output).slice(0, 60)}`);
      return { role: "tool" as const, tool_call_id: tc.id, content: String(output) };
    })
  );
}

// ============================================================
// 演示 1: Pipeline 模式 — 两个 Agent 串联
// ============================================================
console.log("=".repeat(55));
console.log("🧪 演示 1: Pipeline — 研究员 → 撰稿人，流水线式协作");
console.log("=".repeat(55));
console.log("  场景: 研究员收集资料 → 撰稿人根据资料写报告\n");

const PipelineState = Annotation.Root({
  messages: Annotation<{ role: string; content: string; tool_calls?: any[] }[]>({
    reducer: (left, right) => left.concat(right),
    default: () => [],
  }),
  researchNotes: Annotation<string>({
    reducer: (_, right) => right,
    default: () => "",
  }),
});

// Agent 1: 研究员 — 只负责搜索和收集资料
const researcherPrompt = `你是技术研究员。你的任务只是收集资料，不做总结。
当用户问技术问题时，用 search_docs 工具搜索相关文档。
搜索到资料后，将原始内容整理为要点，不要添加自己的分析。`;

const researcherNode = async (state: typeof PipelineState.State) => {
  console.log("  👨‍🔬 研究员工作中...");
  const modelWithTools = model.bindTools(
    toolDefs.filter((t) => t.function.name === "search_docs")
  );

  const msgs = [
    { role: "system", content: researcherPrompt },
    ...state.messages,
  ] as any[];

  const response = await modelWithTools.invoke(msgs);

  if (response.tool_calls?.length) {
    const toolMsgs = await executeTools(response.tool_calls);
    // 二次调用: 让 LLM 根据工具结果整理研究笔记
    const summary = await model.invoke([
      { role: "system", content: researcherPrompt },
      ...state.messages,
      response,
      ...toolMsgs,
      { role: "user", content: "请把刚才搜索到的资料整理为要点笔记，不要遗漏关键信息。" },
    ]);
    const notes = (summary.content as string) || "";
    console.log(`  👨‍🔬 研究完成 (${notes.length} 字)`);
    return {
      messages: [response, ...toolMsgs, summary],
      researchNotes: notes,
    };
  }

  // 无工具调用 → 直接作为研究笔记
  const notes = (response.content as string) || "";
  console.log(`  👨‍🔬 研究完成 (${notes.length} 字)`);
  return { messages: [response], researchNotes: notes };
};

// Agent 2: 撰稿人 — 根据研究笔记写报告
const writerPrompt = `你是技术撰稿人。你的任务是根据研究员提供的资料，写一份结构清晰的技术报告。

格式要求:
1. 标题和概述
2. 核心发现（3-5 个要点）
3. 总结和建议

用中文，报告长度 150-300 字。`;

const writerNode = async (state: typeof PipelineState.State) => {
  console.log("  ✍️  撰稿人工作中...");
  const notes = state.researchNotes;
  const userMsg = state.messages.filter((m) => m.role === "user").pop() as any;

  const response = await model.invoke([
    { role: "system", content: writerPrompt },
    {
      role: "user",
      content: `原始问题: "${userMsg?.content}"\n\n研究员提供的资料:\n${notes}\n\n请根据以上资料撰写报告。`,
    },
  ]);

  console.log(`  ✍️  报告完成 (${(response.content as string).length} 字)`);
  return { messages: [response] };
};

const pipelineGraph = new StateGraph(PipelineState)
  .addNode("researcher", researcherNode)
  .addNode("writer", writerNode)
  .addEdge(START, "researcher")
  .addEdge("researcher", "writer")
  .addEdge("writer", END)
  .compile();

const r1 = await pipelineGraph.invoke({
  messages: [
    { role: "user", content: "我们项目的 AI 平台架构是怎样的？" },
  ],
  researchNotes: "",
});

const last1 = r1.messages[r1.messages.length - 1] as { content: string };
console.log(`\n  📄 最终报告:\n${last1.content.slice(0, 300)}...\n`);

// ============================================================
// 演示 2: Router 模式 — 根据意图分发给不同 Agent
// ============================================================
console.log("=".repeat(55));
console.log("🧪 演示 2: Router — 路由到专职 Agent，各司其职");
console.log("=".repeat(55));
console.log("  场景: 数学 Agent(算账) / 搜索 Agent(查资料) / 通用 Agent(聊天)\n");

const RouterState = Annotation.Root({
  messages: Annotation<{ role: string; content: string; tool_calls?: any[] }[]>({
    reducer: (left, right) => left.concat(right),
    default: () => [],
  }),
  nextAgent: Annotation<string>({
    reducer: (_, right) => right,
    default: () => "",
  }),
});

// 路由节点: LLM 判断意图
const routerNode = async (state: typeof RouterState.State) => {
  const userMsg = state.messages.filter((m) => m.role === "user").pop() as any;
  const text = userMsg?.content || "";

  // 用简单规则路由（生产环境可以用 LLM 判断）
  let agent = "general";
  if (
    text.includes("算") ||
    text.includes("计算") ||
    text.match(/[\d+\-*/]/)
  ) {
    agent = "math";
  } else if (
    text.includes("架构") ||
    text.includes("部署") ||
    text.includes("团队") ||
    text.includes("平台")
  ) {
    agent = "search";
  }

  console.log(`  🚦 路由: "${text.slice(0, 30)}" → ${agent}`);
  return {
    nextAgent: agent,
    messages: [
      { role: "assistant", content: `[路由至: ${agent} Agent]` },
    ],
  };
};

// 各专职 Agent 节点
async function agentNode(
  name: string,
  systemPrompt: string,
  allowedTools: string[],
  state: typeof RouterState.State
) {
  console.log(`  🤖 ${name} Agent 工作中...`);
  const agentTools = toolDefs.filter((t) =>
    allowedTools.includes(t.function.name)
  );
  const modelWithTools = model.bindTools(agentTools);

  const userMsg = state.messages.filter((m) => m.role === "user").pop() as any;
  const response = await modelWithTools.invoke([
    { role: "system", content: systemPrompt },
    { role: "user", content: userMsg?.content },
  ]);

  if (response.tool_calls?.length) {
    const toolMsgs = await executeTools(response.tool_calls);
    // 工具执行后再让 LLM 总结
    const followUp = await modelWithTools.invoke([
      { role: "system", content: systemPrompt },
      { role: "user", content: userMsg?.content },
      response,
      ...toolMsgs,
    ]);
    return { messages: [response, ...toolMsgs, followUp] };
  }

  return { messages: [response] };
}

const mathAgentNode = (s: typeof RouterState.State) =>
  agentNode(
    "数学",
    "你是数学助手。用 calculator 工具做计算，用中文回复，简洁清晰。",
    ["calculator"],
    s
  );

const searchAgentNode = (s: typeof RouterState.State) =>
  agentNode(
    "搜索",
    "你是技术文档助手。用 search_docs 工具搜索，用中文回复，简洁清晰。",
    ["search_docs"],
    s
  );

const generalAgentNode = async (s: typeof RouterState.State) => {
  console.log("  🤖 通用 Agent 工作中...");
  const response = await model.invoke([
    { role: "system", content: "你是通用助手。用中文回复，简洁友好。" },
    s.messages[s.messages.length - 1],
  ]);
  return { messages: [response] };
};

// 路由条件
function routeToAgent(state: typeof RouterState.State): string {
  return state.nextAgent || "general";
}

const routerGraph = new StateGraph(RouterState)
  .addNode("router", routerNode)
  .addNode("math", mathAgentNode)
  .addNode("search", searchAgentNode)
  .addNode("general", generalAgentNode)
  .addEdge(START, "router")
  .addConditionalEdges("router", routeToAgent, {
    math: "math",
    search: "search",
    general: "general",
  })
  .addEdge("math", END)
  .addEdge("search", END)
  .addEdge("general", END)
  .compile();

for (const input of [
  "帮我算一下 256 * 128",
  "我们项目的部署流程是什么？",
  "介绍一下你自己",
]) {
  const r = await routerGraph.invoke({
    messages: [{ role: "user", content: input }],
    nextAgent: "",
  });
  const last = r.messages[r.messages.length - 1] as { content: string };
  console.log(`  💬 ${last.content.slice(0, 120)}\n`);
}

// ============================================================
// 演示 3: Supervisor 模式 — 一个主管协调多个工人
// ============================================================
console.log("=".repeat(55));
console.log("🧪 演示 3: Supervisor — 主管 Agent 协调多个专业工人");
console.log("=".repeat(55));
console.log("  场景: 主管分配任务 → 工人执行 → 主管汇总\n");

const SupervisorState = Annotation.Root({
  messages: Annotation<{ role: string; content: string; tool_calls?: any[] }[]>({
    reducer: (left, right) => left.concat(right),
    default: () => [],
  }),
  workerResults: Annotation<string[]>({
    reducer: (left, right) => [...left, ...right],
    default: () => [],
  }),
  iteration: Annotation<number>({
    reducer: (_, right) => right,
    default: () => 0,
  }),
});

// 主管 Agent: 分析任务，决定调用哪个工人，汇总结果
const supervisorNode = async (state: typeof SupervisorState.State) => {
  const iter = state.iteration + 1;
  console.log(`  👔 主管 第 ${iter} 轮决策...`);

  const userMsg = state.messages.filter((m) => m.role === "user").pop() as any;

  // 主管先分析需要什么，然后分配
  const doneWork = state.workerResults.length > 0
    ? `\n工人已完成的工作:\n${state.workerResults.join("\n")}\n`
    : "";
  // console.error('>>>doneWork', doneWork);
  
  const planPrompt = `你是项目主管。用户的问题是: "${userMsg?.content}"${doneWork}
你需要将任务分派给专业工人。可用的工人:
- search_docs: 搜索技术文档（架构、部署、团队等）
- calculator: 执行数学计算
- get_current_time: 获取时间信息

规则:
- 如果用户问技术问题且工人还未搜索过相关文档，分派给 search_docs
- 如果工人已经完成了搜索，回复 "none" 来进入汇总阶段
- 如果用户需要计算，分派给 calculator

请只回复需要分派的工人名称，用逗号分隔。如果工人已完成所有必要工作，回复 "none"。`;

  const planResponse = await model.invoke([
    { role: "system", content: planPrompt },
  ]);
  // console.log('>>>planPrompt');
  // console.log(planPrompt);
  // console.log('>>>planResponse', planResponse.content);

  const plan = (planResponse.content as string).toLowerCase();
  console.log(`  👔 主管计划: ${plan}`);

  if (plan.includes("none") || iter > 2) {
    // 汇总阶段: 根据工人结果生成最终回答
    const results = state.workerResults.join("\n");
    const finalResponse = await model.invoke([
      {
        role: "system",
        content: "你是项目主管。请根据以下工人执行结果，给用户一个完整的回答。用中文，简洁清晰。",
      },
      { role: "user", content: userMsg?.content },
      ...state.messages.filter((m) => m.role === "assistant"),
      { role: "user", content: `工人执行结果:\n${results || "无需工人介入"}` },
    ]);

    console.log(`  👔 主管给出最终回答`);
    return {
      messages: [finalResponse],
      iteration: iter,
      workerResults: [],
    };
  }

  // 分配任务给工人
  const workerList = plan
    .split(/[,，、\s]+/)
    .map((w) => w.trim())
    .filter((w) => ["calculator", "search_docs", "get_current_time"].includes(w));

  return {
    iteration: iter,
    messages: [
      {
        role: "assistant" as const,
        content: `[主管分配任务: ${workerList.join(", ")}]`,
      },
    ],
  };
};

// 工人 Agent: 执行主管分配的具体任务
const workerNode = async (state: typeof SupervisorState.State) => {
  console.log("  👷 工人执行任务...");

  const modelWithTools = model.bindTools(toolDefs);
  const userMsg = state.messages.filter((m) => m.role === "user").pop() as any;

  const response = await modelWithTools.invoke([
    {
      role: "system",
      content:
        "你是执行工人。用可用的工具完成任务，返回事实性的执行结果。用中文，只返回结果不添加评论。",
    },
    { role: "user", content: userMsg?.content },
  ]);

  if (response.tool_calls?.length) {
    const toolMsgs = await executeTools(response.tool_calls);
    return {
      messages: [response, ...toolMsgs],
      workerResults: toolMsgs.map((m) => m.content),
    };
  }

  return {
    messages: [response],
    workerResults: [response.content as string],
  };
};

// 主管路由器: 有 worker results → 回到主管汇总，否则继续分派
function routeAfterWorker(state: typeof SupervisorState.State): string {
  return "supervisor";
}

function routeAfterSupervisor(state: typeof SupervisorState.State): string {
  const lastMsg = state.messages[state.messages.length - 1] as {
    content: string;
  };
  // 如果主管给出了最终回答（不是任务分配），结束
  if (lastMsg.content && !lastMsg.content.includes("[主管分配任务")) {
    return END;
  }
  return "worker";
}

const supervisorGraph = new StateGraph(SupervisorState)
  .addNode("supervisor", supervisorNode)
  .addNode("worker", workerNode)
  .addEdge(START, "supervisor")
  .addConditionalEdges("supervisor", routeAfterSupervisor, {
    worker: "worker",
    [END]: END,
  })
  .addConditionalEdges("worker", routeAfterWorker, {
    supervisor: "supervisor",
    [END]: END,
  })
  .compile();

const r3UserInput = "我们的 AI 平台架构是怎样的？当前有多少团队成员？计算 256 * 128 的结果是多少？";
console.log(`\n  💬 用户问题: ${r3UserInput}`);
const r3 = await supervisorGraph.invoke({
  messages: [
    {
      role: "user",
      content: r3UserInput,
    },
  ],
  workerResults: [],
  iteration: 0,
});

const last3 = r3.messages[r3.messages.length - 1] as { content: string };
console.log(`\n  📊 主管最终报告:\n${last3.content.slice(0, 400)}\n`);

// ============================================================
// 总结
// ============================================================
console.log("=".repeat(55));
console.log("📊 三种多 Agent 协作模式对比");
console.log("=".repeat(55));
console.log(`
┌─────────────────┬──────────────────┬─────────────────────┬──────────────────────┐
│ 模式             │ Pipeline         │ Router              │ Supervisor           │
├─────────────────┼──────────────────┼─────────────────────┼──────────────────────┤
│ 结构             │ 固定顺序          │ 一次分发             │ 动态分派 + 循环       │
│ Agent 数量       │ 2-3              │ 3-N                 │ 3-N                  │
│ 适合             │ 有明确前后依赖    │ 任务类型互斥         │ 复杂任务需多轮        │
│ 控制权           │ 图结构            │ 路由规则             │ 主管 Agent           │
│ 灵活性           │ 低               │ 中                  │ 高                   │
│ 示例             │ 研究→写作         │ 数学/搜索/聊天       │ 主管分析→工人→汇总    │
└─────────────────┴──────────────────┴─────────────────────┴──────────────────────┘

选择指南:
  任务步骤固定且有依赖关系     → Pipeline
  请求类型互斥，一次只走一条路  → Router
  需要多次交互、动态决策        → Supervisor
`);
