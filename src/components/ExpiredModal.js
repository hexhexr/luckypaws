// src/components/ExpiredModal.js
import React from 'react';

export default function ExpiredModal({ resetModals }) {
  return (
    <div className="modal-backdrop" onClick={resetModals}>
      <div className="modal-glassmorphic" onClick={(e) => e.stopPropagation()}>
        <button onClick={resetModals} className="modal-close-button" aria-label="Close modal">×</button>
        <div className="modal-header expired">
            <h3>⚠️ Invoice Expired</h3>
        </div>
        <div className="modal-receipt-content">
            <p style={{ textAlign: 'center', margin: '1rem 0', color: 'rgba(255, 255, 255, 0.8)' }}>
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