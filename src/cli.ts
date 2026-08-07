#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { createKintoneMockServer } from "./server.js";
import type { MockFixture } from "./types.js";

const args = process.argv.slice(2);
const port = Number(argument("--port") ?? process.env.PORT ?? 3000);
const hostname = argument("--host") ?? "127.0.0.1";
const fixturePath = argument("--fixture");
const fixture = fixturePath ? (JSON.parse(await readFile(fixturePath, "utf8")) as MockFixture) : {};
const mock = await createKintoneMockServer({ ...fixture, port, hostname });
console.log(`kintone-mock-server listening on ${mock.url}`);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    void mock.close().then(() => process.exit(0));
  });
}

function argument(name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}
