/** Parse decimal arithmetic only. Model output is never executed as JavaScript. */
export function calculate(expression: string): number {
  if (!expression.trim() || expression.length > 500) {
    throw new Error("表达式不能为空或超过 500 字符");
  }
  const tokens = expression.match(/(?:\d+(?:\.\d*)?|\.\d+)|[()+\-*/%]|\S/g) ?? [];
  let position = 0;
  function primary(): number {
    const token = tokens[position++];
    if (token === "+") return primary();
    if (token === "-") return -primary();
    if (token === "(") {
      const value = sum();
      if (tokens[position++] !== ")") throw new Error("括号不匹配");
      return value;
    }
    if (!token || !/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(token)) {
      throw new Error("只支持数字与 + - * / % ()");
    }
    return Number(token);
  }
  function product(): number {
    let value = primary();
    while (["*", "/", "%"].includes(tokens[position])) {
      const operator = tokens[position++];
      const right = primary();
      if ((operator === "/" || operator === "%") && right === 0) {
        throw new Error("不能除以零或对零取余");
      }
      value = operator === "*" ? value * right : operator === "/" ? value / right : value % right;
    }
    return value;
  }
  function sum(): number {
    let value = product();
    while (["+", "-"].includes(tokens[position])) {
      const operator = tokens[position++];
      const right = product();
      value = operator === "+" ? value + right : value - right;
    }
    return value;
  }
  const value = sum();
  if (position !== tokens.length || !Number.isFinite(value)) {
    throw new Error("表达式无效或结果超出有限数值范围");
  }
  return value;
}
