const express = require('express');
const router = express.Router();

const {
  getDisputeData,
  listDisputes,
  submitDisputeEvidence
} = require('../services/stripeService');
const { buildEvidencePDF } = require('../services/pdfGenerator');

/* ------------------------------------------------------------------ */
/*  GET /api/dispute/list — MUST be before /:disputeId                 */
/* ------------------------------------------------------------------ */
router.get('/list', async (req, res) => {
  try {
    const disputes = await listDisputes(10);
    res.json({ success: true, count: disputes.length, data: disputes });
  } catch (error) {
    console.error(`[Dispute List Error] ${error.message}`);
    res.status(500).json({ success: false, error: 'Failed to fetch dispute list.' });
  }
});

/* ------------------------------------------------------------------ */
/*  POST /api/dispute/:disputeId/submit — Submit evidence              */
/*                                                                     */
/*  Body: { finalize: true | false }                                   */
/*                                                                     */
/*  Safety contract:                                                   */
/*    - finalize = false (default) → saves evidence as DRAFT on Stripe */
/*    - finalize = true            → submits to bank (IRREVERSIBLE)    */
/* ------------------------------------------------------------------ */
router.post('/:disputeId/submit', async (req, res) => {
  try {
    const { finalize = false } = req.body || {};
    const result = await submitDisputeEvidence(
      req.params.disputeId,
      finalize === true
    );
    res.json(result);
  } catch (error) {
    console.error(`[Submit Error] ${req.params.disputeId}: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

/* ------------------------------------------------------------------ */
/*  GET /api/dispute/:disputeId — JSON metadata                        */
/* ------------------------------------------------------------------ */
router.get('/:disputeId', async (req, res) => {
  try {
    const data = await getDisputeData(req.params.disputeId);
    res.json({ success: true, data });
  } catch (error) {
    console.error(`[Dispute JSON Error] ${req.params.disputeId}: ${error.message}`);
    res.status(500).json({ success: false, error: 'Failed to fetch dispute data.' });
  }
});

/* ------------------------------------------------------------------ */
/*  GET /api/dispute/:disputeId/pdf — streamed evidence PDF            */
/* ------------------------------------------------------------------ */
router.get('/:disputeId/pdf', async (req, res) => {
  try {
    const data = await getDisputeData(req.params.disputeId);
    buildEvidencePDF(data, res);
  } catch (error) {
    console.error(`[PDF Error] ${req.params.disputeId}: ${error.message}`);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: 'Failed to generate PDF.' });
    }
  }
});

module.exports = router;