import { createDemoModel } from "./src/model.js";
import { tool } from "langchain";
import { z } from "zod";
import {
  StateGraph,
  Annotation,
  MessagesAnnotation,
  START,
  END,
  interrupt,
  Command,
  MemorySaver,
} from "@langchain/langgraph";

const model = createDemoModel();

// // ============================================================
// // 演示 1: 基础 interrupt — 审批关
// // ============================================================
// console.log("=".repeat(55));
// console.log("🧪 演示 1: 基础 interrupt — 在工具执行前插入审批关");
// console.log("=".repeat(55));
// console.log("  流程: 提出请求 → ⏸️ 人工审批 → 执行 or 取消\n");

// const ApprovalState = Annotation.Root({
//   messages: Annotation<any[]>({
//     reducer: (l, r) => l.concat(r),
//     default: () => [],
//   }),
//   decision: Annotation<string>({ reducer: (_, r) => r, default: () => "" }),
// });

// // 工具: 模拟转账
// const transferTool = tool(
//   ({ amount, to }) => `✅ 已转账 ¥${amount} 到账户 ${to}`,
//   {
//     name: "transfer",
//     description: "转账到指定账户",
//     schema: z.object({
//       amount: z.number().describe("转账金额"),
//       to: z.string().describe("收款账户"),
//     }),
//   }
// );

// const approvalGraph = new StateGraph(ApprovalState)
//   .addNode("propose", (state) => {
//     const userMsg = state.messages.filter((m) => m.role === "user").pop();
//     console.log(`  📝 收到请求: "${(userMsg as any).content.slice(0, 50)}"`);
//     return {
//       messages: [
//         { role: "assistant", content: `申请: 执行 "${(userMsg as any).content}"` },
//       ],
//     };
//   })
//   .addNode("review", (_state) => {
//     // interrupt() 挂起图，等待外部 Command
//     const decision = interrupt({
//       question: "请审核此操作",
//       options: ["approve", "deny"],
//     });
//     console.log(`  👤 人工决定: ${typeof decision === "object" ? JSON.stringify(decision) : decision}`);
//     const d = typeof decision === "string" ? decision : (decision as any).decision;
//     return {
//       decision: d,
//       messages: [
//         {
//           role: "assistant",
//           content: d === "approve" ? "审批通过 ✅" : "审批拒绝 ❌",
//         },
//       ],
//     };
//   })
//   .addNode("execute", async (state) => {
//     console.log("  ⚡ 执行操作...");
//     const userMsg = state.messages.filter((m) => m.role === "user").pop() as any;
//     const result = await transferTool.invoke({
//       amount: 5000,
//       to: "account-888",
//     });
//     return {
//       messages: [{ role: "assistant", content: String(result) }],
//     };
//   })
//   .addNode("cancel", (state) => {
//     return {
//       messages: [
//         {
//           role: "assistant",
//           content: "操作已取消。如需重新申请，请再次发起请求。",
//         },
//       ],
//     };
//   })
//   .addEdge(START, "propose")
//   .addEdge("propose", "review")
//   .addConditionalEdges("review", (state) =>
//     state.decision === "approve" ? "execute" : "cancel"
//   )
//   .addEdge("execute", END)
//   .addEdge("cancel", END)
//   .compile({ checkpointer: new MemorySaver() });

// // 第一次 invoke: 运行到 interrupt，挂起
// const tid = "demo-1";
// const cfg = { configurable: { thread_id: tid } };

// console.log("  [第 1 次 invoke — 运行到 interrupt]");
// const r1a = await approvalGraph.invoke(
//   {
//     messages: [{ role: "user", content: "从我的账户转 5000 到 account-888" }],
//     decision: "",
//   },
//   cfg
// );
// console.log(`  ⏸️  图已挂起，等待审批。messages: ${r1a.messages.length} 条\n`);

// // 第二次 invoke: 用 Command 恢复，传入审批结果
// console.log("  [第 2 次 invoke — 恢复执行: approve]");
// const r1b = await approvalGraph.invoke(new Command({ resume: "approve" }), cfg);
// const last1 = r1b.messages[r1b.messages.length - 1] as any;
// console.log(`  ✅ 最终: ${last1.content}\n`);

// // ============================================================
// // 演示 2: LLM 建议 + 人工审批 — Agent 先思考，人再决定
// // ============================================================
// console.log("=".repeat(55));
// console.log("🧪 演示 2: LLM + Human — Agent 分析并提出方案，人审批后执行");
// console.log("=".repeat(55));

// const AdvisorState = Annotation.Root({
//   messages: Annotation<any[]>({
//     reducer: (l, r) => l.concat(r),
//     default: () => [],
//   }),
//   proposal: Annotation<string>({ reducer: (_, r) => r, default: () => "" }),
//   decision: Annotation<string>({ reducer: (_, r) => r, default: () => "" }),
// });

// const advisorGraph = new StateGraph(AdvisorState)
//   // 节点 1: LLM 分析问题，提出方案
//   .addNode("analyze", async (state) => {
//     console.log("  🧠 LLM 分析中...");
//     const userMsg = state.messages
//       .filter((m) => (m as any).role === "user")
//       .pop() as any;

//     const response = await model.invoke([
//       {
//         role: "system",
//         content:
//           "你是技术顾问。分析用户问题，提出一个具体的行动方案（50 字以内）。只描述方案，不要执行。",
//       },
//       { role: "user", content: userMsg.content },
//     ]);

//     const proposal = response.content as string;
//     console.log(`  💡 方案: ${proposal.slice(0, 80)}...`);

//     return {
//       proposal,
//       messages: [
//         {
//           role: "assistant",
//           content: `[方案] ${proposal}\n\n请审批: approve(批准执行) / deny(拒绝)`,
//         },
//       ],
//     };
//   })
//   // 节点 2: 人工审批
//   .addNode("approval", (_state) => {
//     const decision = interrupt({
//       question: "是否批准以上方案?",
//       options: ["approve", "deny"],
//     });
//     console.log(
//       `  👤 审批: ${typeof decision === "string" ? decision : (decision as any).decision}`
//     );
//     const d = typeof decision === "string" ? decision : (decision as any).decision;
//     return { decision: d };
//   })
//   // 节点 3: 只有批准后才执行
//   .addNode("execute_proposal", async (state) => {
//     console.log("  ⚡ 执行方案...");
//     const response = await model.invoke([
//       {
//         role: "system",
//         content: `根据审批通过，执行以下方案:\n${state.proposal}\n\n请生成执行结果，用中文。`,
//       },
//     ]);
//     return {
//       messages: [{ role: "assistant", content: response.content }],
//     };
//   })
//   .addNode("deny_proposal", (state) => {
//     return {
//       messages: [
//         {
//           role: "assistant",
//           content: `方案被拒绝。原始建议: ${state.proposal.slice(0, 50)}... 请重新描述需求。`,
//         },
//       ],
//     };
//   })
//   .addEdge(START, "analyze")
//   .addEdge("analyze", "approval")
//   .addConditionalEdges("approval", (state) =>
//     state.decision === "approve" ? "execute_proposal" : "deny_proposal"
//   )
//   .addEdge("execute_proposal", END)
//   .addEdge("deny_proposal", END)
//   .compile({ checkpointer: new MemorySaver() });

// const tid2 = "demo-2";
// const cfg2 = { configurable: { thread_id: tid2 } };

// console.log("  [第 1 次 invoke]");
// const r2a = await advisorGraph.invoke(
//   {
//     messages: [
//       {
//         role: "user",
//         content: "我们的 API 响应越来越慢，该怎么优化？",
//       },
//     ],
//     proposal: "",
//     decision: "",
//   },
//   cfg2
// );
// const last2a = r2a.messages[r2a.messages.length - 1] as any;
// console.log(`  ⏸️  ${last2a.content.slice(0, 100)}...\n`);

// console.log("  [第 2 次 invoke — 批准方案]");
// const r2b = await advisorGraph.invoke(new Command({ resume: "approve" }), cfg2);
// const last2b = r2b.messages[r2b.messages.length - 1] as any;
// console.log(`  ✅ ${last2b.content.slice(0, 200)}...\n`);

// ============================================================
// 演示 3: 持久化 Checkpoints — 跨调用保持状态
// ============================================================
console.log("=".repeat(55));
console.log("🧪 演示 3: Checkpoints — 用 MemorySaver 持久化图状态");
console.log("=".repeat(55));
console.log("  场景: 处理客户工单，多个审批点，可在任意时刻中断和恢复\n");

const ticketState = Annotation.Root({
  messages: Annotation<any[]>({
    reducer: (l, r) => l.concat(r),
    default: () => [],
  }),
  step: Annotation<string>({ reducer: (_, r) => r, default: () => "init" }),
  approved: Annotation<boolean>({ reducer: (_, r) => r, default: () => false }),
});

const ticketGraph = new StateGraph(ticketState)
  .addNode("triage", (state) => {
    console.log("  🏷️  Step 1: 分类工单");
    return {
      step: "triage_done",
      messages: [
        {
          role: "assistant",
          content: "工单分类: 技术问题/API 响应慢。需要技术主管审批。",
        },
      ],
    };
  })
  .addNode("tech_approval", (_state) => {
    console.log("  ⏸️  Step 2: 技术主管审批 (interrupt)");
    const decision = interrupt({
      question: "技术主管: 是否有足够资源处理?",
      options: ["approve", "deny"],
    });
    const d = typeof decision === "string" ? decision : (decision as any).decision || decision;
    console.log(`  👤 技术主管: ${d}`);
    return {
      step: "tech_reviewed",
      approved: d === "approve",
      messages: [
        {
          role: "assistant",
          content: d === "approve" ? "技术审批通过 ✅" : "技术审批拒绝 ❌",
        },
      ],
    };
  })
  .addNode("fix", (state) => {
    console.log("  🔧 Step 3: 执行修复");
    return {
      step: "fixed",
      messages: [
        {
          role: "assistant",
          content:
            "修复方案: 1) 添加 Redis 缓存热数据 2) 数据库查询加索引 3) 增加 API 网关限流。预计下个 sprint 完成。",
        },
      ],
    };
  })
  .addNode("close", (state) => {
    console.log("  ✅ Step 4: 关闭工单");
    return {
      step: "done",
      messages: [{ role: "assistant", content: "工单已关闭。修复已排入 backlog。" }],
    };
  })
  .addEdge(START, "triage")
  .addEdge("triage", "tech_approval")
  .addConditionalEdges("tech_approval", (state) =>
    state.approved ? "fix" : "close"
  )
  .addEdge("fix", "close")
  .addEdge("close", END)
  .compile({ checkpointer: new MemorySaver() });

const tid3 = "ticket-001";
const cfg3 = { configurable: { thread_id: tid3 } };

// Step 1: 运行到第一个 interrupt
console.log("  [invoke 1 — 运行到技术审批]");
console.log("  user 输入：  📝 工单: API 响应时间超过 5 秒");
const r3a = await ticketGraph.invoke(
  { messages: [{ role: "user", content: "工单: API 响应时间超过 5 秒" }], step: "init", approved: false },
  cfg3
);
console.log(`  ⏸️  当前步骤: ${r3a.step}\n`);

// Step 2: 审批通过，继续运行
console.log("  [invoke 2 — 审批通过]");
const r3b = await ticketGraph.invoke(new Command({ resume: "approve" }), cfg3);
console.log(`  ⏸️  当前步骤: ${r3b.step}\n`);

console.log(`  🏁 工单流程完成！审批→修复→关闭一气呵成。\n`);
const last3 = r3b.messages[r3b.messages.length - 1] as any;
console.log(`  最终消息: ${last3.content}\n`);

// ============================================================
// 总结
// ============================================================
console.log("=".repeat(55));
console.log("📊 Human-in-the-loop — 核心 API 总结");
console.log("=".repeat(55));
console.log(`
┌──────────────────────┬─────────────────────────────────────┐
│ API                   │ 作用                                │
├──────────────────────┼─────────────────────────────────────┤
│ interrupt(msg)        │ 在节点中挂起图，返回给调用方           │
│ Command({resume: v})  │ 恢复执行，interrupt() 返回 v          │
│ MemorySaver           │ Checkpointer: 保存图状态到内存        │
│ thread_id             │ 标识一次对话/工作流，关联多次 invoke   │
└──────────────────────┴─────────────────────────────────────┘

使用模式:
  1. graph.compile({ checkpointer: new MemorySaver() })  — 启用持久化
  2. config = { configurable: { thread_id: "xxx" } }      — 指定线程 ID
  3. interrupt("提示信息")                                   — 在节点中挂起
  4. graph.invoke(new Command({ resume: value }), config)  — 人工恢复

关键认知:
  - interrupt 不是「暂停线程」— 是「return 一个特殊值，下次 invoke 从这继续」
  - thread_id 是关键 — 同样 ID 的多次 invoke 共享同一个状态
  - MemorySaver 只是内存存储，生产环境用数据库-backed checkpointer
`);
