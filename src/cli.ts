#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { createKintoneMockServer, invokeKintoneMockRequest } from "./server.js";
import { MockApiError, MockStore } from "./store.js";
import type { MockFixture } from "./types.js";

const args = process.argv.slice(2);
const command = args[0]?.startsWith("-") || !args[0] ? "serve" : args[0];

try {
  const fixture = await loadFixture();
  if (command === "serve") {
    await serve(fixture);
  } else {
    read(fixture, command);
  }
} catch (error) {
  if (error instanceof MockApiError) {
    console.error(JSON.stringify({ code: error.code, id: null, message: error.message }));
    process.exitCode = 1;
  } else {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

async function serve(fixture: MockFixture): Promise<void> {
  const port = Number(argument("--port") ?? process.env.PORT ?? 3000);
  const hostname = argument("--host") ?? "127.0.0.1";
  const mock = await createKintoneMockServer({ ...fixture, port, hostname });
  console.log(`kintone-mock-server listening on ${mock.url}`);
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => {
      void mock.close().then(() => process.exit(0));
    });
  }
}

function read(fixture: MockFixture, subcommand: string): void {
  const store = new MockStore(fixture);
  const app = required("--app");
  let path: string;
  let params: Record<string, unknown>;

  if (subcommand === "record") {
    path = "/k/v1/record.json";
    params = { app, ...(argument("--id") ? { id: argument("--id") } : {}) };
  } else if (subcommand === "records") {
    path = "/k/v1/records.json";
    params = {
      app,
      ...(argument("--query") ? { query: argument("--query") } : {}),
      ...(argument("--fields") ? { fields: argument("--fields")?.split(",").filter(Boolean) } : {}),
      ...(has("--total-count") ? { totalCount: true } : {}),
    };
  } else if (subcommand === "fields") {
    path = has("--preview") ? "/k/v1/preview/app/form/fields.json" : "/k/v1/app/form/fields.json";
    params = { app };
  } else if (subcommand === "get") {
    path = required("--path");
    params = { app, ...jsonArgument("--params") };
  } else {
    throw new Error(`Unknown command: ${subcommand}`);
  }

  const result = invokeKintoneMockRequest(store, { method: "GET", path, params });
  console.log(JSON.stringify(result, null, has("--pretty") ? 2 : undefined));
}

async function loadFixture(): Promise<MockFixture> {
  const fixturePath = argument("--fixture");
  return fixturePath ? (JSON.parse(await readFile(fixturePath, "utf8")) as MockFixture) : {};
}

function jsonArgument(name: string): Record<string, unknown> {
  const value = argument(name);
  if (!value) return {};
  const parsed: unknown = JSON.parse(value);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error(`${name} must be a JSON object`);
  return parsed as Record<string, unknown>;
}

function required(name: string): string {
  const value = argument(name);
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function argument(name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function has(name: string): boolean {
  return args.includes(name);
}
