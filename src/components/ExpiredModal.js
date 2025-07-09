// src/components/ExpiredModal.js
import React from 'react';

export default function ExpiredModal({ resetModals }) {
  return (
    <div className="modal-backdrop">
      <div className="modal-glassmorphic">
        <button onClick={resetModals} className="modal-close-button" aria-label="Close modal">×</button>
        <div className="modal-header expired">
            <h3>⚠️ Invoice Expired</h3>
        </div>
        <div className="modal-receipt-content">
            <p style={{ textAlign: 'center', margin: '2rem 0' }}>
                The payment time limit has passed. Please create a new invoice to complete your top-up.
            </p>
            <button className="modal-action-button primary" onClick={resetModals}>
                Create New Invoice
            </button>
        </div>
      </div>
    </div>
  );
}