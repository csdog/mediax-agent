export function printJson(value: unknown, pretty = true) {
  const text = pretty ? JSON.stringify(value, null, 2) : JSON.stringify(value);
  process.stdout.write(`${text}\n`);
}

export function printLines(lines: string[]) {
  process.stdout.write(`${lines.join("\n")}\n`);
}
