/** Tool.invoke may return text or a ToolMessage, depending on the input shape. */
export function toolOutputText(output: string | { content: unknown }): string {
  if (typeof output === "string") return output;
  return typeof output.content === "string"
    ? output.content
    : JSON.stringify(output.content) ?? "";
}
