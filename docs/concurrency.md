# Concurrency

Every mutating flow must explicitly choose a concurrency strategy.

## Acceptable Strategies

- Transaction.
- Lock.
- Queue.
- Optimistic version check.
- Idempotency key.
- Explicit rejection while another operation is active.

## Flows That Need Review

- Player orders during turn resolve.
- Admin scenario apply while players are connected.
- Country deletion while orders/events/armies exist.
- Two admins editing content/defines/theme.
- Upload cleanup while files are referenced.
- AI takeover during active planning.
- WS reconnect/replay storms.
- Diplomacy responses from multiple actors.
- Runtime state persistence uses a serial debounced queue in `apps/server/src/persistence/persistentStateScheduler.ts`.
- Background persistence tasks that must run in order should use `apps/server/src/persistence/serialTaskQueue.ts` instead of ad hoc promise chains.

## Reporting

Plans and final reports must name the chosen strategy for new or changed mutating flows.
