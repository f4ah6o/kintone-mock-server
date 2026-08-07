# kintone-mock-server

A lightweight, file-backed mock for the kintone REST API. App metadata, app settings and records are defined in a fixture file; the same state can be read through HTTP or directly from the CLI.

## Supported API

### App / management reads

- `GET /k/v1/app.json`
- `GET /k/v1/apps.json`
- `GET /k/v1/app/settings.json`
- `GET /k/v1/preview/app/settings.json`
- `GET /k/v1/app/form/fields.json`
- `GET /k/v1/preview/app/form/fields.json`
- `GET /k/v1/app/form/layout.json`
- `GET /k/v1/preview/app/form/layout.json`
- `GET /k/v1/app/views.json`
- `GET /k/v1/preview/app/views.json`

### Records

- `GET/POST/PUT /k/v1/record.json`
- `GET/POST/PUT/DELETE /k/v1/records.json`
- `POST/GET/DELETE /k/v1/records/cursor.json`

Preview field mutation APIs are also supported. Wide-course-only APIs are out of scope.

## Fixture

```json
{
  "apps": [
    {
      "id": 1,
      "code": "SALES",
      "name": "Sales",
      "description": "Sales app",
      "creator": { "code": "alice", "name": "Alice" },
      "settings": {
        "name": "Sales",
        "description": "Sales app",
        "icon": { "type": "PRESET", "key": "APP72" }
      },
      "fields": {
        "name": { "type": "SINGLE_LINE_TEXT", "code": "name", "label": "Name" }
      },
      "layout": [
        { "type": "ROW", "fields": [{ "type": "SINGLE_LINE_TEXT", "code": "name" }] }
      ],
      "views": {
        "All": { "type": "LIST", "name": "All", "id": "20", "fields": ["name"], "filterCond": "", "sort": "", "index": "0" }
      },
      "records": [
        { "name": { "type": "SINGLE_LINE_TEXT", "value": "Alice" } }
      ]
    }
  ]
}
```

`previewSettings`, `previewFields`, `previewLayout`, and `previewViews` can override preview state. If omitted, live state is copied into preview state.

## Read-only CLI

No listening socket is required:

```sh
kintone-mock-server app --fixture fixture.json --id 1 --pretty
kintone-mock-server apps --fixture fixture.json --codes SALES
kintone-mock-server settings --fixture fixture.json --app 1 --pretty
kintone-mock-server fields --fixture fixture.json --app 1
kintone-mock-server layout --fixture fixture.json --app 1
kintone-mock-server views --fixture fixture.json --app 1
kintone-mock-server records --fixture fixture.json --app 1 --query 'order by name asc'
kintone-mock-server record --fixture fixture.json --app 1 --id 1
```

For another supported GET endpoint:

```sh
kintone-mock-server get --fixture fixture.json --path /k/v1/app/settings.json --params '{"app":1}'
```

The CLI commands above are read-only. `serve` retains the HTTP mock server for environments where a local listener is available.

## Server

```sh
kintone-mock-server serve --fixture fixture.json --port 3000
```

Guest-space paths are normalized to the same handlers.

## Development

```sh
pnpm lint
pnpm format:check
pnpm test
pnpm check
```

Formatting and linting use Oxfmt and Oxlint.
