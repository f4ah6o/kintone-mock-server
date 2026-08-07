# kintone-mock-server

A lightweight, in-memory mock server for the kintone REST API. It is intentionally small: start with record APIs and form-field APIs, then add endpoints only when a real test needs them.

## Supported API

### Records

- `GET /k/v1/record.json`
- `POST /k/v1/record.json`
- `PUT /k/v1/record.json`
- `GET /k/v1/records.json`
- `POST /k/v1/records.json`
- `PUT /k/v1/records.json`
- `DELETE /k/v1/records.json`
- `POST /k/v1/records/cursor.json`
- `GET /k/v1/records/cursor.json`
- `DELETE /k/v1/records/cursor.json`

Guest-space paths are normalized to the same handlers.

`GET /records.json` currently implements `order by`, `limit`, and `offset`. Other kintone query operators are intentionally not emulated yet.

### Form fields

- `GET /k/v1/app/form/fields.json`
- `GET /k/v1/preview/app/form/fields.json`
- `POST /k/v1/preview/app/form/fields.json`
- `PUT /k/v1/preview/app/form/fields.json`
- `DELETE /k/v1/preview/app/form/fields.json`

The preview mutation endpoints increment the app settings revision. Deploy App Settings is not modeled yet, so preview changes remain separate from the live field definitions.

Wide-course-only APIs are out of scope.

## Install

```sh
pnpm install
pnpm build
```

## CLI

Create a fixture:

```json
{
  "apps": [
    {
      "id": 1,
      "fields": {
        "name": { "type": "SINGLE_LINE_TEXT", "code": "name", "label": "Name" }
      },
      "records": [
        { "name": { "type": "SINGLE_LINE_TEXT", "value": "Alice" } }
      ]
    }
  ]
}
```

Then start the server:

```sh
pnpm build
node dist/src/cli.js --fixture ./fixture.json --port 3000
```

The base URL is `http://127.0.0.1:3000` by default, so an HTTP client can call the normal kintone paths below that base URL.

## Programmatic use

```ts
import { createKintoneMockServer } from "kintone-mock-server";

const mock = await createKintoneMockServer({
  apps: [
    {
      id: 1,
      records: [{ title: { value: "hello" } }],
    },
  ],
});

console.log(mock.url);
await mock.close();
```

## Development

```sh
pnpm lint
pnpm format:check
pnpm test
pnpm check
```

Formatting and linting use Oxfmt and Oxlint.

## Scope

This project is not intended to reproduce every validation rule, permission check, or kintone service behavior. The goal is HTTP-level compatibility for application tests with deterministic, inspectable in-memory state. Add missing behavior when a concrete test requires it.
