import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const root = process.cwd();
const files = readdirSync(root).filter((name) => name.endsWith(".md"));
for (const dir of ["lessons", "reference", "learning-records"]) {
  for (const name of readdirSync(dir)) {
    if (/\.(md|html)$/.test(name)) files.push(`${dir}/${name}`);
  }
}
const errors = [];
let checked = 0;
for (const file of files) {
  const text = readFileSync(file, "utf8");
  const links = file.endsWith(".html")
    ? [...text.matchAll(/(?:href|src)=["']([^"']+)["']/g)].map((match) => match[1])
    : [...text.matchAll(/\[[^\]]*\]\(([^\s)]+)\)/g)].map((match) => match[1]);
  for (const link of links) {
    if (/^(?:[a-z]+:|#|\/\/)/i.test(link)) continue;
    const path = decodeURIComponent(link.split(/[?#]/)[0]);
    if (!path) continue;
    checked++;
    if (!existsSync(resolve(dirname(resolve(root, file)), path))) {
      errors.push(`${file}: missing ${link}`);
    }
  }
}
if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Checked ${checked} local links in ${files.length} documents.`);
}
