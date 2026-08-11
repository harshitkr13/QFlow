# QFlow — Development Rules

## 1. Stack Discipline

Use only:
- React
- JavaScript
- CSS
- Node.js
- Express.js
- MongoDB
- Mongoose

Do not add a new library/framework unless there is a demonstrated requirement and the project specification is explicitly updated.

---

## 2. No Premature Complexity

Do not add:
- microservices
- Redis
- WebSockets
- state-management frameworks
- UI frameworks
- message queues
- AI
- Docker
- cloud-specific architecture

unless explicitly approved in a later project decision.

---

## 3. Business Logic First

Before implementing a screen:
1. define the data;
2. define valid states;
3. define who can change each state;
4. define edge cases;
5. define the API;
6. then build the UI.

---

## 4. Backend Is the Source of Truth

Never calculate or mutate critical queue state only in React.

Backend controls:
- token numbers
- queue ordering
- appointment conflicts
- doctor availability
- state transitions
- permissions
- ratings eligibility

---

## 5. Role Authorization

Roles:
- PATIENT
- DOCTOR
- STAFF
- ADMIN

Every protected backend endpoint must enforce role permissions.

Hiding a button in React is not security.

---

## 6. Business Entity Distinctions

Keep these concepts separate in design and implementation:

1. **Appointment:** A planned reservation for a doctor/date/time. An appointment does NOT occupy an operational queue position or hold a token.
2. **QueueEntry:** An active operational patient position in today's queue.
3. **QueueCounter:** The atomic mechanism scoped to `{ clinicId, doctorId, date }` that allocates operational token numbers.

---

## 7. Queue Rules

- A queue entry must have a doctor, patient, source, and allocated token number.
- **Token Allocation Timing:** Online appointments receive tokens ONLY upon clinic check-in (`CHECKED_IN` -> `QueueEntry` created). Walk-in patients receive tokens when staff creates their `QueueEntry`.
- **Atomic QueueCounter:** Token numbers MUST be generated via an atomic `QueueCounter` scoped to `{ clinicId, doctorId, date }`. Duplicate tokens under concurrent staff actions are strictly forbidden.
- **Hybrid Queue Ordering:** The queue engine MUST use a deterministic `HYBRID` policy combining appointment time windows and walk-in arrivals based on check-in time, appointment slot, doctor availability/breaks, and active queue state.
- Once a patient is actively waiting or in consultation, the system MUST NOT arbitrarily reorder them merely because a patient with a later appointment arrives.
- Queue transitions must be validated server-side.
- Completed entries cannot be edited into arbitrary earlier states.
- Cancelled entries must not remain active.
- No-show handling must be explicit.
- Rejoining must produce a valid new queue token/position.
- Staff actions should be recorded where operational history matters.

---

## 8. Appointment Rules

- Do not allow conflicting appointments.
- Appointment availability must be checked server-side.
- An online appointment creates an `Appointment` record in `BOOKED` state without assigning a token or creating a `QueueEntry`.
- Cancellation must update the associated operational state.
- A walk-in patient must never require an online appointment.
- An appointment becomes a queue entry (`QueueEntry`) with a token allocated via `QueueCounter` ONLY after valid clinic check-in.

---

## 9. Doctor Schedule Rules

Keep:
- recurring schedule
- breaks
- temporary availability

as separate concepts.

Never overwrite a recurring schedule just because a doctor is temporarily unavailable.

---

## 10. Patient UX Rules

Initial doctor list:
- no queue count
- no current token
- no waiting count
- no online/walk-in count
- no waiting estimate

After proceeding to appointment/queue (Stage 3):
- reveal queue information
- show estimate as a range
- show recommended arrival time
- clearly state that actual time may vary

---

## 11. Gender/Specialty Rule

Do not hard-code medical misconceptions.

For example:
- gynecology is not a "female patients only" specialty.
- doctor gender can be an optional preference/filter.
- specialty selection is not a diagnosis.

---

## 12. UI Rules

Prefer:
- simple layouts
- clear hierarchy
- accessible labels
- loading states
- empty states
- error states
- mobile-friendly design

Avoid decorative UI that hides operational information.

---

## 13. API Rules

- Use clear HTTP methods.
- Validate input.
- Return meaningful status codes.
- Never trust client-provided role.
- Never expose passwords or secrets.
- Do not return unnecessary private fields.

---

## 14. Database Rules

- Define schemas deliberately.
- Add indexes only for real query patterns.
- Use `QueueCounter` collection for atomic token allocation.
- Keep references consistent.
- Avoid uncontrolled duplication of critical state.
- Use timestamps for operational records.
- Design for concurrency around token/appointment operations.

---

## 14. Error Handling

Every important frontend request should handle:
- loading
- success
- empty result
- validation error
- server error
- unauthorized/forbidden
- network failure

Never leave the user with a blank screen after an API failure.

---

## 15. Testing Rule

Before marking a phase complete, test:
- happy path
- invalid input
- unauthorized access
- duplicate request
- concurrent action where relevant
- refresh/reload behavior
- empty state
- error state

---

## 16. Git Rule

Use small, meaningful commits.

Examples:

```text
feat: add patient registration
feat: add doctor discovery
feat: implement walk-in queue entry
fix: prevent duplicate queue tokens
fix: handle doctor break in wait estimate
```

Avoid:

```text
update
final
changes
done
new
```

---

## 17. Documentation Rule

When a business rule changes:
1. update PRD;
2. update relevant phase document;
3. update architecture if needed;
4. only then implement code.

Documentation is the project context source of truth.

---

## 18. Completion Rule

Do not call a feature complete because the page renders.

A feature is complete when:
- UI works;
- API works;
- database persists correctly;
- authorization works;
- edge cases are handled;
- refresh does not break the state;
- acceptance scenario passes.
