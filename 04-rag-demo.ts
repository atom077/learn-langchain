import "dotenv/config";
import { createAgent, tool } from "langchain";
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";

// ---- 配置 DeepSeek 模型 ----
const model = new ChatOpenAI({
  model: "deepseek-chat",
  apiKey: process.env.DEEPSEEK_API_KEY,
  configuration: { baseURL: "https://api.deepseek.com/v1" },
});

// ============================================================
// 模拟知识库 — 一份虚构的公司政策文档
// ============================================================
const KNOWLEDGE_BASE = [
  {
    id: "doc-001",
    title: "年假政策",
    content:
      "员工每年享有 10 天带薪年假。工作满 3 年的员工增加到 15 天，满 5 年增加到 20 天。" +
      "年假必须在当年内使用完毕，最多可顺延 5 天至次年 3 月 31 日前。未使用的年假不折算工资。",
  },
  {
    id: "doc-002",
    title: "远程办公政策",
    content:
      "全体员工每周可选择 2 天远程办公。远程办公需提前一天在 HR 系统提交申请。" +
      "新员工入职前 3 个月不允许远程办公，特殊情况需直属上级和 HR 双重审批。" +
      "远程办公期间必须保持在线状态（Slack 10 分钟内响应）。",
  },
  {
    id: "doc-003",
    title: "报销政策",
    content:
      "差旅报销需在出行结束后 30 天内提交。住宿标准：一线城市不超过 ¥500/晚，其他城市不超过 ¥350/晚。" +
      "餐补每人每天 ¥80（无需发票），交通费凭发票实报实销。" +
      "单笔超过 ¥2000 的报销需要部门总监审批。",
  },
  {
    id: "doc-004",
    title: "加班与调休政策",
    content:
      "工作日加班（超过 1 小时起算）：按 1.5 倍工资或 1:1 调休。周末加班：按 2 倍工资或 1:1.5 调休。" +
      "法定节假日加班：按 3 倍工资且不可调休。调休必须在加班发生后 60 天内使用，过期作废。",
  },
  {
    id: "doc-005",
    title: "培训与发展",
    content:
      "每位员工每年有 ¥3000 培训预算，可用于线上课程、技术书籍、行业会议。" +
      "超过 ¥3000 的培训需求需经部门总监审批，并提供学习计划与预期产出。" +
      "公司内部每月举办技术分享会，鼓励员工报名分享（分享者额外获得 ¥500 书籍报销额度）。",
  },
  {
    id: "doc-006",
    title: "设备与办公用品",
    content:
      "新员工入职配备 MacBook Pro（14 寸或 16 寸，按岗位需求）和 27 寸 4K 显示器。" +
      "每 3 年可申请更换电脑。额外外设（机械键盘、鼠标、耳机）预算上限 ¥2000，凭发票报销。" +
      "设备损坏或丢失需立即通知 IT 部门，人为损坏需个人承担维修费用的 30%。",
  },
  {
    id: "doc-007",
    title: "健康福利政策",
    content:
      "公司为所有正式员工提供年度体检（每年一次，合作机构为爱康国宾）。" +
      "同时提供补充商业医疗保险（覆盖门诊和住院，自付比例 10%）。" +
      "与本地健身房 'SuperFit' 有企业合作协议，员工可享 7 折会员优惠。",
  }
];

// ============================================================
// RAG 工具: 搜索知识库
// ============================================================
const searchKnowledgeBase = tool(
  ({ query }) => {
    const q = query.toLowerCase();
    const keywords = q.split(/\s+/).filter((w) => w.length > 1);
    console.log('>>>keywords:', keywords);

    // 计算每篇文档的相关度得分
    const scored = KNOWLEDGE_BASE.map((doc) => {
      const searchTarget = (doc.title + " " + doc.content).toLowerCase();
      let score = 0;

      // 标题匹配权重最高
      if (doc.title.toLowerCase().includes(q) || q.includes(doc.title.toLowerCase())) {
        score += 10;
      }

      // 关键词匹配
      for (const kw of keywords) {
        const regex = new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
        const matches = searchTarget.match(regex);
        if (matches) score += matches.length;
      }

      // 精确短语匹配加分
      if (searchTarget.includes(q)) score += 5;

      return { doc, score };
    });

    // 排序取 Top 3
    const topDocs = scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    if (topDocs.length === 0) {
      return JSON.stringify({
        found: false,
        message: "未找到与查询相关的政策文档。",
        suggestion:
          "请尝试用不同的关键词搜索，或列出所有可用政策主题：" +
          KNOWLEDGE_BASE.map((d) => d.title).join("、"),
      });
    }

    return JSON.stringify({
      found: true,
      count: topDocs.length,
      results: topDocs.map(({ doc, score }) => ({
        title: doc.title,
        content: doc.content,
        relevance: score,
      })),
    });
  },
  {
    name: "search_knowledge_base",
    description:
      "搜索公司内部知识库，获取政策、规定和流程信息。" +
      "当用户询问任何关于公司政策、福利、规定的问题时必须先调用此工具。" +
      "支持主题：年假、远程办公、报销、加班调休、培训、设备。",
    schema: z.object({
      query: z
        .string()
        .describe("搜索关键词，如 '年假'、'报销标准'、'远程办公政策'"),
    }),
  }
);

// ============================================================
// 创建 Agent（带 RAG 能力）
// ============================================================
const agent = createAgent({
  model,
  tools: [searchKnowledgeBase],
});

// ============================================================
// 测试: 一系列基于知识库的问题
// ============================================================
async function ask(question: string) {
  console.log(`\n${"─".repeat(50)}`);
  console.log(`❓ ${question}`);
  console.log(`${"─".repeat(50)}`);

  const result = await agent.invoke({
    messages: [
      {
        role: "system",
        content:
          "你是公司内部助手。回答员工关于公司政策的问题。所有答案必须基于知识库搜索结果，不要编造。如果搜索结果中没有相关信息，诚实告知。用中文回复，简洁清晰。",
      },
      { role: "user", content: question },
    ],
  });
  // console.log('>>>result:');
  // console.log(JSON.stringify(result, null, 2));

  const lastMsg = result.messages[result.messages.length - 1] as {
    content: string;
  };
  console.log(`🤖 ${lastMsg.content}`);
}

// 批量测试
console.log("=".repeat(55));
console.log("📚 RAG Agent — 公司政策知识库问答");
console.log("=".repeat(55));

await ask("我工作了 4 年，每年有多少天年假？");
await ask("远程办公有什么规定？我是刚入职 2 个月的新人。");
await ask("去北京出差，住宿和吃饭的标准是什么？");
await ask("公司有免费健身房吗？");
