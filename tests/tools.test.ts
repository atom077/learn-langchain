import assert from "node:assert/strict";
import test from "node:test";
import { toolOutputText } from "../src/tools.js";

test("normalizes text and structured tool messages", () => {
  assert.equal(toolOutputText("42"), "42");
  assert.equal(toolOutputText({ content: "42" }), "42");
  assert.equal(toolOutputText({ content: [{ type: "text", text: "42" }] }), '[{"type":"text","text":"42"}]');
});
