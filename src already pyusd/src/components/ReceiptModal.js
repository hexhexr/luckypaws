// src/components/ReceiptModal.js
import React from 'react';

export default function ReceiptModal({ order, resetModals, shorten }) {
  if (!order) return null;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) resetModals(); }}>
      <div className="modal">
        <button onClick={resetModals} className="modal-close-btn" aria-label="Close modal">&times;</button>
        <h2 className="modal-title text-success">✅ Payment Received</h2>

        <div className="amount-display mb-md">
          <span className="usd-amount"><strong>${order.amount}</strong> USD</span>
          <span className="btc-amount">{order.btc} BTC</span>
        </div>

        <div className="info-section mb-md">
          <p><strong>Game:</strong> <span>{order.game}</span></p>
          <p><strong>Username:</strong> <span>{order.username}</span></p>
          <p><strong>Order ID:</strong> <span>{order.orderId}</span></p>
        </div>
        <div className="short-invoice-display">
          <strong>Invoice:</strong> {shorten(order.invoice)}
        </div>
        <button className="btn btn-primary mt-md" onClick={resetModals}>Done</button>
      </div>
    </div>
  );
}