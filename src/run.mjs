#!/usr/bin/env node
import { mkdir, writeFile, rename } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import {
  createRun,
  legalActions,
  applyDecision,
  buildRequest,
  unwrapResponse,
  endReason,
} from "./simulator.mjs";
import { evaluate, DEFAULT_MODEL, DecisionApiError } from "./openrouter.mjs";

export function parseArgs(values) {
  const options = {
    mode: "multi",
    maxDecisions: 30,
    timeout: 30000,
    dryRun: false,
    output: "results/run-" + Date.now() + ".json",
    model: process.env.JEV_MODEL || DEFAULT_MODEL,
  };
  for (let i = 0; i < values.length; i++) {
    const arg = values[i];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }
    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    const keys = {
      "--mode": "mode",
      "--max-decisions": "maxDecisions",
      "--timeout": "timeout",
      "--output": "output",
      "--model": "model",
    };
    if (!keys[arg]) throw Error("Unknown argument: " + arg);
    const value = values[++i];
    if (!value || value.startsWith("--"))
      throw Error("Missing value for " + arg);
    options[keys[arg]] = ["maxDecisions", "timeout"].includes(keys[arg])
      ? Number(value)
      : value;
  }
  if (!Number.isInteger(options.timeout) || options.timeout < 1)
    throw Error("Timeout must be positive.");
  return options;
}
async function save(path, run) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = path + "." + process.pid + ".tmp";
  await writeFile(temporary, JSON.stringify(run, null, 2) + "\n", {
    mode: 0o600,
  });
  await rename(temporary, path);
}
export async function main(args = process.argv.slice(2)) {
  let options, run, output;
  try {
    options = parseArgs(args);
    if (options.help) {
      console.log(
        "Usage: node src/run.mjs [--dry-run] [--mode none|single|multi] [--model typesafe/jev-1.13] [--max-decisions 30] [--timeout 30000] [--output results/run.json]\nLive runs require OPENROUTER_API_KEY. --dry-run never calls the API.",
      );
      return;
    }
    run = createRun(options.mode, options.maxDecisions);
    run.started_at = new Date().toISOString();
    run.transport = "direct_openrouter_http";
    run.requested_model = options.model;
    run.attempts = [];
    output = resolve(options.output);
    if (!options.dryRun && !process.env.OPENROUTER_API_KEY?.trim())
      throw new DecisionApiError("Set OPENROUTER_API_KEY, or use --dry-run.", {
        code: "missing_api_key",
      });
    await save(output, run);
    if (options.dryRun) {
      const path = [
        "move_Square",
        "move_Hospital",
        "deliver",
        "move_Charging_station",
        "recharge",
        "move_Shop",
        "deliver",
        "move_Charging_station",
        "recharge",
        "move_Museum",
        "deliver",
      ];
      if (options.maxDecisions < path.length)
        throw Error("The reference path requires at least 11 decisions.");
      for (const choice of path) run = applyDecision(run, choice);
      run.source = "deterministic_reference";
      run.transport = "local_only";
    } else {
      run.source = "openrouter_decisions_api";
      while (!endReason(run)) {
        const request = buildRequest(run, options.model);
        const attempt = {
          number: run.attempts.length + 1,
          request,
          started_at: new Date().toISOString(),
          status: "pending",
        };
        run.attempts.push(attempt);
        await save(output, run);
        const started = Date.now();
        const raw = await evaluate(request, {
          model: options.model,
          timeout: options.timeout,
        });
        attempt.elapsed_ms = Date.now() - started;
        attempt.status = "response_received";
        attempt.response = raw;
        const cost = raw.usage?.cost;
        if (Number.isFinite(cost) && cost >= 0) run.reported_cost_total += cost;
        else run.calls_without_reported_cost++;
        await save(output, run);
        const response = unwrapResponse(raw),
          answer = response.answers.action;
        // Validate against the legal set even though choice outputs are structured.
        if (!legalActions(run).some((action) => action.id === answer.choice))
          throw Error("The returned choice is not legal in the current state.");
        run = applyDecision(run, answer.choice);
        Object.assign(run.history.at(-1), {
          confidence: answer.confidence,
          probabilities: answer.probabilities || {},
          low_confidence: answer.confidence < request.min_confidence,
          usage: raw.usage || null,
          model: raw.model || null,
          elapsed_ms: Date.now() - started,
        });
        if (raw.model && !run.models.includes(raw.model))
          run.models.push(raw.model);
        run.attempts.at(-1).status = "applied";
        await save(output, run);
        console.log(
          run.history.length +
            ". " +
            answer.choice +
            " | minute " +
            run.state.time_minutes +
            " | battery " +
            run.state.battery +
            " | deliveries " +
            run.state.delivered.length +
            "/3 | confidence " +
            Math.round(answer.confidence * 100) +
            "%",
        );
      }
    }
    run.status = endReason(run);
    run.finished_at = new Date().toISOString();
    await save(output, run);
    console.log(
      "Finished: " +
        run.status +
        " | " +
        run.state.delivered.length +
        "/3 deliveries | minute " +
        run.state.time_minutes +
        " | " +
        run.history.length +
        " decisions",
    );
    console.log(
      "Reported API cost: " +
        run.reported_cost_total +
        (run.calls_without_reported_cost
          ? " (partial; some calls omitted cost)"
          : "") +
        " | " +
        output,
    );
  } catch (error) {
    const safe =
      error instanceof DecisionApiError
        ? { code: error.code, status: error.status, message: error.message }
        : {
            code: "execution_error",
            message:
              "Execution failed: check CLI arguments, output path and decision response.",
          };
    if (run && output) {
      run.status = "error";
      run.error = safe;
      run.finished_at = new Date().toISOString();
      if (run.attempts?.at(-1)?.status === "pending")
        run.attempts.at(-1).status = "failed_or_unknown";
      await save(output, run).catch(() => {});
    }
    console.error(safe.message);
    if (output) console.error("Partial record: " + output);
    process.exitCode = 1;
  }
}
if (
  process.argv[1] &&
  import.meta.url === new URL("file://" + resolve(process.argv[1])).href
)
  await main();
