// src/components/ExpiredModal.js
import React from 'react';

export default function ExpiredModal({ resetModals }) {
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) resetModals(); }}>
      <div className="modal">
        <button onClick={resetModals} className="modal-close-btn" aria-label="Close modal">&times;</button>
        <h2 className="modal-title text-danger">⚠️ Invoice Expired</h2>
        <p className="text-center">The invoice has expired. Please generate a new one.</p>
        <button className="btn btn-primary mt-md" onClick={() => { resetModals(); }}>Generate New Invoice</button>
      </div>
    </div>
  );
}