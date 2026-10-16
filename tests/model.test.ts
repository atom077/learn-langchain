import assert from "node:assert/strict";
import test from "node:test";
import { demoModelOptions } from "../src/model.js";

test("configuration fails before requesting a model and does not expose keys", () => {
  assert.throws(() => demoModelOptions({}), /DEEPSEEK_API_KEY/);
  assert.throws(() => demoModelOptions({ DEEPSEEK_API_KEY: "your-key" }), /DEEPSEEK_API_KEY/);
  assert.throws(() => demoModelOptions({ DEEPSEEK_API_KEY: "test-credential" }), /DEEPSEEK_MODEL/);
  assert.throws(() => demoModelOptions({ DEEPSEEK_API_KEY: "test-credential", DEEPSEEK_MODEL: "your-model-id" }), /DEEPSEEK_MODEL/);
});

test("uses the configured model with a bounded timeout and retries", () => {
  const options = demoModelOptions({ DEEPSEEK_API_KEY: "test-credential", DEEPSEEK_MODEL: "test-model" });
  assert.equal(options.model, "test-model");
  assert.equal(options.configuration.baseURL, "https://api.deepseek.com/v1");
  assert.equal(options.timeout, 60_000);
  assert.equal(options.maxRetries, 2);
});
