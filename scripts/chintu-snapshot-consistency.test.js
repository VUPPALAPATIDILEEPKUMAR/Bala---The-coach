const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const appSource = fs.readFileSync("app.js", "utf8");
const helperMatch = appSource.match(/\/\/ SNAPSHOT_SYNC_START([\s\S]*?)\/\/ SNAPSHOT_SYNC_END/);
assert.ok(helperMatch, "app.js must define the snapshot synchronization helper");

const context = { result: null };
vm.runInNewContext(`${helperMatch[1]}; result = alignLatestSnapshot;`, context);
const alignLatestSnapshot = context.result;

const existing = {
  source: "Local check-in",
  sleep: 7.5,
  rhr: 62,
  hrv: 44,
  steps: 7000,
  exercise: 25,
  note: "old note",
  history: [],
};

const replacedNewest = alignLatestSnapshot({
  ...existing,
  history: [
    { date: "2026-06-16", source: "Local check-in", sleep: 7, rhr: 64 },
    { date: "2026-06-17", source: "Local check-in", sleep: 8 },
  ],
});
assert.equal(replacedNewest.sleep, 8);
assert.equal("rhr" in replacedNewest, false);
assert.equal("note" in replacedNewest, false);
assert.equal("exercise" in replacedNewest, false);

const olderBackfill = alignLatestSnapshot({
  ...replacedNewest,
  history: [
    { date: "2026-06-15", source: "Local check-in", hrv: 50 },
    ...replacedNewest.history,
  ],
});
assert.equal(olderBackfill.sleep, 8);
assert.equal("hrv" in olderBackfill, false);

const afterNewestDelete = alignLatestSnapshot({
  ...replacedNewest,
  history: [{ date: "2026-06-16", source: "Local check-in", sleep: 7, rhr: 64 }],
});
assert.equal(afterNewestDelete.sleep, 7);
assert.equal(afterNewestDelete.rhr, 64);

const empty = alignLatestSnapshot({ ...existing, history: [] });
for (const field of ["source", "sleep", "rhr", "hrv", "steps", "exercise", "note"]) {
  assert.equal(field in empty, false, `empty history must clear ${field}`);
}

console.log("Snapshot consistency tests: PASS");
