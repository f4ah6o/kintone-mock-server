import assert from "node:assert/strict";
import { test } from "node:test";
import { invokeKintoneMockRequest, MockStore } from "../src/index.js";

const store = new MockStore({
  apps: [
    {
      id: 10,
      code: "SALES",
      name: "Sales",
      description: "Sales app",
      spaceId: "2",
      threadId: "3",
      creator: { code: "alice", name: "Alice" },
      settings: { name: "Sales", description: "Sales app", icon: { type: "PRESET", key: "APP72" } },
      fields: { title: { type: "SINGLE_LINE_TEXT", code: "title", label: "Title" } },
      layout: [{ type: "ROW", fields: [{ type: "SINGLE_LINE_TEXT", code: "title", size: { width: "200" } }] }],
      views: { All: { type: "LIST", name: "All", id: "20", fields: ["title"], filterCond: "", sort: "", index: "0" } },
      records: [{ title: { value: "A" } }],
    },
    { id: 11, code: "OTHER", name: "Other" },
  ],
});

function get(path: string, params: Record<string, unknown>) {
  return invokeKintoneMockRequest(store, { method: "GET", path, params }) as any;
}

test("app metadata comes from fixture", () => {
  const app = get("/k/v1/app.json", { id: 10 });
  assert.equal(app.appId, "10");
  assert.equal(app.code, "SALES");
  assert.equal(app.name, "Sales");
  assert.equal(app.creator.code, "alice");
});

test("apps can be filtered", () => {
  const response = get("/k/v1/apps.json", { codes: ["OTHER"] });
  assert.deepEqual(response.apps.map((app: any) => app.appId), ["11"]);
});

test("management reads return fixture settings", () => {
  assert.equal(get("/k/v1/app/settings.json", { app: 10 }).name, "Sales");
  assert.equal(get("/k/v1/app/form/layout.json", { app: 10 }).layout[0].type, "ROW");
  assert.equal(get("/k/v1/app/views.json", { app: 10 }).views.All.id, "20");
  assert.equal(get("/k/v1/app/form/fields.json", { app: 10 }).properties.title.code, "title");
});
