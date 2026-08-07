import type { AppFixture, KintoneFieldProperty, KintoneRecord, MockFixture } from "./types.js";

interface StoredRecord {
  id: string;
  revision: number;
  record: KintoneRecord;
}

interface StoredApp {
  id: string;
  revision: number;
  fields: Record<string, KintoneFieldProperty>;
  previewFields: Record<string, KintoneFieldProperty>;
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
    this.apps.set(id, {
      id,
      revision: 1,
      fields: structuredClone(fixture.fields ?? {}),
      previewFields: structuredClone(fixture.fields ?? {}),
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
