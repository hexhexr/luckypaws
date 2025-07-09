// src/components/ExpiredModal.js
import React from 'react';

export default function ExpiredModal({ resetModals }) {
  return (
    <div className="modal-backdrop-v4" onClick={resetModals}>
      <div className="modal-glassmorphic-v4 receipt" onClick={(e) => e.stopPropagation()}>
        <button onClick={resetModals} className="modal-close-button-v4">×</button>
        <div className="modal-header-v4 expired">
            <h3>⚠️ Invoice Expired</h3>
        </div>
        <div className="modal-receipt-content-v4">
            <p style={{ textAlign: 'center', margin: '1rem 0', color: 'rgba(255, 255, 255, 0.9)' }}>
                Please create a new invoice to complete your payment.
            </p>
            <button className="modal-action-button-v4 primary" onClick={resetModals}>
                Create New Invoice
            </button>
        </div>
      </div>
    </div>
  );
}