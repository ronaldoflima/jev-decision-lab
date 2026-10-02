export const SCENARIO = {
  nodes: ["Base", "Square", "Charging station", "Hospital", "Shop", "Museum"],
  edges: [
    ["Base", "Square", 2],
    ["Base", "Charging station", 3],
    ["Square", "Charging station", 2],
    ["Square", "Hospital", 3],
    ["Hospital", "Charging station", 2],
    ["Charging station", "Shop", 4],
    ["Hospital", "Shop", 2],
    ["Shop", "Museum", 3],
    ["Square", "Museum", 5],
    ["Charging station", "Museum", 4],
  ],
  parcels: [
    { destination: "Hospital", deadline: 7 },
    { destination: "Shop", deadline: 16 },
    { destination: "Museum", deadline: 28 },
  ],
  battery_capacity: 9,
  time_limit: 30,
  closure_time: 12,
};
const copy = (value) => JSON.parse(JSON.stringify(value));
export function createRun(mode = "multi", maxDecisions = 30) {
  if (!["none", "single", "multi"].includes(mode))
    throw new Error("Invalid mode");
  if (
    !Number.isInteger(maxDecisions) ||
    maxDecisions < 1 ||
    maxDecisions > 1000
  )
    throw new Error("Invalid decision limit");
  return {
    schema_version: 1,
    mode,
    scenario: copy(SCENARIO),
    state: {
      position: "Base",
      time_minutes: 0,
      battery: 9,
      delivered: [],
      energy_used: 0,
    },
    stack: [],
    history: [],
    rollback_credits_used: 0,
    rollback_credit_limit: mode === "none" ? 0 : 3,
    max_undo_depth: mode === "multi" ? 3 : 1,
    max_decisions: maxDecisions,
    known_blockage: false,
    reported_cost_total: 0,
    calls_without_reported_cost: 0,
    models: [],
    status: "running",
  };
}
export function closed(from, to, time) {
  return (
    time >= 12 && [from, to].includes("Shop") && [from, to].includes("Museum")
  );
}
export function legalActions(run) {
  const s = run.state,
    actions = [];
  if (s.delivered.length === 3 || run.history.length >= run.max_decisions)
    return actions;
  for (const [from, to, minutes] of SCENARIO.edges) {
    const destination =
      s.position === from ? to : s.position === to ? from : null;
    if (
      destination &&
      s.battery >= minutes &&
      s.time_minutes + minutes <= 30 &&
      !closed(from, to, s.time_minutes)
    )
      actions.push({
        id: "move_" + destination.replaceAll(" ", "_"),
        type: "travel",
        destination,
        duration_minutes: minutes,
        battery_cost: minutes,
      });
  }
  if (
    ["Base", "Charging station"].includes(s.position) &&
    s.battery < 9 &&
    s.time_minutes + 3 <= 30
  )
    actions.push({ id: "recharge", type: "recharge", duration_minutes: 3 });
  const parcel = SCENARIO.parcels.find((p) => p.destination === s.position);
  if (
    parcel &&
    !s.delivered.includes(s.position) &&
    s.time_minutes + 1 <= parcel.deadline
  )
    actions.push({ id: "deliver", type: "deliver", duration_minutes: 1 });
  const max = Math.min(
    run.max_undo_depth,
    run.stack.length,
    run.rollback_credit_limit - run.rollback_credits_used,
  );
  for (let depth = 1; depth <= max; depth++)
    actions.push({
      id: run.mode === "single" ? "undo" : "undo_" + depth,
      type: "undo",
      depth,
    });
  return actions;
}
export function applyDecision(run, choice) {
  const action = legalActions(run).find((a) => a.id === choice);
  if (!action) throw new Error("Choice is not a legal action");
  const next = copy(run),
    before = copy(next.state);
  let removed = [];
  if (action.type === "undo") {
    const target = next.stack[next.stack.length - action.depth];
    next.state = copy(target.before);
    removed = next.stack.splice(next.stack.length - action.depth, action.depth);
    next.rollback_credits_used += action.depth;
  } else {
    const s = next.state;
    s.time_minutes += action.duration_minutes;
    if (action.type === "travel") {
      s.position = action.destination;
      s.battery -= action.battery_cost;
      s.energy_used += action.battery_cost;
    } else if (action.type === "recharge") s.battery = 9;
    else s.delivered.push(s.position);
    next.stack.push({ before, action: copy(action), after: copy(s) });
  }
  next.known_blockage = next.known_blockage || next.state.time_minutes >= 12;
  next.history.push({
    choice,
    action: copy(action),
    before,
    after: copy(next.state),
    removed_actions: removed,
    rollback_credits_used: next.rollback_credits_used,
    known_blockage: next.known_blockage,
  });
  return next;
}
export function buildRequest(run, model) {
  const s = run.state,
    actions = legalActions(run),
    rollback_options = actions
      .filter((a) => a.type === "undo")
      .map((a) => ({
        action: a.id,
        number_of_actions: a.depth,
        rollback_credits_used: a.depth,
        resulting_state: copy(run.stack[run.stack.length - a.depth].before),
        actions_removed: run.stack.slice(-a.depth).map((h) => copy(h.action)),
      }));
  const criteria = Object.fromEntries(
    actions.map((a) => [
      a.id,
      a.type === "travel"
        ? "Travel to " +
          a.destination +
          ", taking " +
          a.duration_minutes +
          " minutes and consuming " +
          a.battery_cost +
          " battery units."
        : a.type === "deliver"
          ? "Deliver the parcel here, taking 1 minute."
          : a.type === "recharge"
            ? "Recharge to 9 units, taking 3 minutes."
            : "Undo " +
              a.depth +
              " previous executed actions in one decision. Restore the full state shown for this option. Consume " +
              a.depth +
              " of the three rollback credits. Preserve observed events and API costs.",
    ]),
  );
  const instructions =
    run.mode === "multi"
      ? "Choose the next legal action to maximize on-time deliveries. Plan ahead using travel time, battery, deadlines and chargers. If a previous decision made the remaining route infeasible, choose undo_1, undo_2 or undo_3 to return directly to a viable earlier state. Compare each rollback option's resulting state. Repeating the same failed route wastes rollback credits. Only use facts in the state."
      : "Choose the next legal action to maximize on-time deliveries. Plan ahead using travel time, battery, deadlines and chargers. Only use facts in the state." +
        (run.mode === "single"
          ? " Undo can restore the previous state; consecutive undo actions roll back further."
          : "");
  const request = {
    state: {
      objective:
        "Maximize deliveries finished by their deadlines; then minimize finishing time and energy used.",
      current_state: copy(s),
      battery_capacity: 9,
      recharge_locations: ["Base", "Charging station"],
      recharge_minutes: 3,
      delivery_minutes: 1,
      rollback_credits_remaining:
        run.rollback_credit_limit - run.rollback_credits_used,
      rollback_options,
      parcels: SCENARIO.parcels.map((p) => ({
        ...p,
        status: s.delivered.includes(p.destination)
          ? "delivered"
          : s.time_minutes + 1 > p.deadline
            ? "expired"
            : "pending",
      })),
      map: SCENARIO.edges.map(([from, to, minutes]) => ({
        from,
        to,
        minutes,
        battery_cost: minutes,
        status: closed(from, to, s.time_minutes) ? "closed" : "open",
      })),
      known_events: run.known_blockage
        ? [
            "The Shop-Museum road closes at minute 12. Observed event knowledge remains after rollback.",
          ]
        : [],
      recent_decisions: run.history
        .slice(-8)
        .map((h) => ({ action: h.choice, state_after: copy(h.after) })),
      available_actions: copy(actions),
    },
    questions: { action: { type: "choice", instructions, criteria } },
    min_confidence: 0.7,
    tag: "delivery-planning-cli-" + run.mode,
  };
  if (model) request.model = model;
  return request;
}
export function unwrapResponse(raw) {
  const result = raw?.answers
    ? raw
    : raw?.decisions
      ? { ...raw, answers: raw.decisions }
      : null;
  const answer = result?.answers?.action;
  if (
    !answer ||
    typeof answer.choice !== "string" ||
    !Number.isFinite(answer.confidence) ||
    answer.confidence < 0 ||
    answer.confidence > 1
  ) {
    throw new Error(
      "Invalid decision response: expected a legal choice and confidence between 0 and 1",
    );
  }
  return result;
}
export function endReason(run) {
  if (run.state.delivered.length === 3) return "all_delivered";
  if (run.history.length >= run.max_decisions) return "decision_limit";
  if (!legalActions(run).length) return "no_legal_action";
  return null;
}
