import type { AppFixture, KintoneFieldProperty, KintoneRecord, KintoneUser, MockFixture } from "./types.js";

interface StoredRecord {
  id: string;
  revision: number;
  record: KintoneRecord;
}

export interface StoredApp {
  id: string;
  code: string;
  name: string;
  description: string;
  spaceId: string | null;
  threadId: string | null;
  createdAt: string;
  creator: KintoneUser;
  modifiedAt: string;
  modifier: KintoneUser;
  revision: number;
  settings: Record<string, unknown>;
  previewSettings: Record<string, unknown>;
  fields: Record<string, KintoneFieldProperty>;
  previewFields: Record<string, KintoneFieldProperty>;
  layout: unknown[];
  previewLayout: unknown[];
  views: Record<string, unknown>;
  previewViews: Record<string, unknown>;
  records: StoredRecord[];
  nextRecordId: number;
}

export interface CursorState {
  app: string;
  fields?: string[];
  records: KintoneRecord[];
  index: number;
  size: number;
}

const DEFAULT_USER = { code: "mock-user", name: "Mock User" };
const DEFAULT_DATE = "1970-01-01T00:00:00.000Z";

export class MockStore {
  readonly apps = new Map<string, StoredApp>();
  readonly cursors = new Map<string, CursorState>();
  #nextCursorId = 1;

  constructor(fixture: MockFixture = {}) {
    for (const app of fixture.apps ?? []) this.defineApp(app);
  }

  defineApp(fixture: AppFixture): void {
    const id = String(fixture.id);
    const records = (fixture.records ?? []).map((record, index) => {
      const explicitId = record.$id?.value;
      const recordId = explicitId == null ? String(index + 1) : String(explicitId);
      const revisionValue = Number(record.$revision?.value ?? 1);
      return {
        id: recordId,
        revision: Number.isFinite(revisionValue) ? revisionValue : 1,
        record: cloneRecord(record),
      };
    });
    const maxId = records.reduce((max, record) => Math.max(max, Number(record.id) || 0), 0);
    const fields = structuredClone(fixture.fields ?? {});
    this.apps.set(id, {
      id,
      code: fixture.code ?? "",
      name: fixture.name ?? `App ${id}`,
      description: fixture.description ?? "",
      spaceId: fixture.spaceId ?? null,
      threadId: fixture.threadId ?? null,
      createdAt: fixture.createdAt ?? DEFAULT_DATE,
      creator: structuredClone(fixture.creator ?? DEFAULT_USER),
      modifiedAt: fixture.modifiedAt ?? DEFAULT_DATE,
      modifier: structuredClone(fixture.modifier ?? fixture.creator ?? DEFAULT_USER),
      revision: 1,
      settings: structuredClone(fixture.settings ?? {}),
      previewSettings: structuredClone(fixture.previewSettings ?? fixture.settings ?? {}),
      fields,
      previewFields: structuredClone(fixture.previewFields ?? fields),
      layout: structuredClone(fixture.layout ?? []),
      previewLayout: structuredClone(fixture.previewLayout ?? fixture.layout ?? []),
      views: structuredClone(fixture.views ?? {}),
      previewViews: structuredClone(fixture.previewViews ?? fixture.views ?? {}),
      records,
      nextRecordId: maxId + 1,
    });
  }

  app(id: unknown): StoredApp {
    const app = this.apps.get(String(id));
    if (!app) throw new MockApiError("GAIA_AP01", `App ${String(id)} was not found.`, 404);
    return app;
  }

  createCursor(state: Omit<CursorState, "index">): string {
    const id = String(this.#nextCursorId++);
    this.cursors.set(id, { ...state, index: 0 });
    return id;
  }
}

export class MockApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

export function appInfo(app: StoredApp) {
  return {
    appId: app.id,
    code: app.code,
    name: app.name,
    description: app.description,
    spaceId: app.spaceId,
    threadId: app.threadId,
    createdAt: app.createdAt,
    creator: structuredClone(app.creator),
    modifiedAt: app.modifiedAt,
    modifier: structuredClone(app.modifier),
  };
}

export function responseRecord(record: StoredRecord): KintoneRecord {
  return {
    ...cloneRecord(record.record),
    $id: { type: "__ID__", value: record.id },
    $revision: { type: "__REVISION__", value: String(record.revision) },
  };
}

export function cloneRecord(record: KintoneRecord): KintoneRecord {
  return structuredClone(record);
}
