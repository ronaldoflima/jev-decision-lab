import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRun, applyDecision } from "../src/simulator.mjs";
const data = JSON.parse(
  await readFile(
    new URL("../data/recorded-experiments.json", import.meta.url),
    "utf8",
  ),
);
for (const [mode, episode] of [
  ["none", data],
  ["single", data.undo_run],
  ["multi", data.multi_undo_run],
]) {
  test("historical " + mode + " trace obeys the public simulator", () => {
    let run = createRun(mode);
    for (const turn of episode.history) {
      run = applyDecision(run, turn.choice);
      assert.equal(run.state.position, data.names[turn.after.at]);
      assert.equal(run.state.time_minutes, turn.after.time);
      assert.equal(run.state.battery, turn.after.battery);
      assert.deepEqual(
        run.state.delivered,
        turn.after.delivered.map((n) => data.names[n]),
      );
    }
  });
}
