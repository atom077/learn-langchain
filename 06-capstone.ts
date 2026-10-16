import { isAIMessage } from "@langchain/core/messages";
import { calculate } from "./src/calculator.js";
import * as readline from "node:readline";
import { createAgent, tool } from "langchain";
import { createDemoModel } from "./src/model.js";
import { z } from "zod";

// ============================================================
// 配置 DeepSeek 模型
// ============================================================
const model = createDemoModel();

// ============================================================
// 个人知识库 (RAG)
// ============================================================
interface Note {
  id: number;
  title: string;
  content: string;
  tags: string[];
  createdAt: string;
}

// 以下人物、会议、指标和个人笔记均为教学用虚构数据。
const knowledgeBase: Note[] = [
  {
    id: 1,
    title: "项目架构决策",
    content:
      "2025 Q3 决定将后端从 Express 迁移到 Fastify。主要原因是 Fastify 的插件系统更适合微服务架构，" +
      "且序列化性能比 Express 快 2-3 倍。迁移分三个阶段：先迁移新服务、再迁移低流量旧服务、最后迁移核心服务。",
    tags: ["技术", "架构", "后端"],
    createdAt: "2025-07-01",
  },
  {
    id: 2,
    title: "周会纪要 7/7",
    content:
      "本周讨论了 Q3 OKR。重点目标：完成 AI Agent 平台的 MVP（8 月底），用户留存率提升至 45%。" +
      "技术债：用户服务的单元测试覆盖率从 62% 提升到 85%。" +
      "小明负责 Agent 平台后端，小红负责前端交互设计，大刚负责测试基础设施。",
    tags: ["会议", "OKR", "团队"],
    createdAt: "2025-07-07",
  },
  {
    id: 3,
    title: "LangChain.js 学习笔记",
    content:
      "LangChain.js v1 核心 API：createAgent() + tool()。Agent 通过 ReAct 循环自主决策。" +
      "消息类型的判断用 _getType() 而不是 .role。Memory 本质上就是消息数组的管理策略，" +
      "不是框架黑盒。RAG 可以封装为 tool 让 Agent 自主决定何时搜索。",
    tags: ["学习", "LangChain", "技术"],
    createdAt: "2025-07-09",
  },
  {
    id: 4,
    title: "面试准备 — 行为问题",
    content:
      "STAR 法则准备：1) 最有挑战的项目 — AI Agent 平台的工具调用链设计；" +
      "2) 团队冲突 — 技术选型分歧时如何用数据驱动决策；" +
      "3) 失败经历 — 过早优化导致项目延期，学会了先测量再优化。",
    tags: ["职业", "面试"],
    createdAt: "2025-07-12",
  },
  {
    id: 5,
    title: "健身计划",
    content:
      "周一三五：力量训练（推拉腿分化）。周二四：有氧 30 分钟（跑步或游泳）。" +
      "饮食：每天 1800 卡，蛋白质 140g。目标：3 个月体脂率从 22% 降到 18%。",
    tags: ["生活", "健身"],
    createdAt: "2025-07-14",
  },
];

// ============================================================
// Tool 1: RAG — 搜索个人知识库
// ============================================================
const searchNotes = tool(
  ({ query }) => {
    const q = query.toLowerCase();
    const keywords = q.split(/\s+/).filter((w) => w.length > 1);

    const scored = knowledgeBase.map((note) => {
      const searchTarget =
        `${note.title} ${note.content} ${note.tags.join(" ")}`.toLowerCase();
      let score = 0;

      // 标题精确匹配权重最高
      if (note.title.toLowerCase().includes(q)) score += 10;
      // 标签匹配
      for (const tag of note.tags) {
        if (q.includes(tag.toLowerCase())) score += 8;
      }
      // 关键词匹配
      for (const kw of keywords) {
        const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const matches = searchTarget.match(new RegExp(escaped, "gi"));
        if (matches) score += matches.length;
      }
      // 短语精确匹配
      if (searchTarget.includes(q)) score += 5;

      return { note, score };
    });

    const top = scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    if (top.length === 0) {
      return JSON.stringify({
        found: false,
        message:
          "未找到相关笔记。可用标签：" +
          [...new Set(knowledgeBase.flatMap((n) => n.tags))].join("、"),
      });
    }

    return JSON.stringify({
      found: true,
      count: top.length,
      results: top.map(({ note, score }) => ({
        id: note.id,
        title: note.title,
        content: note.content,
        tags: note.tags,
        relevance: score,
        createdAt: note.createdAt,
      })),
    });
  },
  {
    name: "search_notes",
    description:
      "搜索个人知识库中的笔记。当用户询问任何关于项目、会议、学习记录、职业规划、" +
      "健身计划等信息时，必须先搜索知识库。支持按标题、内容、标签搜索。",
    schema: z.object({
      query: z.string().describe("搜索关键词，如 '架构'、'面试'、'健身'、'OKR'"),
    }),
  }
);

// ============================================================
// Tool 2: 添加笔记
// ============================================================
const addNote = tool(
  ({ title, content, tags }) => {
    const id = knowledgeBase.length + 1;
    const note: Note = {
      id,
      title,
      content,
      tags,
      createdAt: new Date().toISOString().split("T")[0],
    };
    knowledgeBase.push(note);
    return JSON.stringify({
      success: true,
      note: { id: note.id, title: note.title, createdAt: note.createdAt },
      message: `笔记「${title}」已保存。当前知识库共 ${knowledgeBase.length} 条笔记。`,
    });
  },
  {
    name: "add_note",
    description:
      "向个人知识库中添加一条新笔记。当用户说「记一下」「帮我记下来」「添加笔记」时调用。",
    schema: z.object({
      title: z.string().describe("笔记标题，5-20 字"),
      content: z.string().describe("笔记正文，要记录的具体内容"),
      tags: z
        .array(z.string())
        .describe("标签列表，如 ['技术', 'LangChain']，用于后续分类检索"),
    }),
  }
);

// ============================================================
// Tool 3: 计算器
// ============================================================
const calculator = tool(
  ({ expression }) => {
    try {
      const result = calculate(expression);
      return JSON.stringify({ expression, result, success: true });
    } catch {
      return JSON.stringify({
        success: false,
        error: "计算失败，请检查表达式格式。支持: + - * / () %",
      });
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

// ============================================================
// Tool 4: 获取当前时间
// ============================================================
const getCurrentTime = tool(
  () => {
    const now = new Date();
    return JSON.stringify({
      datetime: now.toISOString(),
      readable: now.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" }),
      weekday: ["日", "一", "二", "三", "四", "五", "六"][now.getDay()],
      timestamp: now.getTime(),
    });
  },
  {
    name: "get_current_time",
    description: "获取当前日期和时间。",
    schema: z.object({}),
  }
);

// ============================================================
// 创建 Agent
// ============================================================
const agent = createAgent({
  model,
  tools: [searchNotes, addNote, calculator, getCurrentTime],
});

// ============================================================
// Memory 管理: Summary + Window 混合策略
// ============================================================
type Message = {
  role: "system" | "user" | "assistant";
  content: string;
}

const WINDOW_SIZE = 6; // system + 最近 5 条（约 2-3 轮对话）
const SUMMARIZE_THRESHOLD = 10; // 超过 10 条时触发摘要压缩

let history: Message[] = [];
const systemPrompt = `你是「个人 AI 助手」。你拥有以下能力：
- 搜索用户的个人知识库（笔记、会议记录、学习资料等）
- 帮用户记录新笔记
- 数学计算
- 查看当前时间

沟通风格：简洁、直接、像一位熟悉用户背景的同事。`;
let summary = ""; // 早期对话的摘要

function buildMessages(userInput: string): Message[] {
  const systemContent = summary
    ? `${systemPrompt}\n${summary}`
    : systemPrompt;

  const systemMsg: Message = { role: "system", content: systemContent };

  // 窗口截断：保留 system + 最近 (WINDOW_SIZE - 1) 条历史 + 当前用户消息
  const recentHistory = history.slice(-(WINDOW_SIZE - 1));
  return [systemMsg, ...recentHistory, { role: "user", content: userInput }];
}

async function compressHistory(): Promise<void> {
  // 将超出窗口的早期消息压缩为摘要
  if (history.length <= SUMMARIZE_THRESHOLD) return;

  const earlyMessages = history.slice(0, -(WINDOW_SIZE - 1));
  const recentMessages = history.slice(-(WINDOW_SIZE - 1));

  // 用模型生成摘要
  const compressResult = await model.invoke([
    {
      role: "system",
      content:
        "你是对话摘要器。请将以下对话历史压缩为一段简洁的摘要（1-3 句话），" +
        "保留关键信息：用户名字、偏好、重要决策、待办事项。用中文。",
    },
    {
      role: "user",
      content: earlyMessages
        .map((m) => `[${m.role}] ${m.content.slice(0, 150)}`)
        .join("\n"),
    },
  ]);

  summary = `[对话背景] ${compressResult.content}`;
  history = recentMessages;
}

// ============================================================
// 流式交互: 展示 ReAct 循环
// ============================================================
async function chat(userInput: string): Promise<string> {
  const messages = buildMessages(userInput);

  const stream = await agent.stream({ messages });

  let thinkingShown = false;
  let finalContent = "";

  for await (const chunk of stream) {
    const source = Object.keys(chunk)[0] as "model_request" | "tools";
    const data = chunk[source];

    if (source === "model_request") {
      for (const msg of data.messages) {
        if (isAIMessage(msg)) {
          // AI 回复中的文本内容
          const text = typeof msg.content === "string" ? msg.content : "";
          if (text && !text.includes("tool_calls")) {
            if (!thinkingShown) {
              process.stdout.write("\n🤖 ");
              thinkingShown = true;
            }
            process.stdout.write(text);
            finalContent += text;
          }
          // tool_calls 显示为 "思考"
          if (msg.tool_calls?.length && !thinkingShown) {
            for (const tc of msg.tool_calls) {
              process.stdout.write(`\n🧠 调用工具: ${tc.name}...`);
            }
          }
        }
      }
    } else if (source === "tools") {
      // 工具返回结果
      for (const toolMsg of data.messages) {
        if (toolMsg._getType() === "tool") {
          const preview = String(toolMsg.content).slice(0, 80);
          process.stdout.write(`\n📋 工具返回: ${preview}...`);
        }
      }
    }
  }

  if (finalContent) process.stdout.write("\n");
  return finalContent;
}

// ============================================================
// 非流式 fallback（流式出错时用）
// ============================================================
async function chatFallback(userInput: string): Promise<string> {
  const messages = buildMessages(userInput);
  const result = await agent.invoke({ messages });
  const lastMsg = result.messages[result.messages.length - 1] as {
    content: string;
  };
  return lastMsg.content;
}

// ============================================================
// 启动交互式 CLI
// ============================================================
function main() {
  console.clear();
  console.log("═".repeat(60));
  console.log("  🤖 个人 AI 助手 — 基于 LangChain.js 构建");
  console.log("═".repeat(60));
  console.log("  能力: 📚 搜索笔记 | ✍️  添加笔记 | 🧮 计算 | 🕐 时间");
  console.log("  记忆: 🧠 Summary + Window 混合策略");
  console.log("  命令: /notes(知识库概览) /clear(重置记忆) /exit(退出)");
  console.log("═".repeat(60));
  console.log(`  知识库中已有 ${knowledgeBase.length} 条笔记`);
  console.log("  试着问我: 「最近有什么会议纪要？」「帮我记个笔记」");
  console.log("═".repeat(60) + "\n");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "\n👤 你: ",
  });

  rl.prompt();

  rl.on("line", async (line) => {
    const input = line.trim();
    if (!input) {
      rl.prompt();
      return;
    }

    // 特殊命令
    if (input === "/exit") {
      console.log("\n👋 再见！");
      rl.close();
      return;
    }

    if (input === "/clear") {
      history = [];
      summary = "";
      console.log("\n🧹 对话记忆已重置。\n");
      rl.prompt();
      return;
    }

    if (input === "/notes") {
      console.log("\n📚 知识库概览:");
      knowledgeBase.forEach((n) => {
        console.log(`  [${n.id}] ${n.title} — ${n.tags.join(", ")}`);
        console.log(`      ${n.content.slice(0, 80)}...`);
      });
      console.log();
      rl.prompt();
      return;
    }

    // 正常对话
    try {
      let reply: string;
      try {
        reply = await chat(input);
      } catch {
        // 流式可能失败（某些模型不支持），fallback 到 invoke
        reply = await chatFallback(input);
      }

      if (reply) {
        // 更新历史
        history.push({ role: "user", content: input });
        history.push({ role: "assistant", content: reply });

        // 检查是否需要压缩
        await compressHistory();

        if (summary) {
          console.log(`  ℹ️  已压缩早期对话为摘要 (历史长度: ${history.length})`);
        }
      }
    } catch (err: any) {
      console.log(`\n❌ 错误: ${err.message || err}`);
    }

    rl.prompt();
  });

  rl.on("close", () => {
    console.log("\n感谢使用个人 AI 助手！\n");
    process.exit(0);
  });
}

main();
