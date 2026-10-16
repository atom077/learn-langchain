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

// ============================================================
// 配置 DeepSeek 模型
// ============================================================
const model = createDemoModel();

// ============================================================
// 定义工具（和 createAgent 的 tool 定义完全一样）
// ============================================================
const calculator = tool(
  ({ expression }) => {
    try {
      const result = calculate(expression);
      return `计算结果: ${expression} = ${result}`;
    } catch {
      return "计算失败，请检查表达式";
    }
  },
  {
    name: "calculator",
    description: "执行数学计算。支持加减乘除、括号、取余。",
    schema: z.object({
      expression: z.string().describe("数学表达式，如 '(3 + 5) * 2'"),
    }),
  }
);

const getCurrentTime = tool(
  () => new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" }),
  {
    name: "get_current_time",
    description: "获取当前日期和时间。",
    schema: z.object({}),
  }
);

const getUserProfile = tool(
  ({ userId }) =>
    JSON.stringify({
      id: userId,
      name: "小明",
      role: "高级前端工程师",
      department: "AI 平台组",
      joinDate: "2024-03",
    }),
  {
    name: "get_user_profile",
    description: "根据用户 ID 获取用户信息。",
    schema: z.object({
      userId: z.string().describe("用户 ID"),
    }),
  }
);

const toolsByName: Record<string, (args: any) => Promise<string> | string> = {
  calculator: async (args) => toolOutputText(await calculator.invoke(args)),
  get_current_time: async (args) => toolOutputText(await getCurrentTime.invoke(args)),
  get_user_profile: async (args) => toolOutputText(await getUserProfile.invoke(args)),
};

// 转换为 OpenAI function calling 格式
const toolDefinitions = [calculator, getCurrentTime, getUserProfile].map((t) => ({
  type: "function" as const,
  function: {
    name: t.name,
    description: t.description,
    parameters: t.schema ?
      // Convert Zod schema to JSON Schema
      JSON.parse(JSON.stringify(zodToJsonSchema(t.schema))) :
      { type: "object", properties: {} },
  },
}));

// ============================================================
// 演示 1: 手动 ReAct 循环 — LLM 节点 + 工具节点 + 路由器
// ============================================================
console.log("=".repeat(55));
console.log("🧪 演示 1: LangGraph 中的 ReAct — 手动构建 Agent 循环");
console.log("=".repeat(55));

// LLM 节点：调用模型（带工具定义），返回 AI 消息（可能含 tool_calls）
const llmNode = async (state: typeof MessagesAnnotation.State) => {
  const modelWithTools = model.bindTools(toolDefinitions);
  const response = await modelWithTools.invoke(state.messages);
  console.log(`  🧠 LLM: ${response.content || "(请求工具调用)"}`);
  if (response.tool_calls?.length) {
    for (const tc of response.tool_calls) {
      console.log(`     → 调用: ${tc.name}(${JSON.stringify(tc.args)})`);
    }
  }
  return { messages: [response] };
};

// 工具节点：执行 LLM 请求的工具调用
const toolNode = async (state: typeof MessagesAnnotation.State) => {
  const lastMsg = state.messages[state.messages.length - 1] as {
    tool_calls?: Array<{
      name: string;
      args: any;
      id: string;
    }>;
  };
  const toolCalls = lastMsg.tool_calls ?? [];

  const toolMessages = await Promise.all(
    toolCalls.map(async (tc) => {
      const fn = toolsByName[tc.name];
      if (!fn) {
        return {
          role: "tool" as const,
          tool_call_id: tc.id,
          content: `错误: 未知工具 "${tc.name}"`,
        };
      }
      try {
        const output = await fn(tc.args);
        console.log(`  🔧 ${tc.name} → ${output.slice(0, 60)}`);
        return {
          role: "tool" as const,
          tool_call_id: tc.id,
          content: output,
        };
      } catch (err: any) {
        console.log(`  ❌ ${tc.name} 失败: ${err.message}`);
        return {
          role: "tool" as const,
          tool_call_id: tc.id,
          content: `工具执行失败: ${err.message}`,
        };
      }
    })
  );

  return { messages: toolMessages };
};

// 路由器：检查最后一条消息是否有 tool_calls，决定走 tools 还是 END
function routeAfterLlm(state: { messages: readonly unknown[] }): string {
  const lastMsg = state.messages[state.messages.length - 1] as {
    tool_calls?: Array<{ name: string }>;
  };
  if (lastMsg?.tool_calls?.length) {
    return "tools";
  }
  return END;
}

const reactGraph = new StateGraph(MessagesAnnotation)
  .addNode("llm", llmNode)
  .addNode("tools", toolNode)
  .addEdge(START, "llm")
  .addConditionalEdges("llm", routeAfterLlm)
  .addEdge("tools", "llm") // 工具执行后回到 LLM，继续推理
  .compile();

const r1 = await reactGraph.invoke({
  messages: [
    { role: "system", content: "你是助手。用中文回复，简洁清晰。" },
    { role: "user", content: "帮我算一下 (15 + 7) * 3，然后告诉我现在几点。" },
  ],
});

console.log("\n  最终回复:");
const finalMsg = r1.messages[r1.messages.length - 1] as { content: string };
console.log(`  🤖 ${finalMsg.content}\n`);

// ============================================================
// 演示 2: 注入审核步骤 — 在工具执行前做校验
// ============================================================
console.log("=".repeat(55));
console.log("🧪 演示 2: LangGraph 的优势 — 在 LLM 和工具之间注入审核");
console.log("=".repeat(55));
console.log("  场景: 危险操作（如大额转账）需要审批后才能执行\n");

const AuditState = Annotation.Root({
  messages: Annotation<
    { role: string; content: string; tool_calls?: any[] }[]
  >({
    reducer: (left, right) => left.concat(right),
    default: () => [],
  }),
  approvedActions: Annotation<string[]>({
    reducer: (left, right) => [...left, ...right],
    default: () => [],
  }),
  blockedActions: Annotation<string[]>({
    reducer: (left, right) => [...left, ...right],
    default: () => [],
  }),
});

// 审核节点：在工具执行前检查是否允许
const auditNode = (state: typeof AuditState.State) => {
  const lastMsg = state.messages[state.messages.length - 1] as {
    tool_calls?: Array<{ name: string; args: any; id: string }>;
  };
  const toolCalls = lastMsg.tool_calls ?? [];

  const approved: string[] = [];
  const blocked: string[] = [];

  for (const tc of toolCalls) {
    // 模拟审核规则：拒绝大数计算
    const argsStr = JSON.stringify(tc.args);
    if (argsStr.includes("99999")) {
      blocked.push(`${tc.name}(${argsStr.slice(0, 20)})`);
      console.log(`  🚫 审核拒绝: ${tc.name} — 疑似危险操作`);
    } else {
      approved.push(`${tc.name}(${argsStr.slice(0, 20)})`);
      console.log(`  ✅ 审核通过: ${tc.name}`);
    }
  }

  if (blocked.length > 0) {
    return {
      approvedActions: approved,
      blockedActions: blocked,
      messages: [
        {
          role: "assistant" as const,
          content: `审核结果: 通过 ${approved.length} 项, 拒绝 ${blocked.length} 项。被拒绝的操作: ${blocked.join(", ")}`,
        },
      ],
    };
  }

  return { approvedActions: approved, blockedActions: blocked };
};

// 审核路由器
function routeAfterAudit(state: typeof AuditState.State): string {
  if (state.blockedActions.length > 0) {
    return END; // 有被拒绝的操作 → 停止，不执行工具
  }
  return "tools";
}

// 简化的 LLM 节点（用于审核图）
const simpleLlm = async (state: typeof AuditState.State) => {
  const modelWithTools = model.bindTools(toolDefinitions);
  const response = await modelWithTools.invoke(
    state.messages as { role: string; content: string }[]
  );
  console.log(`  🧠 LLM: ${response.content || "(请求工具调用)"}`);
  return { messages: [response] };
};

// 简化的工具节点
const simpleTools = async (state: typeof AuditState.State) => {
  const lastMsg = state.messages[state.messages.length - 1] as any;
  const tcs = lastMsg.tool_calls ?? [];
  const results = await Promise.all(
    tcs.map(async (tc: any) => {
      const fn = toolsByName[tc.name];
      const output = fn ? await fn(tc.args) : `未知工具: ${tc.name}`;
      console.log(`  🔧 ${tc.name} → ${output.slice(0, 60)}`);
      return { role: "tool" as const, tool_call_id: tc.id, content: output };
    })
  );
  return { messages: results };
};

const auditGraph = new StateGraph(AuditState)
  .addNode("llm", simpleLlm)
  .addNode("audit", auditNode) // ← 注入的审核步骤！
  .addNode("tools", simpleTools)
  .addEdge(START, "llm")
  .addConditionalEdges("llm", (state) => {
    // 如果有 tool_calls → 先去审核，否则结束
    const lastMsg = state.messages[state.messages.length - 1] as any;
    return lastMsg.tool_calls?.length ? "audit" : END;
  })
  .addConditionalEdges("audit", routeAfterAudit, {
    tools: "tools",
    [END]: END,
  })
  .addEdge("tools", "llm")
  .compile();

// 正常请求 — 通过审核
console.log("  [测试 1] 正常计算:");
console.log("  用户请求: 帮我算一下 3 * 5");
const r2a = await auditGraph.invoke({
  messages: [
    { role: "system", content: "你是助手。用中文回复，简洁。" },
    { role: "user", content: "帮我算一下 3 * 5" },
  ],
  approvedActions: [],
  blockedActions: [],
});
const last2a = r2a.messages[r2a.messages.length - 1] as { content: string };
console.log(`  🤖 ${last2a.content}\n`);

// 危险请求 — 被审核拦截
console.log("  [测试 2] 疑似危险操作:");
console.log("  用户请求: 帮我算 99999 * 99999");
const r2b = await auditGraph.invoke({
  messages: [
    { role: "system", content: "你是助手。用中文回复，简洁。" },
    { role: "user", content: "帮我算 99999 * 99999" },
  ],
  approvedActions: [],
  blockedActions: [],
});
const last2b = r2b.messages[r2b.messages.length - 1] as { content: string };
console.log(`  🤖 ${last2b.content}\n`);

// ============================================================
// 演示 3: 追踪执行统计 — LangGraph 状态能力
// ============================================================
console.log("=".repeat(55));
console.log("🧪 演示 3: 自定义 State 追踪 — 统计工具调用次数");
console.log("=".repeat(55));

const MonitorState = Annotation.Root({
  messages: Annotation<
    { role: string; content: string; tool_calls?: any[] }[]
  >({
    reducer: (left, right) => left.concat(right),
    default: () => [],
  }),
  // 统计信息
  llmCallCount: Annotation<number>({
    reducer: (_, right) => right,
    default: () => 0,
  }),
  toolCallCount: Annotation<number>({
    reducer: (_, right) => right,
    default: () => 0,
  }),
  toolCallHistory: Annotation<string[]>({
    reducer: (left, right) => [...left, ...right],
    default: () => [],
  }),
});

const monitoredLlm = async (state: typeof MonitorState.State) => {
  const modelWithTools = model.bindTools(toolDefinitions);
  const response = await modelWithTools.invoke(
    state.messages as { role: string; content: string }[]
  );

  const newCount = state.llmCallCount + 1;
  console.log(`  🧠 LLM 第 ${newCount} 次调用`);

  let history: string[] = [];
  if (response.tool_calls?.length) {
    history = response.tool_calls.map(
      (tc) => `${tc.name}(${JSON.stringify(tc.args).slice(0, 40)})`
    );
    console.log(`     → 请求工具: ${history.join(", ")}`);
  }

  return {
    messages: [response],
    llmCallCount: newCount,
    toolCallHistory: history,
  };
};

const monitoredTools = async (state: typeof MonitorState.State) => {
  const lastMsg = state.messages[state.messages.length - 1] as any;
  const tcs = lastMsg.tool_calls ?? [];

  const newCount = state.toolCallCount + tcs.length;
  console.log(`  🔧 工具执行 (累计 ${newCount} 次)`);

  const results = await Promise.all(
    tcs.map(async (tc: any) => {
      const fn = toolsByName[tc.name];
      const output = fn ? await fn(tc.args) : `未知工具: ${tc.name}`;
      return { role: "tool" as const, tool_call_id: tc.id, content: output };
    })
  );
  return { messages: results, toolCallCount: newCount };
};

const monitorGraph = new StateGraph(MonitorState)
  .addNode("llm", monitoredLlm)
  .addNode("tools", monitoredTools)
  .addEdge(START, "llm")
  .addConditionalEdges("llm", routeAfterLlm)
  .addEdge("tools", "llm")
  .compile();

const r3 = await monitorGraph.invoke({
  messages: [
    { role: "system", content: "你是助手。用中文回复，简洁。" },
    { role: "user", content: "帮我查一下 user-001 的信息，然后算一下 3 * 5，最后告诉我时间。" },
  ],
  llmCallCount: 0,
  toolCallCount: 0,
  toolCallHistory: [],
});

console.log('用户请求: "帮我查一下 user-001 的信息，然后算一下 3 * 5，最后告诉我时间。"');
console.log(`\n  执行统计:`);
console.log(`  LLM 调用次数: ${r3.llmCallCount}`);
console.log(`  工具调用次数: ${r3.toolCallCount}`);
console.log(`  调用的工具: ${r3.toolCallHistory.join(" → ")}`);
const last3 = r3.messages[r3.messages.length - 1] as { content: string };
console.log(`\n  最终回复: 🤖 ${last3.content}`);

// // ============================================================
// // 总结
// // ============================================================
// console.log("\n" + "=".repeat(55));
// console.log("📊 LangGraph Agent = 手动 ReAct 循环 + 你想要的任何步骤");
// console.log("=".repeat(55));
// console.log(`
// createAgent() 的 ReAct 循环:
//   LLM → tools → LLM → tools → ... → END
//   (黑盒，你只能看到最终结果)

// LangGraph 的 ReAct 循环:
//   LLM → [审核] → [日志] → tools → [验证] → LLM → [审批] → END
//   (每个 [步骤] 都是你可以插入自定义逻辑的位置)

// 三个例子:
//   演示 1: LLM → tools → LLM (基础的 ReAct)
//   演示 2: LLM → 🛡️ 审核 → tools → LLM (注入安全检查)
//   演示 3: LLM → tools → LLM + 📊 统计 (追踪执行过程)
// `);
