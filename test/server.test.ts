import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createKintoneMockServer, type KintoneMockServer } from "../src/index.js";

let mock: KintoneMockServer;

before(async () => {
  mock = await createKintoneMockServer({
    apps: [
      {
        id: 1,
        fields: {
          name: { type: "SINGLE_LINE_TEXT", code: "name", label: "Name" },
        },
        records: [
          { name: { type: "SINGLE_LINE_TEXT", value: "beta" } },
          { name: { type: "SINGLE_LINE_TEXT", value: "alpha" } },
        ],
      },
    ],
  });
});

after(async () => {
  await mock.close();
});

test("record CRUD uses kintone-compatible paths", async () => {
  const created = await api("POST", "/k/v1/record.json", {
    app: 1,
    record: { name: { value: "gamma" } },
  });
  assert.deepEqual(created, { id: "3", revision: "1" });

  const fetched = await api("GET", "/k/v1/record.json?app=1&id=3");
  assert.equal(fetched.record.name.value, "gamma");
  assert.equal(fetched.record.$id.value, "3");

  const updated = await api("PUT", "/k/v1/record.json", {
    app: 1,
    id: 3,
    revision: 1,
    record: { name: { value: "delta" } },
  });
  assert.deepEqual(updated, { revision: "2" });
});

test("records supports order, limit, fields and totalCount", async () => {
  const result = await api("GET", "/k/v1/records.json?app=1&query=order%20by%20name%20asc%20limit%202&fields[0]=name&totalCount=true");
  assert.equal(result.totalCount, "3");
  assert.deepEqual(result.records.map((record: any) => record.name.value), ["alpha", "beta"]);
  assert.deepEqual(Object.keys(result.records[0]), ["name"]);
});

test("cursor chunks records", async () => {
  const created = await api("POST", "/k/v1/records/cursor.json", { app: 1, size: 2 });
  const first = await api("GET", `/k/v1/records/cursor.json?id=${created.id}`);
  const second = await api("GET", `/k/v1/records/cursor.json?id=${created.id}`);
  assert.equal(first.records.length, 2);
  assert.equal(first.next, true);
  assert.equal(second.records.length, 1);
  assert.equal(second.next, false);
});

test("form fields can be read and changed in preview", async () => {
  const initial = await api("GET", "/k/v1/app/form/fields.json?app=1");
  assert.equal(initial.properties.name.label, "Name");

  const changed = await api("POST", "/k/v1/preview/app/form/fields.json", {
    app: 1,
    properties: { amount: { type: "NUMBER", code: "amount", label: "Amount" } },
  });
  assert.equal(changed.revision, "2");

  const preview = await api("GET", "/k/v1/preview/app/form/fields.json?app=1");
  assert.equal(preview.properties.amount.type, "NUMBER");
});

async function api(method: string, path: string, body?: unknown): Promise<any> {
  const response = await fetch(`${mock.url}${path}`, {
    method,
    ...(body
      ? { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }
      : {}),
  });
  const json = await response.json();
  assert.equal(response.ok, true, JSON.stringify(json));
  return json;
}
