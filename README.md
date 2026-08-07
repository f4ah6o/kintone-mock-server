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

### Read-only mode

Read-only commands do not listen on a port. They load the fixture, execute the equivalent kintone GET API in-process, print JSON to stdout, and exit.

```sh
# GET /k/v1/record.json?app=1&id=1
node dist/src/cli.js record --fixture ./fixture.json --app 1 --id 1

# GET /k/v1/records.json
node dist/src/cli.js records \
  --fixture ./fixture.json \
  --app 1 \
  --query 'order by name asc limit 20' \
  --fields name \
  --total-count

# GET /k/v1/app/form/fields.json?app=1
node dist/src/cli.js fields --fixture ./fixture.json --app 1

# Preview fields
node dist/src/cli.js fields --fixture ./fixture.json --app 1 --preview

# Raw GET for supported endpoints
node dist/src/cli.js get \
  --fixture ./fixture.json \
  --path /k/v1/records.json \
  --params '{"app":1,"query":"limit 10"}'
```

Add `--pretty` to pretty-print JSON. The CLI read mode is intentionally GET-only; record and field mutations remain available only through the mock server/programmatic API.

### HTTP server mode

The existing server mode remains available when a development environment can open a local port:

```sh
node dist/src/cli.js serve --fixture ./fixture.json --port 3000
```

For compatibility, omitting `serve` also starts the server:

```sh
node dist/src/cli.js --fixture ./fixture.json --port 3000
```

The base URL is `http://127.0.0.1:3000` by default.

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
