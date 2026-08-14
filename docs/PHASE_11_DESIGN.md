# Phase 11 — Payment Architecture, Invoicing & Clinic Operational Analytics Design Specification (Corrected & Hardened)

## Executive Summary

Phase 11 introduces a hardened financial, auditing, and operational intelligence layer to the QFlow platform:
1. **Hardened Financial State Machines & Invoicing:** Strict state machine boundaries for `Invoice.js` (`DRAFT` $\rightarrow$ `ISSUED` $\rightarrow$ `PAID` $\rightarrow$ `REFUNDED` or `CANCELLED`) and `Payment.js` (`PENDING` $\rightarrow$ `INITIATED` $\rightarrow$ `SUCCESS` or `FAILED`, `SUCCESS` $\rightarrow$ `REFUNDED`), with server-authoritative fee calculation and 1-successful-payment-per-invoice constraints.
2. **Provider-Agnostic Transaction Architecture:** Clear separation between external payment provider interactions (outside DB transactions) and internal MongoDB atomic transactions (`Payment` status + `Invoice` status + append-only `FinancialAuditLog.js`).
3. **Immutable Financial Audit Trail:** Append-only `FinancialAuditLog.js` recording all financial actions with zero update or delete endpoints.
4. **Clinic Operational Analytics Engine:** Real-time MongoDB aggregation pipelines computing clinic throughput, queue wait averages, walk-in vs online ratios, and revenue summaries across strict IST (`Asia/Kolkata`) daily boundaries (`00:00:00.000` to `23:59:59.999` IST).

Phase 11 preserves all prior Phase 03–10 guarantees, including server-authoritative state, Phase 08 HYBRID queue ordering, Phase 09 live queue polling, Phase 10 public display safety, and IST timezone rules.

---

## 1. Scope & Feature Boundaries

### 1.1 In-Scope (Phase 11 Deliverables)
- **New `Invoice.js` Model:** Server-controlled consultation invoicing (`DRAFT` $\rightarrow$ `ISSUED` $\rightarrow$ `PAID` or `CANCELLED`, `PAID` $\rightarrow$ `REFUNDED`).
- **New `Payment.js` Model:** Transaction record tracking payment attempts (`PENDING` $\rightarrow$ `INITIATED` $\rightarrow$ `SUCCESS` or `FAILED`, `SUCCESS` $\rightarrow$ `REFUNDED`). Supports multiple failed attempts for auditability, but maximum 1 `SUCCESS` payment per invoice.
- **New `FinancialAuditLog.js` Model:** Append-only, immutable audit log for all financial events.
- **Provider Abstraction Layer:** `PaymentProvider` interface ready for future Razorpay/Stripe plugins without altering core business logic. External provider calls execute strictly outside MongoDB transactions.
- **Idempotency Engine:** `idempotencyKey` tracking to prevent double-click submissions, browser refreshes, network retries, or duplicate webhook deliveries.
- **Full Refund Policy:** Locked strictly to `FULL REFUND ONLY` for Phase 11.
- **Patient Invoicing APIs & UI:** `GET /api/patient/invoices`, `GET /api/patient/invoices/:id`, `POST /api/patient/payments/initiate`.
- **Clinic Operational Analytics APIs & UI:**
  - `GET /api/staff/analytics/daily?clinicId=...` (Assigned clinic throughput & wait averages)
  - `GET /api/doctors/me/analytics` (Doctor personal consultation metrics)
  - `GET /api/admin/analytics/summary` (Global platform metrics & total revenue)
- **Automated Validation Suite:** `src/server/utils/validatePhase11.js` (Coverage for billing, payments, financial audit immutability, IST boundaries, and Phase 03–10 regressions).

### 1.2 Out-of-Scope (Deferred to Phase 12)
- **AI / Machine Learning Wait Predictions:** Deferred to Phase 12.
- **Automated Clinical Decision Support & LLM Features:** Deferred to Phase 12.
- **Live Third-Party Payment Credentials (Razorpay/Stripe API Keys):** Abstraction defined; live merchant keys deferred to deployment hardening.

---

## 2. Hardened Financial State Machines

### 2.1 Payment State Machine
```
               ┌──────────┐
               │ PENDING  │
               └────┬─────┘
                    │
                    ▼
               ┌──────────┐
               │INITIATED │
               └────┬─────┘
                    │
         ┌──────────┴──────────┐
         ▼                     ▼
   ┌──────────┐          ┌──────────┐
   │ SUCCESS  │          │  FAILED  │
   └────┬─────┘          └──────────┘
        │                 (Terminal for this attempt;
        ▼                  requires NEW Payment attempt)
   ┌──────────┐
   │ REFUNDED │
   └──────────┘
   (Terminal)
```
- **Rules & Invariants:**
  - `SUCCESS` cannot transition to `FAILED`.
  - `FAILED` cannot transition to `SUCCESS` (a new `Payment` attempt document must be created).
  - `REFUNDED` is terminal.
  - Duplicate successful confirmation is idempotent.
  - Duplicate refund is rejected safely with `HTTP 400 Bad Request`.

### 2.2 Invoice State Machine
```
               ┌──────────┐
               │  DRAFT   │
               └────┬─────┘
                    │
                    ▼
               ┌──────────┐
               │  ISSUED  │
               └────┬─────┘
                    │
         ┌──────────┴──────────┐
         ▼                     ▼
   ┌──────────┐          ┌──────────┐
   │   PAID   │          │CANCELLED │
   └────┬─────┘          └──────────┘
        │                 (Terminal)
        ▼
   ┌──────────┐
   │ REFUNDED │
   └──────────┘
   (Terminal)
```
- **Strictly Prohibited Transitions:**
  - `PAID` $\rightarrow$ `CANCELLED` (Forbidden)
  - `CANCELLED` $\rightarrow$ `PAID` (Forbidden)
  - `REFUNDED` $\rightarrow$ `PAID` (Forbidden)
  - `REFUNDED` $\rightarrow$ `CANCELLED` (Forbidden)

---

## 3. Provider Boundary & Transaction Boundaries

### 3.1 Transaction Boundary Separation
External payment provider API calls (or mock provider calls) **MUST NOT** run inside MongoDB transactions.
```
Client Initiates Payment
        │
        ▼
Server Loads Invoice & Creates Pending Payment Document (No DB Tx)
        │
        ▼
External Payment Provider Interaction (Outside DB Tx)
        │
        ▼
Provider Verification Response Received
        │
        ▼
MongoDB Session Transaction (Atomic Internal State Write):
   ├── Payment status updated to SUCCESS/FAILED
   ├── Invoice status updated to PAID (if SUCCESS)
   └── Append-Only FinancialAuditLog created
```

---

## 4. Data Model Specifications

### 4.1 `Invoice.js` Model
```javascript
import mongoose from 'mongoose';

const invoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: { type: String, required: true, unique: true },
    clinicId: { type: mongoose.Schema.Types.ObjectId, ref: 'Clinic', required: true },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true },
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
    appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', default: null },
    queueEntryId: { type: mongoose.Schema.Types.ObjectId, ref: 'QueueEntry', required: true },
    
    consultationFee: { type: Number, required: true, min: 0 },
    clinicFacilityFee: { type: Number, default: 0, min: 0 },
    taxAmount: { type: Number, default: 0, min: 0 },
    discountAmount: { type: Number, default: 0, min: 0 },
    totalPayableAmount: { type: Number, required: true, min: 0 },
    
    status: {
      type: String,
      enum: ['DRAFT', 'ISSUED', 'PAID', 'CANCELLED', 'REFUNDED'],
      default: 'ISSUED',
    },
    issuedAt: { type: Date, default: Date.now },
    paidAt: { type: Date, default: null },
  },
  { timestamps: true }
);

invoiceSchema.index({ queueEntryId: 1 }, { unique: true });
invoiceSchema.index({ patientId: 1, createdAt: -1 });
invoiceSchema.index({ clinicId: 1, createdAt: -1 });

export const Invoice = mongoose.model('Invoice', invoiceSchema);
export default Invoice;
```

### 4.2 `Payment.js` Model
```javascript
import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema(
  {
    invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', required: true },
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
    clinicId: { type: mongoose.Schema.Types.ObjectId, ref: 'Clinic', required: true },
    
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'INR' },
    paymentMethod: { type: String, enum: ['CASH', 'CARD', 'UPI', 'ONLINE_MOCK'], default: 'ONLINE_MOCK' },
    status: { type: String, enum: ['PENDING', 'INITIATED', 'SUCCESS', 'FAILED', 'REFUNDED'], default: 'INITIATED' },
    
    // Explicit Identity Separation
    idempotencyKey: { type: String, required: true, unique: true },
    providerTransactionId: { type: String, default: null }, // External gateway ref
    
    failureReason: { type: String, default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

paymentSchema.index({ invoiceId: 1, createdAt: -1 });
paymentSchema.index(
  { invoiceId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: 'SUCCESS' }, name: 'unique_successful_payment_per_invoice' }
);
paymentSchema.index({ idempotencyKey: 1 }, { unique: true });

export const Payment = mongoose.model('Payment', paymentSchema);
export default Payment;
```

### 4.3 `FinancialAuditLog.js` Model (Append-Only)
```javascript
import mongoose from 'mongoose';

const financialAuditLogSchema = new mongoose.Schema(
  {
    paymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment', default: null },
    invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', required: true },
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
    clinicId: { type: mongoose.Schema.Types.ObjectId, ref: 'Clinic', required: true },
    action: {
      type: String,
      enum: ['INVOICE_CREATED', 'PAYMENT_INITIATED', 'PAYMENT_SUCCESS', 'PAYMENT_FAILED', 'REFUND_INITIATED', 'REFUND_COMPLETED'],
      required: true,
    },
    previousStatus: { type: String, default: null },
    newStatus: { type: String, required: true },
    amount: { type: Number, required: true },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    actorRole: { type: String, required: true },
    provider: { type: String, default: 'INTERNAL' },
    transactionReference: { type: String, required: true },
    reason: { type: String, default: null },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

financialAuditLogSchema.index({ invoiceId: 1, timestamp: -1 });
financialAuditLogSchema.index({ patientId: 1, timestamp: -1 });

export const FinancialAuditLog = mongoose.model('FinancialAuditLog', financialAuditLogSchema);
export default FinancialAuditLog;
```

---

## 5. Security Invariants & Payment Amount Immutability

1. **Amount Immutability:** Clients CANNOT submit payment amounts in API requests. `Payment.amount` is ALWAYS derived server-side: `Invoice.totalPayableAmount` $\rightarrow$ `Payment.amount`.
2. **IDOR Protection:** Patient A querying or paying Patient B's invoice returns `HTTP 403 Forbidden` or `HTTP 404 Not Found`.
3. **Refund Policy:** Locked to `FULL REFUND ONLY`. Partial refunds are forbidden in Phase 11. Initiated strictly by `STAFF` or `ADMIN`.

---

## 6. Timezone & Analytics Boundary

- **IST Operational Boundaries:** Analytics queries compute exact IST start and end times (`00:00:00.000 IST` to `23:59:59.999 IST`) and convert range to UTC for MongoDB queries.
- **Prohibited Syntax:** `toISOString().slice(0, 10)` is strictly forbidden for operational date boundary calculation.

---

## 7. Failure Scenarios & Edge Cases (25 Scenarios)

1. Client Submitting Custom Payment Amount $\rightarrow$ Ignored; derived from `Invoice.totalPayableAmount`.
2. Duplicate Invoice Creation Attempt $\rightarrow$ Blocked by `{ queueEntryId: 1 }` unique index.
3. Patient A Accessing Patient B's Invoice $\rightarrow$ `HTTP 403 Forbidden`.
4. Transitioning `PAID` Invoice to `CANCELLED` $\rightarrow$ `HTTP 400 Bad Request`.
5. Transitioning `FAILED` Payment to `SUCCESS` without New Document $\rightarrow$ `HTTP 400 Bad Request`.
6. Transitioning `REFUNDED` Payment to `PAID` $\rightarrow$ `HTTP 400 Bad Request`.
7. Rapid Double-Click on Initiate Payment $\rightarrow$ Handled by `idempotencyKey` unique index.
8. Duplicate Payment Webhook Confirmation $\rightarrow$ Idempotent response (`HTTP 200 OK`).
9. Duplicate Refund Attempt $\rightarrow$ Rejected (`HTTP 400 Bad Request` "Payment already refunded").
10. Attempting Partial Refund $\rightarrow$ Rejected (`HTTP 400 Bad Request` "Full refund only").
11. Provider Network Timeout $\rightarrow$ Provider call occurs outside DB transaction; DB transaction aborted cleanly.
12. Staff Accessing Other Clinic's Billing Data $\rightarrow$ `HTTP 403 Forbidden`.
13. Doctor Querying Other Doctor's Analytics $\rightarrow$ `HTTP 403 Forbidden`.
14. Analytics Query for Day with Zero Consultations $\rightarrow$ Returns zero counters gracefully.
15. Midnight Rollover in IST $\rightarrow$ Computed cleanly via IST offset range.
16. Paying Cancelled Invoice $\rightarrow$ `HTTP 400 Bad Request`.
17. Attempting Payment on Uncompleted Queue Entry $\rightarrow$ `HTTP 400 Bad Request`.
18. Tampering with Financial Audit Log $\rightarrow$ Blocked (No update or delete API endpoints exist).
19. Multiple Failed Payment Attempts for 1 Invoice $\rightarrow$ Allowed and retained for audit log.
20. Second Successful Payment Attempt for 1 Invoice $\rightarrow$ Blocked by sparse unique index `{ invoiceId: 1, status: 'SUCCESS' }`.
21. Deactivated Doctor Analytics Query $\rightarrow$ Admin access allowed; Doctor user access blocked.
22. Zero Revenue Day $\rightarrow$ Calculates `totalRevenue: 0` without division by zero.
23. Discount Exceeding Fee $\rightarrow$ Validates `totalPayableAmount >= 0`.
24. Patient Attempting Self-Refund $\rightarrow$ `HTTP 403 Forbidden` (Restricted to `STAFF` / `ADMIN`).
25. Mongoose Transaction Failure $\rightarrow$ Aborts session; rolls back `Payment` and `Invoice` status mutations.

---

## 8. Test Plan (`src/server/utils/validatePhase11.js`)

Automated test suite will verify:
- Invoice creation & fee derivation.
- 1-invoice-per-consultation unique constraint.
- Payment initiation with `idempotencyKey`.
- Provider call outside DB transaction & atomic DB transaction write.
- Rejection of invalid state transitions (`PAID` $\rightarrow$ `CANCELLED`, `REFUNDED` $\rightarrow$ `PAID`).
- Duplicate refund rejection (`HTTP 400`).
- IDOR protection on invoices, payments, and financial audit logs.
- Immutable financial audit log creation.
- IST daily analytics aggregation correctness.
- Full Phase 03–10 regression suite execution.
- Client Vite production build.

---

## 9. Step-by-Step Implementation Plan

1. **Step 1:** Create `Invoice.js`, `Payment.js`, `FinancialAuditLog.js`.
2. **Step 2:** Implement `paymentProvider.js` abstraction.
3. **Step 3:** Implement `billingController.js` and `analyticsController.js`.
4. **Step 4:** Implement routes (`billingRoutes.js`, `analyticsRoutes.js`) and mount in `server.js`.
5. **Step 5:** Add API client methods in `api.js`.
6. **Step 6:** Build React components in `App.jsx`.
7. **Step 7:** Create automated validation suite `validatePhase11.js`.
8. **Step 8:** Run validation and full regression suite (Phases 03–11).
9. **Step 9:** Execute client production build (`npm run build:client`).
10. **Step 10:** Read-Only Code Audit & Git Checkpoint.
