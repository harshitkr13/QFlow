# Phase 08 — Queue Engine

## Goal
Implement the core QFlow state machine.

## States
- `BOOKED` (Appointment created, no token)
- `CHECKED_IN` / `WAITING` (QueueEntry created, token allocated via `QueueCounter`)
- `CALLED`
- `IN_CONSULTATION`
- `COMPLETED`
- `SKIPPED`
- `NO_SHOW`
- `CANCELLED`

## Actions
- check-in (creates `QueueEntry` & allocates token)
- call next
- start consultation
- complete
- skip
- no-show
- cancel
- rejoin (assigns new token/position)
- pause/resume

## Critical Requirement
1. Queue ordering MUST use a deterministic **HYBRID** queue engine combining appointment windows and walk-in arrivals without arbitrarily reordering actively waiting patients.
2. Token generation MUST be server-controlled using an atomic `QueueCounter` (`$inc`).

## Acceptance Criteria
- HYBRID queue algorithm deterministically orders online check-ins and walk-ins
- Two staff users cannot accidentally generate duplicate tokens or corrupt queue state
- Idempotency checks prevent double-click actions from advancing queue unexpectedly
