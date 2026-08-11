# Phase 07 — Walk-in Registration

## Goal
Allow receptionists/compounders to add patients who did not book online.

## Flow
Staff -> Add Walk-in -> Patient -> Doctor -> Priority -> QueueEntry (`WAITING`) -> Atomic Token Allocated via `QueueCounter`

## Important
Walk-in patients become normal `QueueEntry` records with `source = WALK_IN`. Operational tokens MUST be generated using an atomic `QueueCounter` increment scoped to `{ clinicId, doctorId, date }`.

## Acceptance Criteria
- staff can create walk-in
- token is generated atomically via `QueueCounter` (`$inc`)
- duplicate token generation under concurrent staff actions is strictly prevented
- walk-in appears in operational hybrid queue
