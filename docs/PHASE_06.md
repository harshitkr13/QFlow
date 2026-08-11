# Phase 06 — Online Appointment

## Goal
Build the patient appointment flow.

## Flow
Doctor Profile -> Proceed to Appointment -> Select valid slot -> Confirm Appointment (`BOOKED`, no token assigned) -> Arrive at Clinic -> Check-in (`CHECKED_IN`, `QueueEntry` created, Token allocated via `QueueCounter`)

## Queue Reveal Rule
Operational queue details become visible only after the patient enters the Stage 3 appointment/queue decision flow.

## Token Allocation Rule
Creating an online appointment does NOT allocate a queue token. Token allocation occurs ONLY when the patient checks in at the clinic.

## Acceptance Criteria
- valid appointment can be created in `BOOKED` state without occupying a queue token
- conflicting appointment cannot be created
- check-in endpoint creates `QueueEntry` and allocates an atomic token via `QueueCounter`
- cancellation works and releases appointment slot
- invalid schedules are rejected
