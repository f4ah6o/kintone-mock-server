import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

const cli = fileURLToPath(new URL("../src/cli.js", import.meta.url));

test("read-only CLI returns records without starting a server", async () => {
  const directory = await mkdtemp(join(tmpdir(), "kintone-mock-cli-"));
  const fixture = join(directory, "fixture.json");
  await writeFile(
    fixture,
    JSON.stringify({
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
    }),
  );

  try {
    const result = spawnSync(
      process.execPath,
      [cli, "records", "--fixture", fixture, "--app", "1", "--query", "order by name asc limit 1", "--fields", "name", "--total-count"],
      { encoding: "utf8" },
    );

    assert.equal(result.status, 0, result.stderr);
    const output = JSON.parse(result.stdout) as {
      records: Array<{ name: { value: string } }>;
      totalCount: string;
    };
    assert.equal(output.totalCount, "2");
    assert.deepEqual(output.records.map((record) => record.name.value), ["alpha"]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
