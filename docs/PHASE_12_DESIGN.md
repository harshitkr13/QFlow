# PHASE 12 — AI/ML INTELLIGENCE LAYER DESIGN SPECIFICATION

**System**: QFlow Healthcare Platform  
**Document Type**: Phase 12 Architecture & Technical Design Specification  
**Baseline Commit**: `e58573e — feat: implement payments invoicing and analytics`  
**Status**: DESIGN ONLY — AWAITING IMPLEMENTATION APPROVAL  

---

## 1. EXECUTIVE SUMMARY

Phase 12 introduces a lightweight, production-grade **AI/ML Intelligence Layer** to QFlow. The objective is to augment QFlow's operational decision-making using historical queue, appointment, and consultation data, without compromising the deterministic reliability of core operations.

### Key Architectural Principles
1. **Deterministic Core Integrity**: The Phase 08 HYBRID queue ordering algorithm (`priorityWeight` $\rightarrow$ `effectiveSlotMinutes` $\rightarrow$ `joinedAt` $\rightarrow$ `tokenNumber`) and Phase 09 live queue state machine remain 100% server-authoritative and deterministic. Machine learning NEVER re-orders patients or alters token allocations.
2. **Strict Clinical Boundary**: The AI/ML layer operates exclusively on **operational metrics** (wait times, consultation durations, congestion forecasts, no-show probabilities, and anomaly detection). It is strictly prohibited from medical diagnosis, triage recommendations, clinical risk assessment, or prescription generation.
3. **Graceful Fallback & Prediction Safety**: All ML predictions are accompanied by confidence metrics and fall back seamlessly to deterministic Phase 09 estimates (e.g., `peopleAhead × avgConsultationTimeMin`) if confidence is low, historical sample size is insufficient, or model artifacts are unavailable.
4. **Zero Heavy External Dependencies**: Machine learning models utilize lightweight, in-memory tabular algorithms (such as Ridge Regression, Random Forest, or Weighted Exponential Moving Averages) executed directly within the Node.js runtime or via a lightweight, embedded inference runner. No expensive external AI APIs or Python microservice dependencies are forced.

---

## 2. REPOSITORY FINDINGS & BASELINE AUDIT

Inspected repository baseline at commit `e58573e` across all core database schemas, controllers, and service layers:

- **Phase 08 HYBRID Queue Engine**: Computes exact queue ordering using compound database index `hybrid_queue_ordering_idx`.
- **Phase 09 Live Queue**: Computes deterministic wait time for active `WAITING` patients using `Doctor.avgConsultationTimeMin` and active serving token state.
- **Phase 10 Public Display & Ratings**: Provides privacy-safe anonymous queue feeds and patient ratings (`sumRatings`, `totalRatings`, `averageRating`).
- **Phase 11 Billing & Analytics**: Tracks consultation invoices (`Invoice`), payments (`Payment`), financial logs (`FinancialAuditLog`), and daily IST operational aggregations (`analyticsController.js`).

### Audit Summary
The current database schemas contain explicit timestamp fields (`joinedAt`, `calledAt`, `consultationStartedAt`, `completedAt`) and operational flags (`source`, `priority`, `slotTime`, `rejoinCount`) necessary to build tabular training features.

---

## 3. EXISTING DATA INVENTORY

| Collection | ML-Relevant Existing Fields | Unused / Missing Fields for ML | Data Availability Status |
|---|---|---|---|
| `QueueEntry` | `doctorId`, `clinicId`, `patientId`, `appointmentId`, `source`, `priority`, `status`, `joinedAt`, `effectiveSlotMinutes`, `calledAt`, `consultationStartedAt`, `completedAt`, `rejoinCount`, `queueDate` | Weather, traffic, patient distance at arrival | **Ready** (High utility for duration & wait prediction) |
| `Appointment` | `patientId`, `doctorId`, `clinicId`, `appointmentDate`, `slotTime`, `status`, `bookedAt` | Cancellation reason text, patient reminder interaction | **Ready** (High utility for no-show risk & volume forecasting) |
| `Doctor` | `clinicId`, `specialtyId`, `consultationFee`, `avgConsultationTimeMin`, `operationalStatus`, `averageRating`, `totalRatings` | Doctor fatigue index, real-time consultation velocity | **Ready** (Utility for baseline fallback & doctor workload features) |
| `Patient` | `gender`, `dateOfBirth` (age calculation) | Historical medical history, chronic conditions | **Ready** (Operational demographic grouping ONLY) |
| `Clinic` | `location` (GeoJSON coordinates), `isActive` | Parking capacity, clinic seating capacity | **Ready** (Geographic & facility baseline features) |
| `QueueHistory` | `queueEntryId`, `action`, `actorRole`, `timestamp` | Detailed delay reason codes | **Ready** (Audit timestamps for queue transition lag analysis) |

---

## 4. PHASE 12 GOALS

1. **Intelligent Wait-Time Prediction**: Provide dynamic wait-time predictions that adjust for time of day, doctor-specific consultation speed variance, queue depth, and patient arrival source (walk-in vs. online).
2. **Consultation Duration Forecasting**: Predict patient-specific consultation duration based on doctor history, time slot position, and daily queue congestion.
3. **Queue Congestion & Workload Forecasting**: Forecast daily peak congestion hours and walk-in/online patient volume per clinic to aid staff scheduling.
4. **Appointment No-Show Risk Scoring**: Calculate a numerical probability score (0.0 to 1.0) indicating no-show risk to enable staff follow-up reminders.
5. **Operational Anomaly Detection**: Detect operational anomalies (e.g., severe queue bottlenecks, extended doctor idle periods, or abnormal cancellation spikes).

---

## 5. SCOPE MATRIX (MUST / SHOULD / FUTURE)

### A. MUST HAVE (Core Phase 12 Deliverables)
- Dynamic AI Wait-Time & Duration Prediction Engine (augmenting Phase 09).
- Deterministic Fallback Guardrails (100% fallback to Phase 09 calculation on low confidence).
- In-App Operational Anomaly Detection (queue surge, delay, and stall alerts).
- Patient, Staff, and Doctor UI Prediction & Anomaly Indicators.
- Comprehensive Validation Suite (`validatePhase12.js`) protecting Phase 03–11 regressions.

### B. SHOULD HAVE (Secondary Phase 12 Features)
- Appointment No-Show Risk Probability Scoring (advisory for staff dashboard).
- Clinic Operational Workload & Congestion Forecasting (hourly patient load predictions).
- In-Memory Model Artifact Caching & Periodic Coefficient Recalibration.

### C. FUTURE / OUT OF SCOPE (Strictly Excluded from Phase 12)
- External paid LLM APIs (OpenAI, Anthropic) or cloud ML pipelines (SageMaker, Vertex AI).
- Python microservices or Flask/FastAPI sidecars (kept natively inside Node.js environment).
- Medical diagnosis, symptom evaluation, triage recommendations, or clinical advice.
- Automated appointment cancellation or deprioritization based on ML scores.

---

## 6. AI/ML USE CASES

### Use Case 1: Dynamic Patient Wait-Time Prediction
- **Actor**: Patient (Live Queue Dashboard)
- **Description**: Patient views predicted wait time in minutes, model confidence badge ("High Confidence (AI)" vs "Estimated (Baseline)"), and expected call window.

### Use Case 2: Reception Queue Congestion Alert
- **Actor**: Reception Staff
- **Description**: Staff dashboard alerts when predicted queue arrival rate exceeds doctor throughput capacity for the next 2 hours.

### Use Case 3: Doctor Consultation Workload Forecast
- **Actor**: Doctor / Clinic Admin
- **Description**: Doctor views estimated total session completion time and predicted individual patient durations.

### Use Case 4: Staff No-Show Advisory
- **Actor**: Reception Staff
- **Description**: Displays high no-show risk indicators on today's scheduled appointments so staff can send manual confirmation SMS/calls.

---

## 7. WAIT-TIME PREDICTION DESIGN

### 7.1 Mathematical Formulation
The actual wait time for patient $i$ joining queue at $T_{join}$ is given by:

$$W_i = \sum_{j \in P_i} D_j + R_{active}$$

Where:
- $P_i$: Set of patients ordered ahead of patient $i$ by the Phase 08 HYBRID algorithm.
- $D_j$: Predicted consultation duration for patient $j$ ahead.
- $R_{active}$: Predicted remaining consultation duration for the patient currently `IN_CONSULTATION`.

### 7.2 Model Augmentation vs. Deterministic Fallback
- **Phase 09 Deterministic Calculation (Fallback)**:
  $$\hat{W}_{det} = (\text{peopleAhead}) \times (\text{Doctor.avgConsultationTimeMin}) + \text{remainder}$$
- **Phase 12 AI Model**:
  $$\hat{W}_{AI} = \sum_{j \in P_i} \hat{D}_{ML}(j) + \hat{R}_{ML}$$
  Where $\hat{D}_{ML}(j)$ is derived from a regression model trained on historical `actualDurationMinutes`.

---

## 8. DATASET & FEATURE ENGINEERING

### 8.1 Feature Matrix Construction

| Feature Name | Data Type | Source | Feature Description & Transformation |
|---|---|---|---|
| `doctorId` | Categorical | `QueueEntry.doctorId` | One-hot encoded or target-encoded doctor identifier |
| `clinicId` | Categorical | `QueueEntry.clinicId` | Clinic location category |
| `source` | Categorical | `QueueEntry.source` | Binary flag: `ONLINE` (1) vs `WALK_IN` (0) |
| `priority` | Categorical | `QueueEntry.priority` | Binary flag: `URGENT` (1) vs `NORMAL` (0) |
| `dayOfWeek` | Discrete | `QueueEntry.joinedAt` | Day of week integer (0 = Sunday, 6 = Saturday) |
| `hourOfDay` | Continuous | `QueueEntry.joinedAt` | Fractional hour (e.g., 9.5 for 09:30 AM) |
| `queueDepth` | Continuous | Real-time query | Count of active `WAITING` patients at arrival time |
| `tokenNumber` | Continuous | `QueueEntry.tokenNumber` | Token position allocated for the day |
| `docAvgDuration` | Continuous | `Doctor.avgConsultationTimeMin` | Baseline configured doctor average duration |
| `doctorRecentAvg` | Continuous | `QueueEntry` (last 5) | Rolling mean duration of last 5 completed consultations today |
| `slotMinutes` | Continuous | `QueueEntry.effectiveSlotMinutes` | Time of day in minutes from midnight |
| `patientAge` | Continuous | `Patient.dateOfBirth` | Patient age in years at queue entry date |
| `patientGender` | Categorical | `Patient.gender` | Patient gender categorical encoding |
| `rejoinCount` | Discrete | `QueueEntry.rejoinCount` | Number of times patient skipped and rejoined |

### 8.2 Target Variables
1. `actualDurationMinutes` (Regression Target):  
   $$\text{Duration} = \frac{\text{completedAt} - \text{consultationStartedAt}}{60,000}$$
2. `isNoShow` (Classification Target):  
   $$\text{NoShow} = \begin{cases} 1 & \text{if } \text{Appointment.status} = \text{'NO_SHOW'} \\ 0 & \text{if } \text{Appointment.status} = \text{'COMPLETED'} \end{cases}$$

---

## 9. MODEL SELECTION & STRATEGY

To maintain high interpretability, instant inference (< 5ms), zero heavy external native binary dependencies, and seamless Node.js integration, QFlow evaluates lightweight tabular models:

### 9.1 Model Candidates Evaluation

| Model Architecture | Advantages | Disadvantages | Suitability for QFlow |
|---|---|---|---|
| **Simple Rolling Mean (Baseline)** | Zero training cost, deterministic, instant computation | Cannot adjust for non-linear time-of-day or patient features | Primary Fallback Baseline |
| **Multivariate Ridge / Lasso Regression** | Highly interpretable, closed-form matrix math, zero latency, lightweight JS implementation | Limited non-linear interaction modeling | **Recommended Primary Regression Model** |
| **Gradient Boosted Trees (LightGBM/XGBoost via ONNX)** | High accuracy on tabular data, captures complex feature interactions | Requires ONNX runtime dependency or tree JSON parser | Secondary / Advanced Option |
| **Deep Neural Networks (PyTorch/TensorFlow)** | Can learn complex embeddings | Heavy runtime footprint, black-box, high latency, overkill | **Rejected (Out of Scope)** |

### 9.2 Recommended Model Stack
1. **Primary Duration Predictor**: Weighted Regularized Linear Regression (Ridge Regression) with polynomial interaction terms (Doctor ID $\times$ Hour of Day), trained per doctor/clinic.
2. **Primary Fallback Predictor**: Exponentially Weighted Moving Average (EWMA) of doctor's last 10 completed consultations.

---

## 10. NO-SHOW FEASIBILITY ANALYSIS

### 10.1 Feasibility Assessment
- **Available Historical Signals**: Patient appointment history (past completed vs. no-show counts), lead time ($\text{appointmentDate} - \text{bookedAt}$), scheduled time of day, day of week.
- **Data Limitations**: For new patients with no prior history, lead time and slot time are the only predictors.
- **Verdict**: Feasible as an **advisory risk score** (Low / Medium / High) for reception staff.

### 10.2 Ethical & Operational Guardrails
- **CRITICAL**: No-show predictions MUST NEVER automatically cancel appointments, demote queue position, or restrict patient booking.
- Risk scores are visible **ONLY** to clinic staff to trigger optional phone/SMS confirmation outreach.

---

## 11. OPERATIONAL FORECASTING

Phase 12 designs an hourly operational forecasting engine for clinic staff:
- **Hourly Arrival Volume Forecast**: Aggregates historical appointment slot distributions and walk-in registration trends to predict patient arrivals per 1-hour window.
- **Doctor Utilization Forecast**: Computes expected consultation hours vs. available shift duration:
  $$\text{Utilization} = \frac{\sum_{i=1}^{N} \hat{D}_i}{\text{Shift Duration (Minutes)}} \times 100\%$$
- Helps clinic staff identify potential queue overbooking before shift commencement.

---

## 12. ANOMALY DETECTION

The operational anomaly detection module continuously monitors active queue metrics against historical thresholds:

### 12.1 Anomaly Types & Triggers

| Anomaly Type | Detection Logic | Threshold / Condition | System Action |
|---|---|---|---|
| **Queue Stall (Bottleneck)** | No patient called for extended duration while `WAITING` list > 0 | Active consultation duration $> 2.5 \times \text{Doctor.avgConsultationTimeMin}$ | Staff UI alert: "Consultation taking longer than expected" |
| **Sudden Surge** | Rapid influx of walk-in check-ins | Walk-in rate $> 3 \times$ historical hourly average | Staff UI alert: "High walk-in surge detected" |
| **Abnormal No-Show Spike** | Multiple consecutive no-shows | $\ge 3$ consecutive `NO_SHOW` entries in current session | Staff UI alert: "Multiple no-shows detected; check schedule" |
| **Doctor Idle Overflow** | Doctor available but queue processing stalled | Doctor `AVAILABLE`, queue `WAITING` $> 0$, no call for $> 15$ mins | Staff UI alert: "Queue waiting while doctor available" |

---

## 13. AI ARCHITECTURE & SYSTEM DESIGN

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            QFLOW BACKEND NODE.JS                            │
│                                                                             │
│  ┌──────────────────────┐      ┌───────────────────┐      ┌──────────────┐  │
│  │   MongoDB Atlas      │      │ Feature Extractor │      │ ML Engine    │  │
│  │  (QueueEntry, Appt,  │ ───► │ (Data Pipeline &  │ ───► │ (Inference & │  │
│  │   Doctor, Patient)   │      │  Normalization)   │      │  Evaluation) │  │
│  └──────────────────────┘      └───────────────────┘      └──────────────┘  │
│                                                                   │         │
│                                                                   ▼         │
│                                                           ┌──────────────┐  │
│                                                           │ Prediction   │  │
│                                                           │ Guardrails & │  │
│                                                           │ Fallback     │  │
│                                                           └──────────────┘  │
│                                                                   │         │
│                                                                   ▼         │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                        REST API CONTROLLERS                            │ │
│  │ (GET /api/patient/queue/prediction, GET /api/staff/analytics/predict)  │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            FRONTEND REACT UI                                │
│  ┌───────────────────────────┐ ┌───────────────────┐ ┌───────────────────┐ │
│  │ Patient Live Queue        │ │ Staff Dashboard   │ │ Doctor Dashboard  │ │
│  │ (Predicted Wait + AI Label│ │ (Congestion Alerts│ │ (Workload Forecast│ │
│  │  + Confidence Badge)      │ │  + No-Show Score) │ │  + Avg Speed)     │ │
│  └───────────────────────────┘ └───────────────────┘ └───────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 13.1 Processing Model
- **Inference Mode**: Synchronous, in-memory prediction during request lifecycle (< 5ms response time budget).
- **Model Training**: Periodic background scheduled job (e.g., daily at midnight or on-demand via Admin API) compiling historical `QueueEntry` records into JSON model coefficient artifacts stored in MongoDB or local model cache.

---

## 14. MODEL VERSIONING & METADATA

Model coefficient artifacts are schema-structured and version-tracked:

```json
{
  "modelId": "duration_regressor_doc_65a1b2c3",
  "version": "1.2.0",
  "trainedAt": "2026-08-14T00:00:00.000Z",
  "sampleCount": 450,
  "metrics": {
    "maeMinutes": 2.4,
    "rmseMinutes": 3.1,
    "r2Score": 0.78
  },
  "coefficients": {
    "intercept": 8.5,
    "hourOfDay": 0.35,
    "queueDepth": 0.42,
    "source_ONLINE": -1.2,
    "priority_URGENT": -3.0
  },
  "status": "ACTIVE"
}
```

If `sampleCount < 30` or `r2Score < 0.20`, model status is marked `DEGRADED` and prediction automatically falls back to deterministic calculations.

---

## 15. PREDICTION SAFETY & FALLBACK PROTOCOL

```
┌─────────────────────────────────────────────────────────────────┐
│                    Prediction Request Received                  │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
              Is Model Artifact Active & Valid?
             /                                 \
           YES                                  NO
           /                                     \
          ▼                                       ▼
Feature Extraction Successful?              Fallback to Phase 09
         /           \                      Deterministic Calculation
       YES            NO                    (confidence: "BASELINE")
       /               \                          │
      ▼                 ▼                         │
Inference Yields      Fallback to                 │
Valid Bound Range?   Deterministic                │
 (1 to 120 mins)                                  │
   /         \                                    │
 YES          NO ─────────────────────────────────┤
 /                                                │
▼                                                 ▼
Return AI Prediction                       Return Deterministic Output
(confidence: "HIGH" / "MEDIUM")            (confidence: "BASELINE")
```

---

## 16. API CONTRACTS & REST SPECIFICATIONS

### 16.1 GET `/api/patient/queue/prediction`
- **Authentication**: Required (`PATIENT` role)
- **Query Parameters**: None (resolves active `WAITING` / `CALLED` queue entry for logged-in patient)
- **Success Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "queueEntryId": "65a1b2c3d4e5f67890123456",
    "tokenNumber": 5,
    "status": "WAITING",
    "peopleAhead": 3,
    "deterministicWaitMin": 45,
    "predictedWaitMin": 38,
    "predictedCallTime": "2026-08-14T11:18:00.000Z",
    "confidenceLevel": "HIGH",
    "predictionSource": "AI_MODEL",
    "modelVersion": "1.2.0",
    "isFallback": false
  }
}
```

### 16.2 GET `/api/staff/analytics/predictions`
- **Authentication**: Required (`STAFF` or `ADMIN` role)
- **Query Parameters**: `clinicId` (optional for Admin, mandatory for Staff verification)
- **Success Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "clinicId": "65a1b2c3d4e5f67890123456",
    "date": "2026-08-14",
    "congestionLevel": "MODERATE",
    "predictedTotalArrivals": 42,
    "predictedPeakHour": "10:00 - 11:00",
    "activeAnomalies": [
      {
        "type": "LONG_CONSULTATION",
        "doctorId": "65a1b2c3d4e5f67890123457",
        "doctorName": "Dr. Sarah Smith",
        "message": "Current consultation duration (28m) exceeds threshold (25m)",
        "severity": "WARNING",
        "detectedAt": "2026-08-14T10:40:00.000Z"
      }
    ]
  }
}
```

### 16.3 GET `/api/doctor/analytics/predictions`
- **Authentication**: Required (`DOCTOR` role)
- **Success Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "doctorId": "65a1b2c3d4e5f67890123457",
    "date": "2026-08-14",
    "todayCompletedCount": 8,
    "todayAvgDurationMin": 14.2,
    "configuredAvgDurationMin": 15.0,
    "predictedRemainingSessionHours": 2.1,
    "estimatedFinishTime": "2026-08-14T13:15:00.000Z"
  }
}
```

---

## 17. AUTHORIZATION & IDOR PROTECTION MATRIX

| Endpoint | Guest | Patient | Doctor | Staff | Admin | IDOR & Scope Enforcement Rule |
|---|---|---|---|---|---|---|
| `GET /api/patient/queue/prediction` | 401 | 200 | 403 | 403 | 403 | Strictly scopes to active patient's own `QueueEntry` |
| `GET /api/staff/analytics/predictions` | 401 | 403 | 403 | 200 | 200 | Staff restricted to own `staffClinicId`; Admin has global access |
| `GET /api/doctor/analytics/predictions` | 401 | 403 | 200 | 403 | 200 | Doctor restricted strictly to own `req.user._id` profile |
| `POST /api/admin/analytics/ml/train` | 401 | 403 | 403 | 403 | 200 | Restricted strictly to `ADMIN` role for manual retraining trigger |

---

## 18. PRIVACY BOUNDARY

- **Patient Anonymization**: Feature extraction pipelines replace patient names, phone numbers, and email addresses with hashed identifiers or age/gender demographics.
- **Public Feed Privacy**: Public display endpoints (`/api/public/queue/display`) NEVER return ML individual risk scores, no-show probabilities, or patient demographics.
- **Zero Third-Party Data Transmission**: All feature extraction, training, and inference occur strictly inside the server environment. No data is transmitted to third-party AI APIs.

---

## 19. FRONTEND ARCHITECTURE & UI INTEGRATION

### 19.1 Patient Live Queue UI Component
- Displays predicted wait time alongside a visual confidence pill badge:
  - `<Badge variant="success">AI Estimated: ~38 mins (High Confidence)</Badge>`
  - `<Badge variant="secondary">Estimated: ~45 mins (Standard Calculation)</Badge>`
- Tooltip explicitly clarifies: *"Wait predictions use historical consultation patterns and live queue position. Official queue ordering remains fixed."*

### 19.2 Staff Reception Dashboard
- Visual Congestion Bar: Predicts upcoming hourly queue pressure (Green / Yellow / Red).
- Anomaly Toast Banner: Non-intrusive alert when a queue stall or sudden walk-in surge occurs.
- No-Show Risk Indicator: Subtle warning icon next to high-risk upcoming online appointments.

---

## 20. PERFORMANCE & COMPUTATIONAL STRATEGY

- **Inference Budget**: $< 5\text{ms}$ per prediction call.
- **Database Query Limits**: Prediction endpoints fetch only active queue entries for the specific doctor (`status = 'WAITING'`), avoiding full database scans.
- **Caching**: Trained model coefficients are cached in-memory upon server start and refreshed periodically.
- **Memory Overhead**: Linear regression coefficient matrix requires $< 50\text{ KB}$ of RAM footprint.

---

## 21. EVALUATION METRICS & ACCEPTANCE CRITERIA

| Task Type | Target Metric | Minimum Acceptable Threshold | Target Benchmark |
|---|---|---|---|
| Duration Regression | Mean Absolute Error (MAE) | $\le 4.0\text{ minutes}$ | $\le 2.5\text{ minutes}$ |
| Duration Regression | $R^2$ Score | $\ge 0.30$ | $\ge 0.65$ |
| No-Show Classification | ROC-AUC Score | $\ge 0.65$ | $\ge 0.78$ |
| Anomaly Detection | False Positive Rate | $\le 10\%$ | $\le 5\%$ |
| Latency | 99th Percentile Inference | $\le 10\text{ ms}$ | $\le 3\text{ ms}$ |

---

## 22. TESTING STRATEGY

Comprehensive test suite (`validatePhase12.js`) will verify:
1. **Unit Tests**: Feature engineering calculations, matrix transformations, regression inference math.
2. **Fallback Tests**: Verify automatic fallback to Phase 09 calculation when model artifacts are deleted, corrupted, or degraded.
3. **Determinism Tests**: Verify Phase 08 HYBRID queue ordering is 100% unchanged before and after ML model invocation.
4. **Security & IDOR Tests**: Verify cross-patient, cross-doctor, and cross-clinic access attempts yield HTTP 403 Forbidden.
5. **Phase 03–11 Regression Protections**: Re-run 100% of Phase 03 through Phase 11 test suites.

---

## 23. SECURITY CONSIDERATIONS

- **Adversarial Input Protection**: Input parameters (`queueEntryId`, `clinicId`) strictly validated using Mongoose ObjectId type checks and Joi schema filters.
- **No Automatic Mutative Actions**: ML inference outputs are strictly read-only advisory metrics. Model output cannot directly trigger status mutations or financial transactions.

---

## 24. PHASE 03–11 COMPATIBILITY GUARANTEE

Phase 12 is built as a non-breaking additive layer. It does **NOT**:
- Alter Mongoose schema indexes for `QueueEntry`, `Appointment`, or `Doctor`.
- Modify the state machine logic in `appointmentController.js` or `receptionController.js`.
- Break Phase 10 public token display contracts or Phase 11 invoice generation.

---

## 25. PHASE 13+ BOUNDARY (FUTURE EXTENSIONS)

The following capabilities are explicitly out of scope for Phase 12 and reserved for Phase 13+:
- Automated multi-clinic resource load balancing across different geographical facilities.
- Real-time WebSockets push notification layer for live ML prediction streams.
- Deep learning neural networks or computer vision patient flow counting.
- External EHR (Electronic Health Records) integrations.

---

## 26. IMPLEMENTATION PLAN SUMMARY

```
Step 1: Create Feature Extraction Utility (src/server/utils/mlFeatureExtractor.js)
Step 2: Create Model Engine & Trainer Utility (src/server/utils/mlModelEngine.js)
Step 3: Create AI Intelligence Controller (src/server/controllers/aiController.js)
Step 4: Define REST Routes (src/server/routes/aiRoutes.js)
Step 5: Mount Routes in Express Server (src/server/server.js)
Step 6: Integrate Frontend Services & UI Badges (src/client/src/services/api.js & UI)
Step 7: Implement & Execute Validation Suite (src/server/utils/validatePhase12.js)
```

---

## 27. ACCEPTANCE CRITERIA

1. Phase 12 design specification completely documented without source code modifications.
2. Prediction fallback to Phase 09 deterministic calculation is 100% guaranteed.
3. Zero medical diagnosis or clinical decision-making capabilities included.
4. All Phase 03–11 automated regression suites remain passing.

---

## 28. OPEN QUESTIONS

- *Question 1*: Should model retraining occur automatically every 24 hours or remain on-demand via Admin API?  
  *Recommendation*: Default to daily scheduled retraining at 00:00 IST with manual Admin trigger endpoint.
- *Question 2*: Should low-confidence predictions display the baseline estimate with an info badge or hide the AI badge entirely?  
  *Recommendation*: Display standard Phase 09 estimate with a subtle "Estimated (Standard)" label for user transparency.

---

## 29. FINAL RECOMMENDATION

### READY FOR IMPLEMENTATION

The Phase 12 AI/ML Intelligence Layer Design Specification is complete, robust, non-breaking, and fully aligned with QFlow architectural standards. Implementation can proceed cleanly upon explicit user approval.
