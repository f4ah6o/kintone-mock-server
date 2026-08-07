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

export interface AppFixture {
  id: string | number;
  fields?: Record<string, KintoneFieldProperty>;
  records?: KintoneRecord[];
}

export interface MockFixture {
  apps?: AppFixture[];
}

export interface MockServerOptions extends MockFixture {
  hostname?: string;
  port?: number;
}
