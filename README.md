# Jev Decision Lab

An exploratory experiment in sequential decision-making with **Jev (TypeSafe)** through the **OpenRouter Decisions API**.

[Português](README.pt-BR.md) · [Interactive presentation](docs/index.html) · [Methodology](docs/methodology.md) · [Recorded results](data/recorded-experiments.json)

A delivery agent must meet three deadlines while managing a limited battery and a road closure. Jev chooses one legal action per request; deterministic code applies the action and sends the next state. Optional rollback actions restore one, two or three previous actions.

## Quick start

Requires Node.js 20 or newer. No external packages are required.

```sh
git clone https://github.com/ronaldoflima/jev-decision-lab.git
cd jev-decision-lab
npm test
npm run dry-run
```

The dry run follows a deterministic reference route. It never calls OpenRouter and needs no API key. It completes three deliveries at virtual minute 28 in eleven actions.

For a live experiment, provide your own OpenRouter API key:

```sh
export OPENROUTER_API_KEY='your-key'
npm start -- --mode multi
```

Keep the key outside source files. Node.js does not automatically load .env files: either export the variable or use a supported Node version with `node --env-file=.env src/run.mjs`. Live calls may incur API charges.

## What happens on each turn

1. The simulator computes the legal actions and the known state.
2. The HTTP client sends **only** `model`, `state` and `questions` to `https://openrouter.ai/api/alpha/decisions`.
3. Jev returns a choice, probabilities and confidence.
4. The simulator validates the choice against the current legal set.
5. The runner records the request, response, cost and new state, then repeats.

The public runner uses Node's native `fetch` directly. It requires no personal infrastructure, intermediary server or third-party SDK.

Local metadata such as tags and a confidence threshold are not forwarded to the model. Low confidence is recorded without blocking execution. Requests are not automatically retried: a timeout can leave billing uncertain.

## Modes and options

| Option                         | Meaning                               |
| ------------------------------ | ------------------------------------- |
| `--mode none`                  | No rollback                           |
| `--mode single`                | Undo the last action                  |
| `--mode multi`                 | Choose undo 1, 2 or 3 actions         |
| `--model typesafe/jev-1.13`    | Requested model; default shown        |
| `--max-decisions 30`           | Episode decision limit                |
| `--timeout 30000`              | HTTP timeout in milliseconds          |
| `--output results/my-run.json` | Destination for the execution record  |
| `--dry-run`                    | Local reference route; no model calls |

`JEV_MODEL` sets the default model. The resolved version is recorded in live results.

There are three rollback credits per episode. Undoing N actions consumes N credits. Position, time, battery, delivered parcels and virtual energy are restored. Observed events, API costs and decision count are preserved.

## Presentation

Open `docs/index.html` in a browser. The simulator, article and API explanation work offline, without calling the model. The manual mode lets you test your own route.

New CLI runs are saved under `results/`, which Git ignores. They do not automatically replace the recorded HTML presentation. Requests and states are persisted in local results; only use data you intend to send to OpenRouter.

## Recorded findings

| Configuration                   | On-time deliveries | Outcome                                           |
| ------------------------------- | ------------------ | ------------------------------------------------- |
| No rollback                     | 2 / 3              | Battery exhausted at the hospital                 |
| Undo one action                 | 2 / 3              | Repeated decisions and exhausted rollback credits |
| Explicit undo 1 / 2 / 3 options | 3 / 3              | Completed at virtual minute 28                    |

The successful episode chose undo 1 three times; it did **not** choose undo 2 or undo 3. It used seventeen decisions versus eleven reference actions. Rolling back the clock makes virtual finishing time different from execution efficiency.

There was one recorded episode per configuration, with multiple instruction and interface changes. The reference knows the future closure. These results are exploratory, not a benchmark or proof of reliable planning.

Across all recorded generation and planning trials, the selected experiment tags contain **229 successful calls** and **US$ 0.020591004** of reported API cost. This is a log-derived sum, not an invoice reconciliation; voice, authoring and infrastructure costs are excluded.

Historical calls used a thin HTTP adapter forwarding the same API contract. The standalone runner was built afterwards. Transport changes, model updates and probabilistic behavior can change new results.

## Project layout

- `src/simulator.mjs`: scenario, legal actions, rollback and prompt construction.
- `src/openrouter.mjs`: direct HTTP client with redacted errors.
- `src/run.mjs`: CLI, execution records and cost accounting.
- `test/`: deterministic simulator and mocked HTTP tests.
- `docs/`: standalone presentation, article and methodology.
- `data/`: sanitized historical records and cost summary.

## Sources and license

The scenario was developed for this experiment with assistance from Codex; it was not adapted from a specific published benchmark.

- [OpenRouter: Jev and the Decisions API](https://openrouter.ai/blog/insights/what-is-jev/)
- [TypeSafe model documentation](https://docs.typesafe.ai/models)
- [FrequencyWords](https://github.com/hermitdave/FrequencyWords), used as a vocabulary source in the earlier word-generation experiment; its corpus is not bundled here.

Code and original documentation: [MIT](LICENSE). Jev is a third-party model with its own provider terms. This is an independent project by Ronaldo Lima.
