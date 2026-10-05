/**
 * Stripe Dispute Evidence Manager — Dashboard Logic
 * Handles list rendering, PDF downloads, and safe 1-click Stripe submission.
 */

const API_BASE_URL = window.location.origin;

/* ------------------------------------------------------------------ */
/*  Formatting helpers                                                 */
/* ------------------------------------------------------------------ */

function getStatusClass(status) {
  const map = {
    needs_response: 'warning',
    warning_needs_response: 'warning',
    under_review: 'success',
    warning_under_review: 'success',
    won: 'success',
    lost: 'danger',
    charge_refunded: 'success'
  };
  return map[status] || 'warning';
}

function formatAmount(cents, currency) {
  return `$${(cents / 100).toFixed(2)} ${(currency || 'usd').toUpperCase()}`;
}

function formatLabel(str) {
  return (str || 'unknown').replace(/_/g, ' ');
}

/* ------------------------------------------------------------------ */
/*  PDF Download                                                       */
/* ------------------------------------------------------------------ */

function downloadEvidencePDF(disputeId) {
  if (!disputeId || !disputeId.trim()) {
    alert('Please enter a valid Stripe Dispute ID.');
    return;
  }
  const cleanId = disputeId.trim();
  const url = `${API_BASE_URL}/api/dispute/${encodeURIComponent(cleanId)}/pdf`;

  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `Evidence_Pack_${cleanId}.pdf`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/* ------------------------------------------------------------------ */
/*  Confirmation Modal State                                           */
/* ------------------------------------------------------------------ */

let pendingDisputeId = null; // dispute currently being confirmed
let pendingButtonEl  = null; // originating button for state updates

function openConfirmModal(disputeId, buttonEl) {
  pendingDisputeId = disputeId;
  pendingButtonEl  = buttonEl;

  const modal = document.getElementById('confirmModal');
  const idEl  = document.getElementById('modalDisputeId');
  if (idEl) idEl.textContent = disputeId;
  if (modal) modal.classList.remove('hidden');
}

function closeConfirmModal() {
  const modal = document.getElementById('confirmModal');
  if (modal) modal.classList.add('hidden');
  pendingDisputeId = null;
  pendingButtonEl  = null;
}

/* ------------------------------------------------------------------ */
/*  Core Submission (called only after user confirms)                 */
/* ------------------------------------------------------------------ */

async function executeSubmission(disputeId, buttonEl, finalize) {
  if (!buttonEl) return;
  if (buttonEl.disabled) return;

  const originalText = buttonEl.dataset.originalText || buttonEl.textContent;

  // ---- PENDING state ----
  buttonEl.disabled = true;
  buttonEl.classList.remove('submitted', 'error', 'draft');
  buttonEl.classList.add('loading');
  buttonEl.textContent = finalize ? 'Submitting...' : 'Saving draft...';

  try {
    const response = await fetch(
      `${API_BASE_URL}/api/dispute/${encodeURIComponent(disputeId)}/submit`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ finalize })
      }
    );

    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Submission failed');
    }

    // ---- SUCCESS state ----
    buttonEl.classList.remove('loading');

    if (finalize) {
      // Finalized: locked in, stays disabled
      buttonEl.classList.add('submitted'); // green
      buttonEl.textContent = 'Submitted ✓';
    } else {
      // Draft saved: allow finalize later
      buttonEl.classList.add('draft'); // amber
      buttonEl.textContent = 'Draft Saved';
      buttonEl.disabled = false;
      setTimeout(() => {
        if (!buttonEl.classList.contains('draft')) return;
        buttonEl.classList.remove('draft');
        buttonEl.textContent = originalText;
      }, 4000);
    }
  } catch (error) {
    console.error('[Submit Error]', error);

    // ---- ERROR state ----
    buttonEl.classList.remove('loading');
    buttonEl.classList.add('error');
    buttonEl.textContent = 'Failed (Retry)';
    buttonEl.disabled = false;

    setTimeout(() => {
      if (!buttonEl.classList.contains('error')) return;
      buttonEl.classList.remove('error');
      buttonEl.textContent = originalText;
    }, 3000);
  }
}

/* ------------------------------------------------------------------ */
/*  Table Rendering                                                    */
/* ------------------------------------------------------------------ */

function renderDisputesTable(disputes) {
  const tbody = document.getElementById('disputesTableBody');
  if (!tbody) return;

  if (!disputes || disputes.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty-state">No disputes found.</td></tr>`;
    return;
  }

  tbody.innerHTML = disputes
    .map((d) => `
      <tr>
        <td><code>${d.id}</code></td>
        <td>${formatAmount(d.amount, d.currency)}</td>
        <td>${formatLabel(d.reason)}</td>
        <td><span class="status-badge ${getStatusClass(d.status)}">${formatLabel(d.status)}</span></td>
        <td class="actions-cell">
          <button class="btn-download" data-action="download" data-dispute-id="${d.id}">
            Download PDF
          </button>
          <button
            class="btn-submit"
            data-action="submit"
            data-dispute-id="${d.id}"
            data-original-text="Submit to Stripe"
          >
            Submit to Stripe
          </button>
        </td>
      </tr>
    `)
    .join('');
}

/* ------------------------------------------------------------------ */
/*  Load Disputes                                                      */
/* ------------------------------------------------------------------ */

async function loadDisputes() {
  const tbody = document.getElementById('disputesTableBody');
  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="5" class="loading-row">Loading disputes…</td></tr>`;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/dispute/list`);
    const result = await response.json();
    if (!response.ok || !result.success) throw new Error(result.error || 'Load failed');
    renderDisputesTable(result.data);
  } catch (error) {
    console.error('[List Load Error]', error);
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="5" class="error-row">Failed to load disputes. Showing demo row.</td></tr>`;
    }
    renderDisputesTable([
      { id: 'dp_12345', amount: 15000, currency: 'usd', reason: 'fraudulent', status: 'needs_response' }
    ]);
  }
}

/* ------------------------------------------------------------------ */
/*  DOM Ready                                                          */
/* ------------------------------------------------------------------ */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Main "Generate PDF" button
  const generateBtn = document.getElementById('generatePdfBtn');
  const disputeInput = document.getElementById('disputeIdInput');

  if (generateBtn && disputeInput) {
    generateBtn.addEventListener('click', () => downloadEvidencePDF(disputeInput.value));
    disputeInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        downloadEvidencePDF(disputeInput.value);
      }
    });
  }

  // 2. Table action delegation — submit opens modal, does NOT submit directly
  const tbody = document.getElementById('disputesTableBody');
  if (tbody) {
    tbody.addEventListener('click', (event) => {
      const btn = event.target.closest('button[data-action]');
      if (!btn) return;

      const disputeId = btn.getAttribute('data-dispute-id');
      const action = btn.getAttribute('data-action');

      if (action === 'download') {
        downloadEvidencePDF(disputeId);
      } else if (action === 'submit') {
        openConfirmModal(disputeId, btn); // <-- safety layer
      }
    });
  }

  // 3. Modal action wiring
  const cancelBtn   = document.getElementById('modalCancelBtn');
  const draftBtn    = document.getElementById('modalDraftBtn');
  const finalizeBtn = document.getElementById('modalFinalizeBtn');

  if (cancelBtn) cancelBtn.addEventListener('click', closeConfirmModal);

  if (draftBtn) {
    draftBtn.addEventListener('click', async () => {
      const id  = pendingDisputeId;
      const btn = pendingButtonEl;
      closeConfirmModal();
      if (id && btn) await executeSubmission(id, btn, false); // draft
    });
  }

  if (finalizeBtn) {
    finalizeBtn.addEventListener('click', async () => {
      const id  = pendingDisputeId;
      const btn = pendingButtonEl;
      closeConfirmModal();
      if (id && btn) await executeSubmission(id, btn, true); // finalize
    });
  }

  // 4. Close modal on ESC key or backdrop click
  const modal = document.getElementById('confirmModal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeConfirmModal();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
        closeConfirmModal();
      }
    });
  }

  // 5. Load disputes on page load
  loadDisputes();
});