import "dotenv/config";
import { ChatOpenAI } from "@langchain/openai";

/** Validate locally before any request; never include credentials in errors. */
export function demoModelOptions(env: NodeJS.ProcessEnv = process.env) {
  const apiKey = env.DEEPSEEK_API_KEY?.trim();
  const model = env.DEEPSEEK_MODEL?.trim();
  if (!apiKey || /^(your-|replace-|example)/i.test(apiKey)) {
    throw new Error("请复制 .env.example 为 .env，并填写 DEEPSEEK_API_KEY。离线体验可运行 npm run demo:13。");
  }
  if (!model || /^(your-|replace-|example)/i.test(model)) {
    throw new Error("请在 .env 中设置 DEEPSEEK_MODEL，填写你的 DeepSeek 账户可用的模型 ID。");
  }
  return {
    model,
    apiKey,
    configuration: { baseURL: "https://api.deepseek.com/v1" },
    timeout: 60_000,
    maxRetries: 2,
  };
}

export function createDemoModel() {
  return new ChatOpenAI(demoModelOptions());
}
