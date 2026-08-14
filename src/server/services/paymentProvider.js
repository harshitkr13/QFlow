import crypto from 'crypto';

/**
 * Provider-Agnostic Payment Service Interface (Mock / Simulation Provider)
 * Handles external payment interaction outside MongoDB transactions.
 */
class MockPaymentProvider {
  /**
   * Create payment attempt with external provider.
   */
  async createPayment({ invoiceId, amount, currency = 'INR', idempotencyKey, simulateFailure = false }) {
    if (simulateFailure) {
      return {
        success: false,
        provider: 'MOCK',
        providerTransactionId: null,
        error: 'Simulated payment gateway initiation failure',
      };
    }

    const providerTransactionId = `TXN_MOCK_${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
    return {
      success: true,
      provider: 'MOCK',
      providerTransactionId,
      amount,
      currency,
      status: 'INITIATED',
    };
  }

  /**
   * Verify payment status with external provider.
   */
  async verifyPayment({ providerTransactionId, simulateFailure = false }) {
    if (simulateFailure || !providerTransactionId) {
      return {
        verified: false,
        provider: 'MOCK',
        providerTransactionId,
        status: 'FAILED',
        error: 'Payment verification failed at provider gateway',
      };
    }

    return {
      verified: true,
      provider: 'MOCK',
      providerTransactionId,
      status: 'SUCCESS',
    };
  }

  /**
   * Process refund with external provider.
   */
  async refundPayment({ providerTransactionId, amount, simulateFailure = false }) {
    if (simulateFailure) {
      return {
        success: false,
        provider: 'MOCK',
        providerTransactionId,
        error: 'Simulated refund processing failure at provider gateway',
      };
    }

    const refundReference = `REF_MOCK_${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
    return {
      success: true,
      provider: 'MOCK',
      providerTransactionId,
      refundReference,
      amount,
      status: 'REFUNDED',
    };
  }
}

export const paymentProvider = new MockPaymentProvider();
export default paymentProvider;
