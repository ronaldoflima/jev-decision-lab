import test from "node:test";
import assert from "node:assert/strict";
import {
  createRun,
  applyDecision,
  legalActions,
  buildRequest,
  endReason,
  unwrapResponse,
} from "../src/simulator.mjs";
const act = (r, ids) => ids.reduce((s, id) => applyDecision(s, id), r);
test("restore three actions atomically and complete route", () => {
  let r = act(createRun(), ["move_Square", "move_Hospital", "deliver"]);
  const saved = structuredClone(r.state);
  r = act(r, ["move_Shop", "deliver", "move_Hospital"]);
  assert.equal(r.state.battery, 0);
  assert.deepEqual(
    legalActions(r).map((a) => a.id),
    ["undo_1", "undo_2", "undo_3"],
  );
  r = applyDecision(r, "undo_3");
  assert.deepEqual(r.state, saved);
  assert.equal(r.rollback_credits_used, 3);
  assert.ok(!legalActions(r).some((a) => a.type === "undo"));
  r = act(r, [
    "move_Charging_station",
    "recharge",
    "move_Shop",
    "deliver",
    "move_Charging_station",
    "recharge",
    "move_Museum",
    "deliver",
  ]);
  assert.equal(endReason(r), "all_delivered");
  assert.equal(r.state.time_minutes, 28);
});
test("undo two removes parcel delivery and preserves earlier delivery", () => {
  let r = act(createRun(), ["move_Square", "move_Hospital", "deliver"]);
  const before = structuredClone(r.state);
  r = act(r, ["move_Shop", "deliver", "undo_2"]);
  assert.deepEqual(r.state, before);
  assert.equal(r.rollback_credits_used, 2);
  assert.throws(() => applyDecision(r, "undo_2"));
});
test("observed closure survives time rollback", () => {
  let r = act(createRun(), [
    "move_Square",
    "move_Hospital",
    "deliver",
    "move_Charging_station",
    "recharge",
  ]);
  r = applyDecision(r, "move_Shop");
  assert.equal(r.known_blockage, true);
  r = applyDecision(r, "undo_1");
  assert.equal(r.state.time_minutes, 11);
  assert.equal(r.known_blockage, true);
  assert.equal(buildRequest(r).state.known_events.length, 1);
});
test("no future closure leaks and all labels sent to Jev are English", () => {
  const request = buildRequest(createRun());
  assert.deepEqual(request.state.known_events, []);
  assert.ok(!/"(?:Praça|Posto|Loja|Museu)"/.test(JSON.stringify(request)));
});
test("invalid decisions cannot modify the state", () => {
  const run = createRun();
  assert.throws(() => applyDecision(run, "deliver"));
  assert.equal(run.state.time_minutes, 0);
  assert.throws(() =>
    unwrapResponse({
      answers: { action: { choice: "move_Square", confidence: 2 } },
    }),
  );
  assert.equal(
    unwrapResponse({
      answers: { action: { choice: "move_Square", confidence: 0.9 } },
    }).answers.action.choice,
    "move_Square",
  );
});
