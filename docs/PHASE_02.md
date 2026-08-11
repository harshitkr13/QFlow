# Phase 02 — Data Models

## Goal
Create the core domain model before business workflows.

## Models
- User
- Clinic
- Doctor
- Patient
- Specialty
- Appointment
- QueueEntry
- QueueCounter
- DoctorSchedule
- QueueHistory
- Rating

## Key Decisions
1. **Appointment vs QueueEntry:** `Appointment` represents a planned reservation (`BOOKED`). `QueueEntry` represents active operational queue participation (`WAITING`). An appointment may exist without a `QueueEntry` until clinic check-in.
2. **Token Allocation:** Online appointments receive tokens ONLY upon check-in when `QueueEntry` is created. Walk-in patients receive tokens when `QueueEntry` is created by staff.
3. **QueueCounter:** Token generation uses an atomic `QueueCounter` schema scoped to `{ clinicId, doctorId, date }` (`lastTokenNumber`).

## Acceptance Criteria
- schemas compile
- references are valid
- `QueueCounter` model supports atomic increments (`$inc`)
- required fields are enforced
- timestamps exist where required
