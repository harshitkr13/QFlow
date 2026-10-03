/**
 * ML Model Engine for QFlow Phase 12 Intelligence Layer.
 * Provides:
 * 1. Ridge Regression Predictor (L2 Regularized Linear Regression)
 * 2. EWMA Predictor (Exponentially Weighted Moving Average Baseline)
 * 3. No-Show Advisory Scorer
 * 4. Operational Anomaly Detector
 * 5. Congestion Forecaster
 *
 * STRICT RULE: All outputs are advisory predictions only and NEVER alter queue ordering or status transitions.
 */

// Matrix helper functions for Ridge Regression
function transpose(matrix) {
  const rows = matrix.length;
  const cols = matrix[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      result[c][r] = matrix[r][c];
    }
  }
  return result;
}

function multiplyMatrices(A, B) {
  const rowsA = A.length;
  const colsA = A[0].length;
  const rowsB = B.length;
  const colsB = B[0].length;
  if (colsA !== rowsB) throw new Error('Matrix multiplication dimension mismatch');

  const result = Array.from({ length: rowsA }, () => new Array(colsB).fill(0));
  for (let i = 0; i < rowsA; i++) {
    for (let j = 0; j < colsB; j++) {
      let sum = 0;
      for (let k = 0; k < colsA; k++) {
        sum += A[i][k] * B[k][j];
      }
      result[i][j] = sum;
    }
  }
  return result;
}

function multiplyMatrixVector(A, v) {
  return A.map(row => row.reduce((sum, val, idx) => sum + val * v[idx], 0));
}

function invertMatrix(M) {
  const n = M.length;
  const A = M.map(row => [...row]);
  const I = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))
  );

  for (let i = 0; i < n; i++) {
    let pivot = A[i][i];
    if (Math.abs(pivot) < 1e-10) {
      // Find pivot
      let swapRow = -1;
      for (let r = i + 1; r < n; r++) {
        if (Math.abs(A[r][i]) > 1e-10) {
          swapRow = r;
          break;
        }
      }
      if (swapRow === -1) return null; // Singular matrix
      [A[i], A[swapRow]] = [A[swapRow], A[i]];
      [I[i], I[swapRow]] = [I[swapRow], I[i]];
      pivot = A[i][i];
    }

    for (let j = 0; j < n; j++) {
      A[i][j] /= pivot;
      I[i][j] /= pivot;
    }

    for (let r = 0; r < n; r++) {
      if (r !== i) {
        const factor = A[r][i];
        for (let j = 0; j < n; j++) {
          A[r][j] -= factor * A[i][j];
          I[r][j] -= factor * I[i][j];
        }
      }
    }
  }
  return I;
}

/**
 * Ridge Regression Predictor
 */
export class RidgeRegression {
  constructor(lambda = 0.1) {
    this.lambda = lambda;
    this.weights = null;
    this.intercept = 0;
    this.isTrained = false;
  }

  fit(X, y) {
    if (!X || X.length === 0 || X.length !== y.length) {
      return false;
    }

    const n = X.length;
    const p = X[0].length;

    // Prepend bias term 1.0 to feature matrix
    const Xb = X.map(row => [1.0, ...row]);
    const pBias = p + 1;

    const Xt = transpose(Xb);
    const XtX = multiplyMatrices(Xt, Xb);

    // Add L2 penalty (do not penalize intercept at index 0)
    for (let i = 1; i < pBias; i++) {
      XtX[i][i] += this.lambda;
    }

    const invXtX = invertMatrix(XtX);
    if (!invXtX) {
      // Fallback: Gradient Descent if matrix inversion fails
      return this.fitGradientDescent(Xb, y);
    }

    const yCol = y.map(val => [val]);
    const Xty = multiplyMatrices(Xt, yCol);
    const wCol = multiplyMatrices(invXtX, Xty);

    const weightsWithBias = wCol.map(row => row[0]);
    this.intercept = weightsWithBias[0];
    this.weights = weightsWithBias.slice(1);
    this.isTrained = true;
    return true;
  }

  fitGradientDescent(Xb, y, lr = 0.01, epochs = 200) {
    const pBias = Xb[0].length;
    let w = new Array(pBias).fill(0);

    for (let epoch = 0; epoch < epochs; epoch++) {
      let grad = new Array(pBias).fill(0);
      for (let i = 0; i < Xb.length; i++) {
        const pred = Xb[i].reduce((sum, val, idx) => sum + val * w[idx], 0);
        const err = pred - y[i];
        for (let j = 0; j < pBias; j++) {
          grad[j] += err * Xb[i][j];
        }
      }
      for (let j = 0; j < pBias; j++) {
        const reg = j === 0 ? 0 : this.lambda * w[j];
        w[j] -= (lr / Xb.length) * (grad[j] + reg);
      }
    }

    this.intercept = w[0];
    this.weights = w.slice(1);
    this.isTrained = true;
    return true;
  }

  predict(x) {
    if (!this.isTrained || !this.weights || x.length !== this.weights.length) {
      return null;
    }
    const score = this.intercept + x.reduce((sum, val, idx) => sum + val * this.weights[idx], 0);
    return isNaN(score) ? null : score;
  }
}

/**
 * Exponentially Weighted Moving Average (EWMA) Predictor
 */
export function predictEWMA(recentDurations, alpha = 0.3, fallbackAvg = 15) {
  if (!recentDurations || recentDurations.length === 0) {
    return fallbackAvg;
  }

  let ewma = recentDurations[0];
  for (let i = 1; i < recentDurations.length; i++) {
    ewma = alpha * recentDurations[i] + (1 - alpha) * ewma;
  }

  return Math.round(ewma * 10) / 10;
}

/**
 * No-Show Advisory Scorer
 * Returns probability score (0.0 to 1.0) and advisory risk category.
 */
export function scoreNoShowRisk(noShowFeatures) {
  const { leadTimeHours = 0, pastNoShowRatio = 0, isWeekend = 0, hasPastNoShows = 0 } = noShowFeatures;

  // Logit linear combination
  const z = -1.8 + (3.2 * pastNoShowRatio) + (0.003 * leadTimeHours) + (0.4 * isWeekend) + (0.8 * hasPastNoShows);
  const score = 1 / (1 + Math.exp(-z));
  const roundedScore = Math.round(score * 100) / 100;

  let riskLevel = 'LOW';
  if (roundedScore >= 0.6) {
    riskLevel = 'HIGH';
  } else if (roundedScore >= 0.3) {
    riskLevel = 'MEDIUM';
  }

  return {
    noShowRiskScore: roundedScore,
    riskLevel,
    isAdvisoryOnly: true,
    disclaimer: 'Advisory risk score only. Does not alter booking or queue status.'
  };
}

/**
 * Operational Anomaly Detector
 */
export function detectOperationalAnomalies(queueData) {
  const anomalies = [];
  const {
    activeConsultationDurationMin = 0,
    docAvgDurationMin = 15,
    waitingCount = 0,
    consecutiveNoShows = 0,
    hourlyWalkInCount = 0,
    historicalHourlyWalkInAvg = 5,
    doctorStatus = 'AVAILABLE',
    lastCallTimeMs = null
  } = queueData;

  // 1. Long Consultation Anomaly (Active consultation taking > 2.5x average)
  if (activeConsultationDurationMin > docAvgDurationMin * 2.5 && docAvgDurationMin > 0) {
    anomalies.push({
      type: 'LONG_CONSULTATION',
      severity: activeConsultationDurationMin > docAvgDurationMin * 4.0 ? 'HIGH' : 'MEDIUM',
      message: `Active consultation duration (${activeConsultationDurationMin}m) significantly exceeds expected baseline (${docAvgDurationMin}m).`,
      detectedAt: new Date().toISOString()
    });
  }

  // 2. High Walk-In Surge Anomaly
  if (hourlyWalkInCount > historicalHourlyWalkInAvg * 3 && hourlyWalkInCount >= 10) {
    anomalies.push({
      type: 'WALK_IN_SURGE',
      severity: 'HIGH',
      message: `Sudden walk-in surge detected (${hourlyWalkInCount} check-ins in the last hour vs avg ${historicalHourlyWalkInAvg}).`,
      detectedAt: new Date().toISOString()
    });
  }

  // 3. Consecutive No-Shows Anomaly
  if (consecutiveNoShows >= 3) {
    anomalies.push({
      type: 'CONSECUTIVE_NO_SHOWS',
      severity: 'MEDIUM',
      message: `${consecutiveNoShows} consecutive appointments marked NO_SHOW today. Staff schedule review recommended.`,
      detectedAt: new Date().toISOString()
    });
  }

  // 4. Stalled Queue Anomaly (Doctor Available, Patients Waiting, but no call for > 15 mins)
  if (doctorStatus === 'AVAILABLE' && waitingCount > 0 && lastCallTimeMs) {
    const idleMins = (Date.now() - lastCallTimeMs) / (1000 * 60);
    if (idleMins > 15) {
      anomalies.push({
        type: 'STALLED_QUEUE',
        severity: 'HIGH',
        message: `Queue has been stalled for ${Math.round(idleMins)} minutes with ${waitingCount} patients waiting.`,
        detectedAt: new Date().toISOString()
      });
    }
  }

  return anomalies;
}

/**
 * Congestion Level Classifier
 */
export function classifyCongestion(waitingCount, activeCount, docAvgDurationMin = 15) {
  const totalInQueue = waitingCount + activeCount;
  const estimatedWorkloadMins = totalInQueue * docAvgDurationMin;

  if (totalInQueue === 0) {
    return { level: 'NONE', estimatedWorkloadMins: 0, description: 'Queue is clear.' };
  } else if (totalInQueue <= 3 && estimatedWorkloadMins <= 45) {
    return { level: 'LOW', estimatedWorkloadMins, description: 'Light queue traffic.' };
  } else if (totalInQueue <= 7 && estimatedWorkloadMins <= 120) {
    return { level: 'MODERATE', estimatedWorkloadMins, description: 'Normal operational congestion.' };
  } else if (totalInQueue <= 15 && estimatedWorkloadMins <= 240) {
    return { level: 'HIGH', estimatedWorkloadMins, description: 'High queue congestion. Expect delays.' };
  } else {
    return { level: 'CRITICAL', estimatedWorkloadMins, description: 'Critical queue overload. High delay risk.' };
  }
}
