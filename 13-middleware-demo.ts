import { AIMessage } from "@langchain/core/messages";
import { fakeModel } from "@langchain/core/testing";
import { createAgent, createMiddleware, tool } from "langchain";
import { z } from "zod";

const contextSchema = z.object({
  userId: z.string(),
  locale: z.string().default("zh-CN"),
});

const getTicketStatus = tool(
  ({ ticketId }) => `工单 ${ticketId} 当前处于处理中，负责人是 Ada。`,
  {
    name: "get_ticket_status",
    description: "查询工单的当前状态和负责人",
    schema: z.object({
      ticketId: z.string().describe("工单编号，例如 LC-101"),
    }),
  },
);

// fakeModel 让本课可以离线运行：先模拟一次工具调用，再模拟最终回答。
const model = fakeModel()
  .respondWithTools([
    { name: "get_ticket_status", args: { ticketId: "LC-101" } },
  ])
  .respond(new AIMessage("工单 LC-101 当前处于处理中，负责人是 Ada。"));

const auditMiddleware = createMiddleware({
  name: "AuditMiddleware",
  contextSchema,
  stateSchema: z.object({
    modelCallCount: z.number().default(0),
  }),
  beforeModel: (state, runtime) => {
    console.log(
      `[beforeModel] call=${state.modelCallCount + 1} user=${runtime.context.userId}`,
    );
    return { modelCallCount: state.modelCallCount + 1 };
  },
  wrapModelCall: async (request, handler) => {
    const { userId, locale } = request.runtime.context;
    const enrichedSystemMessage = request.systemMessage.concat(
      `本次请求来自用户 ${userId}，请使用 ${locale} 回复。`,
    );

    console.log("[wrapModelCall] 已注入本次 invoke 的 context");
    return handler({
      ...request,
      systemMessage: enrichedSystemMessage,
    });
  },
  afterModel: (state) => {
    const lastMessage = state.messages.at(-1);
    console.log(`[afterModel] last=${lastMessage?.getType() ?? "unknown"}`);
  },
});

const agent = createAgent({
  model,
  tools: [getTicketStatus],
  systemPrompt: "你是一个简洁的工单助手。",
  middleware: [auditMiddleware],
  contextSchema,
});

const result = await agent.invoke(
  {
    messages: [
      { role: "user", content: "请查询工单 LC-101 的当前状态。" },
    ],
  },
  {
    context: {
      userId: "learner-001",
      locale: "zh-CN",
    },
  },
);

const lastMessage = result.messages.at(-1);
console.log(`\n[result] modelCallCount=${result.modelCallCount}`);
console.log(`[result] answer=${lastMessage?.content}`);

