import test from "node:test";
import assert from "node:assert/strict";
import { evaluate, ENDPOINT } from "../src/openrouter.mjs";
import { createRun, buildRequest } from "../src/simulator.mjs";
test("direct POST forwards only model, state and questions", async () => {
  const request = buildRequest(createRun(), "typesafe/jev-1.13");
  let sent;
  const result = await evaluate(request, {
    apiKey: "test-secret",
    fetchImpl: async (url, options) => {
      sent = { url, options };
      return new Response(
        JSON.stringify({
          answers: { action: { choice: "move_Square", confidence: 0.9 } },
          usage: { cost: 0.01 },
        }),
        { status: 200 },
      );
    },
  });
  assert.equal(sent.url, ENDPOINT);
  assert.equal(sent.options.method, "POST");
  assert.equal(sent.options.headers.Authorization, "Bearer test-secret");
  assert.deepEqual(Object.keys(JSON.parse(sent.options.body)).sort(), [
    "model",
    "questions",
    "state",
  ]);
  assert.equal(result.answers.action.choice, "move_Square");
  assert.ok(!sent.options.body.includes("test-secret"));
  assert.equal(sent.options.redirect, "error");
});
test("HTTP errors never expose provider bodies or credentials", async () => {
  const fetchImpl = async () =>
    new Response("test-secret private provider text", { status: 401 });
  await assert.rejects(
    () =>
      evaluate(buildRequest(createRun()), { apiKey: "test-secret", fetchImpl }),
    (e) =>
      e.status === 401 &&
      !e.message.includes("test-secret") &&
      !e.message.includes("private"),
  );
});
test("missing key does not make a network call", async () => {
  let calls = 0;
  await assert.rejects(
    () =>
      evaluate(
        {},
        {
          apiKey: "",
          fetchImpl: async () => {
            calls++;
          },
        },
      ),
    (e) => e.code === "missing_api_key",
  );
  assert.equal(calls, 0);
});
test("timeouts are not retried", async () => {
  let calls = 0;
  await assert.rejects(
    () =>
      evaluate(
        {},
        {
          apiKey: "test-secret",
          fetchImpl: async () => {
            calls++;
            throw new DOMException("test-secret", "TimeoutError");
          },
        },
      ),
    (e) => e.code === "timeout" && !e.message.includes("test-secret"),
  );
  assert.equal(calls, 1);
});
