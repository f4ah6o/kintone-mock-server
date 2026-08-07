import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { once } from "node:events";
import { applyQuery } from "./query.js";
import { MockApiError, MockStore, cloneRecord, responseRecord } from "./store.js";
import type { KintoneRecord, MockServerOptions } from "./types.js";

export interface MockRequest {
  method: string;
  path: string;
  params: Record<string, unknown>;
}

export interface KintoneMockServer {
  readonly store: MockStore;
  readonly server: Server;
  readonly url: string;
  close(): Promise<void>;
}

export async function createKintoneMockServer(options: MockServerOptions = {}): Promise<KintoneMockServer> {
  const store = new MockStore(options.apps ? { apps: options.apps } : {});
  const server = createServer((request, response) => {
    void dispatch(store, request, response);
  });
  server.listen(options.port ?? 0, options.hostname ?? "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Could not determine listening address");
  const hostname = address.address === "::" ? "127.0.0.1" : address.address;
  return {
    store,
    server,
    url: `http://${hostname}:${address.port}`,
    async close() {
      server.close();
      await once(server, "close");
    },
  };
}

export function invokeKintoneMockRequest(store: MockStore, request: MockRequest): unknown {
  return route(store, { ...request, method: request.method.toUpperCase() });
}

async function dispatch(store: MockStore, request: IncomingMessage, response: ServerResponse): Promise<void> {
  try {
    const data = await requestData(request);
    const result = invokeKintoneMockRequest(store, data);
    json(response, 200, result);
  } catch (error) {
    if (error instanceof MockApiError) {
      json(response, error.status, { code: error.code, id: null, message: error.message });
      return;
    }
    json(response, 500, { code: "MOCK_INTERNAL", id: null, message: error instanceof Error ? error.message : String(error) });
  }
}

function route(store: MockStore, request: MockRequest): unknown {
  const path = normalizePath(request.path);
  if (path === "/k/v1/record.json") return recordRoute(store, request);
  if (path === "/k/v1/records.json") return recordsRoute(store, request);
  if (path === "/k/v1/records/cursor.json") return cursorRoute(store, request);
  if (path === "/k/v1/app/form/fields.json") return fieldsRoute(store, request, false);
  if (path === "/k/v1/preview/app/form/fields.json") return fieldsRoute(store, request, true);
  throw new MockApiError("MOCK_NOT_FOUND", `Unsupported endpoint: ${request.path}`, 404);
}

function recordRoute(store: MockStore, request: MockRequest): unknown {
  const app = store.app(request.params.app);
  if (request.method === "GET") {
    const target = findRecord(app.records, request.params);
    return { record: responseRecord(target) };
  }
  if (request.method === "POST") {
    const id = String(app.nextRecordId++);
    const record = asRecord(request.params.record ?? {});
    app.records.push({ id, revision: 1, record: cloneRecord(record) });
    return { id, revision: "1" };
  }
  if (request.method === "PUT") {
    const target = findRecord(app.records, request.params);
    assertRevision(target.revision, request.params.revision);
    mergeRecord(target.record, asRecord(request.params.record ?? {}));
    target.revision += 1;
    return { revision: String(target.revision) };
  }
  throw methodNotAllowed(request);
}

function recordsRoute(store: MockStore, request: MockRequest): unknown {
  const app = store.app(request.params.app);
  if (request.method === "GET") {
    const all = app.records.map(responseRecord);
    const query = String(request.params.query ?? "");
    const filtered = applyQuery(all, query).map((record) => selectFields(record, stringArray(request.params.fields)));
    return { records: filtered, totalCount: truthy(request.params.totalCount) ? String(all.length) : null };
  }
  if (request.method === "POST") {
    const records = recordArray(request.params.records);
    const ids: string[] = [];
    const revisions: string[] = [];
    for (const record of records) {
      const id = String(app.nextRecordId++);
      app.records.push({ id, revision: 1, record: cloneRecord(record) });
      ids.push(id);
      revisions.push("1");
    }
    return { ids, revisions };
  }
  if (request.method === "PUT") {
    const updates = objectArray(request.params.records);
    const revisions = updates.map((update) => {
      const target = findRecord(app.records, update);
      assertRevision(target.revision, update.revision);
      mergeRecord(target.record, asRecord(update.record ?? {}));
      target.revision += 1;
      return { id: target.id, revision: String(target.revision) };
    });
    return { records: revisions };
  }
  if (request.method === "DELETE") {
    const ids = stringArray(request.params.ids);
    const revisions = request.params.revisions == null ? [] : stringArray(request.params.revisions);
    ids.forEach((id, index) => {
      const position = app.records.findIndex((record) => record.id === id);
      if (position < 0) throw new MockApiError("GAIA_RE20", `Record ${id} was not found.`, 404);
      const target = app.records[position];
      if (!target) throw new MockApiError("GAIA_RE20", `Record ${id} was not found.`, 404);
      assertRevision(target.revision, revisions[index]);
      app.records.splice(position, 1);
    });
    return {};
  }
  throw methodNotAllowed(request);
}

function cursorRoute(store: MockStore, request: MockRequest): unknown {
  if (request.method === "POST") {
    const app = store.app(request.params.app);
    const fields = stringArray(request.params.fields);
    const records = applyQuery(app.records.map(responseRecord), String(request.params.query ?? ""));
    const size = Math.min(Math.max(Number(request.params.size ?? 100), 1), 500);
    const id = store.createCursor({ app: app.id, records, size, ...(fields.length ? { fields } : {}) });
    return { id, totalCount: String(records.length) };
  }
  const id = String(request.params.id ?? "");
  const cursor = store.cursors.get(id);
  if (!cursor) throw new MockApiError("GAIA_CU01", `Cursor ${id} was not found.`, 404);
  if (request.method === "GET") {
    const chunk = cursor.records.slice(cursor.index, cursor.index + cursor.size).map((record) => selectFields(record, cursor.fields ?? []));
    cursor.index += chunk.length;
    const next = cursor.index < cursor.records.length;
    if (!next) store.cursors.delete(id);
    return { records: chunk, next };
  }
  if (request.method === "DELETE") {
    store.cursors.delete(id);
    return {};
  }
  throw methodNotAllowed(request);
}

function fieldsRoute(store: MockStore, request: MockRequest, preview: boolean): unknown {
  const app = store.app(request.params.app);
  if (request.method === "GET") {
    const properties = preview ? app.previewFields : app.fields;
    return { properties: structuredClone(properties), revision: String(app.revision) };
  }
  if (!preview) throw methodNotAllowed(request);
  assertRevision(app.revision, request.params.revision);
  if (request.method === "POST" || request.method === "PUT") {
    const properties = asObject(request.params.properties);
    for (const [currentCode, value] of Object.entries(properties)) {
      const property = asFieldProperty(value, currentCode);
      if (request.method === "PUT" && property.code !== currentCode) delete app.previewFields[currentCode];
      app.previewFields[property.code] = structuredClone(property);
    }
    app.revision += 1;
    return { revision: String(app.revision) };
  }
  if (request.method === "DELETE") {
    for (const field of stringArray(request.params.fields)) delete app.previewFields[field];
    app.revision += 1;
    return { revision: String(app.revision) };
  }
  throw methodNotAllowed(request);
}

async function requestData(request: IncomingMessage): Promise<MockRequest> {
  const url = new URL(request.url ?? "/", "http://localhost");
  const query: Record<string, unknown> = {};
  for (const [key, value] of url.searchParams) {
    const arrayMatch = key.match(/^(.+)\[(\d+)\]$/);
    if (arrayMatch?.[1]) {
      const name = arrayMatch[1];
      const values = (query[name] ??= []) as unknown[];
      values[Number(arrayMatch[2])] = value;
    } else query[key] = value;
  }
  const body = await jsonBody(request);
  return { method: (request.method ?? "GET").toUpperCase(), path: url.pathname, params: { ...query, ...body } };
}

async function jsonBody(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  if (chunks.length === 0) return {};
  const text = Buffer.concat(chunks).toString("utf8").trim();
  if (!text) return {};
  const parsed: unknown = JSON.parse(text);
  return asObject(parsed);
}

function normalizePath(path: string): string {
  return path.replace(/^\/k\/guest\/\d+\/v1\//, "/k/v1/");
}

function findRecord(records: Array<{ id: string; revision: number; record: KintoneRecord }>, params: Record<string, unknown>) {
  if (params.id != null) {
    const found = records.find((record) => record.id === String(params.id));
    if (found) return found;
  }
  const key = params.updateKey;
  if (key && typeof key === "object") {
    const { field, value } = key as { field?: unknown; value?: unknown };
    const found = records.find((record) => record.record[String(field)]?.value === value);
    if (found) return found;
  }
  throw new MockApiError("GAIA_RE20", "Record was not found.", 404);
}

function assertRevision(current: number, expected: unknown): void {
  if (expected == null || String(expected) === "-1") return;
  if (Number(expected) !== current) throw new MockApiError("GAIA_CO02", "Revision does not match.", 409);
}

function selectFields(record: KintoneRecord, fields: string[]): KintoneRecord {
  if (fields.length === 0) return record;
  const selected: KintoneRecord = {};
  for (const field of fields) if (record[field]) selected[field] = structuredClone(record[field]);
  return selected;
}

function mergeRecord(target: KintoneRecord, update: KintoneRecord): void {
  for (const [key, value] of Object.entries(update)) target[key] = structuredClone(value);
}

function asRecord(value: unknown): KintoneRecord {
  return asObject(value) as KintoneRecord;
}

function recordArray(value: unknown): KintoneRecord[] {
  return objectArray(value).map(asRecord);
}

function objectArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) throw new MockApiError("CB_VA01", "Expected an array.");
  return value.map(asObject);
}

function stringArray(value: unknown): string[] {
  if (value == null) return [];
  if (!Array.isArray(value)) return [String(value)];
  return value.filter((item) => item != null).map(String);
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new MockApiError("CB_VA01", "Expected an object.");
  return value as Record<string, unknown>;
}

function asFieldProperty(value: unknown, fallbackCode: string) {
  const property = asObject(value);
  return {
    ...property,
    type: String(property.type ?? "SINGLE_LINE_TEXT"),
    code: String(property.code ?? fallbackCode),
    label: String(property.label ?? property.code ?? fallbackCode),
  };
}

function truthy(value: unknown): boolean {
  return value === true || value === "true";
}

function methodNotAllowed(request: MockRequest): MockApiError {
  return new MockApiError("MOCK_METHOD_NOT_ALLOWED", `${request.method} is not supported for ${request.path}.`, 405);
}

function json(response: ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(value));
}
