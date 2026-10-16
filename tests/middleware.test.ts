import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

test("offline middleware demo executes a tool and both model hooks without credentials", () => {
  const result = spawnSync(process.execPath, ["--import", "tsx", "13-middleware-demo.ts"], {
    encoding: "utf8",
    timeout: 30_000,
    env: { ...process.env, DEEPSEEK_API_KEY: "", DEEPSEEK_MODEL: "" },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /\[beforeModel\] call=1 user=learner-001/);
  assert.match(result.stdout, /\[beforeModel\] call=2 user=learner-001/);
  assert.match(result.stdout, /\[result\] modelCallCount=2/);
  assert.match(result.stdout, /\[result\] answer=工单 LC-101 当前处于处理中，负责人是 Ada。/);
});
