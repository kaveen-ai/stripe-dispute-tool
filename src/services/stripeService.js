const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function hasStripeKey() {
  return !!(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY.startsWith('sk_'));
}

function isMockId(disputeId) {
  return disputeId === 'dp_12345' || !hasStripeKey();
}

/* ------------------------------------------------------------------ */
/*  MOCK DATA (used when Stripe is unavailable)                        */
/* ------------------------------------------------------------------ */

function getMockDisputeData(disputeId) {
  return {
    disputeId: disputeId || 'dp_12345',
    amount: 150.00,
    currency: 'USD',
    reason: 'fraudulent',
    status: 'needs_response',
    created: new Date().toUTCString(),
    customerEmail: 'mock.customer@example.com',
    customerName: 'John Mock Doe',
    customerIP: '192.168.1.100',
    chargeId: 'ch_mock_12345',
    paymentMethod: 'card'
  };
}

function getMockDisputeList() {
  return [
    { id: 'dp_12345', amount: 15000, currency: 'usd', reason: 'fraudulent',            status: 'needs_response' },
    { id: 'dp_67890', amount: 7550,  currency: 'usd', reason: 'product_not_received',  status: 'under_review'   },
    { id: 'dp_11223', amount: 4500,  currency: 'usd', reason: 'duplicate',             status: 'lost'           },
    { id: 'dp_44556', amount: 9900,  currency: 'usd', reason: 'subscription_canceled', status: 'warning_needs_response' }
  ];
}

/* ------------------------------------------------------------------ */
/*  PUBLIC: Fetch single dispute metadata                              */
/* ------------------------------------------------------------------ */

async function getDisputeData(disputeId) {
  if (isMockId(disputeId)) {
    console.log(`[Mock Data] Dispute: ${disputeId}`);
    return getMockDisputeData(disputeId);
  }

  try {
    const dispute = await stripe.disputes.retrieve(disputeId);

    let charge = null;
    if (dispute.charge) {
      const chargeId = typeof dispute.charge === 'string' ? dispute.charge : dispute.charge.id;
      charge = await stripe.charges.retrieve(chargeId);
    }

    return {
      disputeId: dispute.id,
      amount: dispute.amount / 100,
      currency: dispute.currency.toUpperCase(),
      reason: dispute.reason,
      status: dispute.status,
      created: new Date(dispute.created * 1000).toUTCString(),
      customerEmail: charge?.billing_details?.email || charge?.receipt_email || 'N/A',
      customerName: charge?.billing_details?.name || 'N/A',
      customerIP: charge?.metadata?.customer_ip || charge?.outcome?.network_status || 'N/A',
      chargeId: charge?.id || 'N/A',
      paymentMethod: charge?.payment_method_details?.type || 'N/A'
    };
  } catch (error) {
    console.warn(`[Stripe Error] getDisputeData(${disputeId}): ${error.message}. Using mock.`);
    return getMockDisputeData(disputeId);
  }
}

/* ------------------------------------------------------------------ */
/*  PUBLIC: List recent disputes                                       */
/* ------------------------------------------------------------------ */

async function listDisputes(limit = 10) {
  if (!hasStripeKey()) {
    console.log('[Mock Data] No Stripe key — returning mock list.');
    return getMockDisputeList();
  }

  try {
    const result = await stripe.disputes.list({ limit });
    return result.data.map((d) => ({
      id: d.id,
      amount: d.amount,
      currency: d.currency,
      reason: d.reason,
      status: d.status
    }));
  } catch (error) {
    console.warn(`[Stripe Error] listDisputes: ${error.message}. Using mock.`);
    return getMockDisputeList();
  }
}

/* ------------------------------------------------------------------ */
/*  PUBLIC: Submit evidence to Stripe (with draft/finalize safety)     */
/* ------------------------------------------------------------------ */

/**
 * Submits evidence for a dispute.
 *
 * Safety contract:
 *   - finalize = false (default) → saves evidence as a DRAFT on Stripe.
 *     The dispute stays in `needs_response` and can be edited/cancelled.
 *   - finalize = true → sends evidence to the bank. This is IRREVERSIBLE.
 *
 * @param {string}  disputeId - Stripe Dispute ID (e.g., "dp_...")
 * @param {boolean} finalize  - Whether to submit to the bank (default: false)
 * @returns {Promise<Object>} Result payload for the frontend
 */
async function submitDisputeEvidence(disputeId, finalize = false) {
  const isFinalize = finalize === true;

  // ---------- MOCK PATH: simulate a 1-second network delay ----------
  if (isMockId(disputeId)) {
    console.log(`[Mock Submit] Simulating ${isFinalize ? 'FINALIZE' : 'DRAFT SAVE'} for ${disputeId}...`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return {
      success: true,
      mock: true,
      disputeId,
      finalized: isFinalize,
      status: isFinalize ? 'under_review' : 'needs_response',
      message: isFinalize
        ? 'Evidence finalized and submitted to the bank (mock mode).'
        : 'Evidence saved as draft (mock mode).'
    };
  }

  // ---------- REAL STRIPE PATH ----------
  try {
    // Base evidence payload (shared by both draft and finalize)
    const payload = {
      evidence: {
        uncategorized_text:
          'Standard Dispute Evidence Pack attached. ' +
          'The customer agreed to the Terms of Service and Refund Policy at checkout. ' +
          'The product/service was delivered as described, and no valid refund request ' +
          'was received prior to the chargeback. Submitted in good faith per Visa / ' +
          'Mastercard dispute resolution guidelines.'
      }
    };

    // Only pass `submit: true` when explicitly finalizing.
    // Omitting it (or passing false) leaves the dispute in draft state.
    if (isFinalize) {
      payload.submit = true;
    }

    const updated = await stripe.disputes.update(disputeId, payload);

    return {
      success: true,
      mock: false,
      disputeId,
      finalized: isFinalize,
      status: updated.status,
      message: isFinalize
        ? 'Evidence submitted to the bank successfully.'
        : 'Evidence saved as draft on Stripe.'
    };
  } catch (error) {
    console.error(`[Stripe Submit Error] ${disputeId}: ${error.message}`);
    throw new Error(`Stripe rejected the submission: ${error.message}`);
  }
}

/* ------------------------------------------------------------------ */
/*  Exports                                                            */
/* ------------------------------------------------------------------ */

module.exports = {
  getDisputeData,
  listDisputes,
  submitDisputeEvidence
};