# Methodology

## Scenario

Start at Base, virtual minute 0, battery 9. Each undirected road costs its weight in minutes and battery. Delivery costs one minute, no battery. Recharging at Base or Charging station takes three minutes and restores battery to 9.

Hospital delivery must finish by minute 7, Shop by 16 and Museum by 28. Shop–Museum closes at minute 12. Traversals started before closure may finish. The agent learns this event when its clock reaches or crosses minute 12.

The objective is to maximize on-time deliveries, then minimize finishing time and energy. Episodes stop when all parcels are delivered, no legal action remains or the decision limit is reached. Travel cannot pass minute 30; rollback can still be legal when movement is impossible.

## Recovery

Rollback restores the complete world snapshot before one, two or three executed actions. Only undoable actions in the current stack count; prior rollback decisions are not themselves undoable. Three credits bound the number of restored actions. Knowledge already observed is retained even when the world clock rewinds.

This is a counterfactual simulator. Virtual finishing time and energy can be refunded; HTTP calls, elapsed wall time and decision count cannot.

## Evaluation boundaries

The reference route was obtained by searching states containing location, time, battery and delivered parcels, keeping the least energy for otherwise identical states. It completes all parcels in eleven actions at minute 28. It has prior knowledge of closure, so it is a full-information reference rather than a perfectly matched online baseline.

Recorded episodes used the same map with different prompts and action sets. One episode per configuration is too small to estimate reliability or isolate a causal improvement. The successful episode used only one-action rollback, despite having deeper options.

## Reproduction

The public CLI sends the same model/state/questions contract directly to OpenRouter. Historical records were collected earlier using a thin HTTP adapter. No intermediary rewrote the supplied state or model choice.

Default requested model: typesafe/jev-1.13. Historical resolved model: typesafe/jev-1.13-20260917. Record the resolved model when repeating trials; aliases and service implementations may evolve. Keep option order, prompts, seeds and information availability controlled when comparing runs.

All planning requests use English. The earlier generation trials also varied vocabulary, examples, confidence handling, language and sampling. They did not produce consistent conversation in the recorded executions.

## Next evaluation

Run repeated episodes per configuration, hold instructions constant, permute option order, vary maps and deadlines, and compare against a deterministic policy with the same observed information. Report deliveries, invalid outputs, rollback depth, decision count, wall time and reported API cost.

## Data

recorded-experiments.json preserves anonymous synthetic-world traces and examples. recorded-costs.json aggregates selected experiment tags. No API keys or private configuration are included. These files are historical fixtures; the CLI writes fresh records to results/.
