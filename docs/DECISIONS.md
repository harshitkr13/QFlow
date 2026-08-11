# QFlow Architecture & Business Decisions

## Decision 001 — Token Allocation
Decision:
Online appointments receive tokens only after clinic check-in.

Reason:
An appointment does not equal active queue participation.

## Decision 002 — QueueCounter
Decision:
Use a dedicated QueueCounter concept with atomic token allocation.

Reason:
Prevent duplicate tokens under concurrent staff actions.

## Decision 003 — Hybrid Queue
Decision:
Use a deterministic hybrid queue combining appointment windows and walk-in patients.

Reason:
Pure FIFO and pure appointment-first do not accurately represent real clinic operations.

## Locked Invariants

The QFlow codebase and system implementation MUST NEVER violate the following invariants:

1. **Stack Constraint:**
   - The application MUST remain a pure MERN application (React, JavaScript, Vanilla CSS, Node.js, Express.js, MongoDB, Mongoose).
   - NO AI/ML, Next.js, TypeScript, Tailwind, Redux, Material UI, Socket.io, Redis, Kafka, or microservices are permitted.
   - Real-time queue updates MUST use HTTP polling.

2. **3-Stage Patient UX Isolation:**
   - Stage 1 (Doctor Discovery List) and Stage 2 (Doctor Profile) MUST NOT display operational queue metrics (waiting count, serving token, online/walk-in count, estimated wait time).
   - Operational queue details MUST only be revealed in Stage 3 (Appointment / Queue Decision context).

3. **Entity Separation:**
   - `Appointment` (planned reservation), `QueueEntry` (active queue participant), and `QueueCounter` (atomic token allocator) MUST remain separate entities.
   - An online appointment MUST NOT automatically generate a `QueueEntry` or allocate a queue token at booking time.

4. **Token Allocation & Atomic QueueCounter:**
   - Queue tokens MUST ONLY be allocated upon patient check-in at the clinic or upon staff walk-in creation.
   - Token numbers MUST be generated atomically via `QueueCounter` scoped to `{ clinicId, doctorId, date }` (`$inc`). Duplicate tokens MUST NOT be generated under concurrent submissions.

5. **Deterministic Hybrid Queue Ordering:**
   - Queue ordering MUST follow the HYBRID policy deterministically combining appointment time windows, check-in timestamps, walk-in arrival times, doctor availability/breaks, and average consultation durations.
   - Actively waiting or in-consultation patients MUST NOT be arbitrarily reordered merely because another patient with a later appointment arrives.

6. **Primary Operator Responsibility:**
   - Operational queue administration (`Call Next`, `Add Walk-in`, `Skip`, `No-Show`, `Pause Queue`, `Status Overrides`) is managed by Receptionist / Staff. Doctors focus on clinical consultation status.

7. **Backend Server Authority & Role Authorization:**
   - All state transitions, token allocations, conflict checks, and role permissions MUST be enforced on the backend Express server. Frontend hiding is strictly insufficient.
