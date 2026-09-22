import "dotenv/config";
import { createAgent, tool } from "langchain";
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

// ---- 配置 DeepSeek 模型 ----
const model = new ChatOpenAI({
  model: "deepseek-v4-flash",
  apiKey: process.env.DEEPSEEK_API_KEY,
  configuration: { baseURL: "https://api.deepseek.com/v1" },
});

// ============================================================
// 模式 1: 复杂 Schema — 嵌套对象、枚举、可选字段
// ============================================================
const searchProducts = tool(
  async ({ query, filters }) => {
    // 模拟产品数据库
    const products = [
      { id: 1, name: "TypeScript 实战", category: "book", price: 59, inStock: true },
      { id: 2, name: "React 进阶", category: "book", price: 79, inStock: true },
      { id: 3, name: "机械键盘 K8 Pro", category: "electronics", price: 399, inStock: false },
      { id: 4, name: "TypeScript 设计模式", category: "book", price: 49, inStock: true },
      { id: 5, name: "4K 显示器", category: "electronics", price: 2499, inStock: true },
    ];

    let results = products;

    // 关键词搜索
    if (query) {
      const q = query.toLowerCase();
      results = results.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q)
      );
    }

    // 分类过滤
    if (filters?.category) {
      results = results.filter((p) => p.category === filters!.category);
    }

    // 价格范围
    if (filters?.minPrice !== undefined) {
      results = results.filter((p) => p.price >= filters!.minPrice!);
    }
    if (filters?.maxPrice !== undefined) {
      results = results.filter((p) => p.price <= filters!.maxPrice!);
    }

    // 只显示有货
    if (filters?.inStockOnly) {
      results = results.filter((p) => p.inStock);
    }

    // 排序
    if (filters?.sortBy === "price_asc") {
      results.sort((a, b) => a.price - b.price);
    } else if (filters?.sortBy === "price_desc") {
      results.sort((a, b) => b.price - a.price);
    }

    return JSON.stringify({
      count: results.length,
      products: results.map(({ id, name, price, inStock }) => ({
        id,
        name,
        price: `¥${price}`,
        inStock,
      })),
    });
  },
  {
    name: "search_products",
    description:
      "搜索产品。支持关键词、分类过滤、价格范围、库存过滤和多字段排序。",
    schema: z.object({
      query: z.string().describe("搜索关键词，匹配产品名称或分类"),
      filters: z
        .object({
          category: z
            .enum(["book", "electronics", "clothing"])
            .describe("产品分类")
            .optional(),
          minPrice: z.number().min(0).describe("最低价格").optional(),
          maxPrice: z.number().min(0).describe("最高价格").optional(),
          inStockOnly: z
            .boolean()
            .describe("true 表示只返回有库存的商品")
            .optional(),
          sortBy: z
            .enum(["price_asc", "price_desc"])
            .describe("排序方式")
            .optional(),
        })
        .describe("过滤和排序选项")
        .optional(),
    }),
  }
);

// ============================================================
// 模式 2: 结构化错误 — 让 Agent 能从错误中恢复
// ============================================================
const transferMoney = tool(
  async ({ fromAccount, toAccount, amount }) => {
    // 模拟账户余额
    const balances: Record<string, number> = {
      checking: 5000,
      savings: 20000,
    };

    // 结构化错误：不抛异常，返回错误对象
    if (!balances[fromAccount]) {
      return JSON.stringify({
        success: false,
        error: "ACCOUNT_NOT_FOUND",
        message: `账户 '${fromAccount}' 不存在。可用账户: ${Object.keys(balances).join(", ")}`,
      });
    }

    if (balances[fromAccount] < amount) {
      return JSON.stringify({
        success: false,
        error: "INSUFFICIENT_BALANCE",
        message: `账户 '${fromAccount}' 余额不足。当前余额: ¥${balances[fromAccount]}，需要: ¥${amount}`,
        currentBalance: balances[fromAccount],
        shortfall: amount - balances[fromAccount],
      });
    }

    // 执行转账
    balances[fromAccount] -= amount;
    if (balances[toAccount] !== undefined) {
      balances[toAccount] += amount;
    }

    return JSON.stringify({
      success: true,
      transaction: {
        from: fromAccount,
        to: toAccount,
        amount: `¥${amount}`,
        newBalance: balances[fromAccount],
      },
    });
  },
  {
    name: "transfer_money",
    description:
      "在两个账户之间转账。如果账户不存在或余额不足，会返回具体的错误信息，请根据错误信息引导用户修正。",
    schema: z.object({
      fromAccount: z.string().describe("转出账户名，如 'checking' 或 'savings'"),
      toAccount: z.string().describe("转入账户名"),
      amount: z.number().positive().describe("转账金额（元）"),
    }),
  }
);

// ============================================================
// 模式 3: 异步工具 — 调用外部 API
// ============================================================
const getStockPrice = tool(
  async ({ symbol }) => {
    // 模拟 API 调用延迟
    await new Promise((r) => setTimeout(r, 300));

    // 模拟股票数据
    const stocks: Record<string, { price: number; change: number }> = {
      AAPL: { price: 198.5, change: 2.3 },
      GOOGL: { price: 145.2, change: -0.8 },
      TSLA: { price: 255.8, change: 5.1 },
      MSFT: { price: 430.6, change: 1.2 },
    };

    const stock = stocks[symbol.toUpperCase()];
    if (!stock) {
      return JSON.stringify({
        success: false,
        error: "SYMBOL_NOT_FOUND",
        message: `找不到股票代码 '${symbol}'。支持的代码: ${Object.keys(stocks).join(", ")}`,
      });
    }

    return JSON.stringify({
      success: true,
      symbol: symbol.toUpperCase(),
      price: `$${stock.price}`,
      change: `${stock.change > 0 ? "+" : ""}${stock.change}%`,
      timestamp: new Date().toISOString(),
    });
  },
  {
    name: "get_stock_price",
    description: "获取股票实时价格和涨跌幅。仅支持美股代码（AAPL, GOOGL, TSLA, MSFT）。",
    schema: z.object({
      symbol: z.string().describe("股票代码，如 AAPL、TSLA"),
    }),
  }
);

// ============================================================
// 创建 Agent 并测试
// ============================================================
const agent = createAgent({
  model,
  tools: [searchProducts, transferMoney, getStockPrice],
});

// 用 zodToJsonSchema 把 Zod schema 转成标准 JSON Schema
// console.log("=== searchProducts ZodSchema → JSON Schema ===");
// console.log(JSON.stringify(zodToJsonSchema(searchProducts.schema), null, 2));

let systemPrompt = "你是电商助手。用中文回复，简洁清晰。";
let humanContent = "帮我搜一下 TypeScript 相关的书，只要 50 块以内的，按价格从低到高排。";
console.log("\n" + "=".repeat(55));
console.log(`🧪 测试 1: 复杂 Schema — 嵌套过滤 + 排序\n${systemPrompt}\n${humanContent}`);
console.log("=".repeat(55));

const r1 = await agent.invoke({
  messages: [
    { role: "system", content: systemPrompt },
    { role: "user", content: humanContent },
  ],
});
console.log(
  (r1.messages[r1.messages.length - 1] as { content: string }).content
);

systemPrompt = "你是银行助手。用中文回复。如果操作失败，清晰解释原因并给出解决建议。"
humanContent = "从 checking 账户转 10000 到 savings。"
console.log("\n" + "=".repeat(55));
console.log(`🧪 测试 2: 结构化错误 — 错误时引导用户修正\n${systemPrompt}\n${humanContent}`);
console.log("=".repeat(55));

const r2 = await agent.invoke({
  messages: [
    { role: "system", content: systemPrompt },
    { role: "user", content: humanContent },
  ],
});
// console.log(">>>result:");
// console.log(JSON.stringify(r2, null, 2));
console.log(
  (r2.messages[r2.messages.length - 1] as { content: string }).content
);

console.log("\n" + "=".repeat(55));
console.log("🧪 测试 3: 异步工具 — 股票查询");
console.log("=".repeat(55));

const r3 = await agent.invoke({
  messages: [
    { role: "system", content: "你是金融助手。用中文回复，数据清晰。" },
    { role: "user", content: "帮我查一下 AAPL 和 TSLA 的股价。" },
  ],
});
console.log(
  (r3.messages[r3.messages.length - 1] as { content: string }).content
);
