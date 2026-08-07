import type { KintoneRecord } from "./types.js";

export interface QueryResultOptions {
  limit?: number;
  offset?: number;
}

export function applyQuery(records: KintoneRecord[], query = ""): KintoneRecord[] {
  let result = [...records];
  const order = parseOrder(query);
  if (order) {
    result.sort((a, b) => compare(fieldValue(a, order.field), fieldValue(b, order.field)) * order.direction);
  }
  const { limit, offset } = parseWindow(query);
  return result.slice(offset, offset + limit);
}

export function parseWindow(query: string): Required<QueryResultOptions> {
  const limit = Number(query.match(/\blimit\s+(\d+)/i)?.[1] ?? 500);
  const offset = Number(query.match(/\boffset\s+(\d+)/i)?.[1] ?? 0);
  return { limit: Math.min(Math.max(limit, 0), 500), offset: Math.max(offset, 0) };
}

function parseOrder(query: string): { field: string; direction: 1 | -1 } | undefined {
  const match = query.match(/\border\s+by\s+([\w$]+)(?:\s+(asc|desc))?/i);
  if (!match?.[1]) return undefined;
  return { field: match[1], direction: match[2]?.toLowerCase() === "desc" ? -1 : 1 };
}

function fieldValue(record: KintoneRecord, field: string): unknown {
  return record[field]?.value;
}

function compare(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b));
}
