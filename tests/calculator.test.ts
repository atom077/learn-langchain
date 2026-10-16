import assert from "node:assert/strict";
import test from "node:test";
import { calculate } from "../src/calculator.js";

test("arithmetic respects precedence, parentheses, signs and decimals", () => {
  for (const [input, expected] of [
    ["15 * 37 + 200", 755], ["(3 + 5) * 2", 16], ["-2 * (-3 + .5)", 5],
    ["10 % 3", 1], ["8 / 4 / 2", 1], ["1.5 + 2.25", 3.75],
  ] as const) assert.equal(calculate(input), expected);
});

test("rejects JavaScript, malformed syntax and non-finite results", () => {
  for (const input of [
    "process.exit()", "globalThis.process.env", "1;2", "1/**/+2", "2**3",
    "1 2", "(1 + 2", "1 +", "", "1/0", "2%0", "1e3", "9".repeat(501),
    `${"9".repeat(200)} * ${"9".repeat(200)}`,
  ]) assert.throws(() => calculate(input), Error, input);
});
