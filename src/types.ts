export interface KintoneFieldValue {
  type?: string;
  value: unknown;
}

export type KintoneRecord = Record<string, KintoneFieldValue>;

export interface KintoneFieldProperty {
  type: string;
  code: string;
  label: string;
  [key: string]: unknown;
}

export interface KintoneUser {
  code: string;
  name: string;
}

export interface AppFixture {
  id: string | number;
  code?: string;
  name?: string;
  description?: string;
  spaceId?: string | null;
  threadId?: string | null;
  createdAt?: string;
  creator?: KintoneUser;
  modifiedAt?: string;
  modifier?: KintoneUser;
  settings?: Record<string, unknown>;
  previewSettings?: Record<string, unknown>;
  fields?: Record<string, KintoneFieldProperty>;
  previewFields?: Record<string, KintoneFieldProperty>;
  layout?: unknown[];
  previewLayout?: unknown[];
  views?: Record<string, unknown>;
  previewViews?: Record<string, unknown>;
  records?: KintoneRecord[];
}

export interface MockFixture {
  apps?: AppFixture[];
}

export interface MockServerOptions extends MockFixture {
  hostname?: string;
  port?: number;
}
