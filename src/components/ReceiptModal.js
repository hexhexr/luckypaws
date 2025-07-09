// src/components/ReceiptModal.js
import React from 'react';

export default function ReceiptModal({ order, resetModals }) {
  if (!order) return null;

  const shorten = (str) => {
    if (!str) return '';
    return str.length > 20 ? `${str.slice(0, 10)}...${str.slice(-10)}` : str;
  }

  return (
    <div className="modal-backdrop-v4" onClick={resetModals}>
        <div className="modal-glassmorphic-v4 receipt" onClick={(e) => e.stopPropagation()}>
            <button onClick={resetModals} className="modal-close-button-v4">×</button>
            <div className="modal-receipt-header-v4">
                <div className="modal-receipt-icon-v4">
                    <svg viewBox="0 0 52 52">
                        <circle className="receipt-circle-bg-v4" cx="26" cy="26" r="25"/>
                        <circle className="receipt-circle-v4" cx="26" cy="26" r="25"/>
                        <path className="receipt-checkmark-v4" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
                    </svg>
                </div>
                <h2>Payment Received!</h2>
            </div>
            <div className="modal-receipt-content-v4">
                <div className="modal-amount-display-v4 receipt">
                    <span className="modal-amount-usd-v4">${order.amount}</span>
                    <span className="modal-amount-alt-v4">{order.btc} BTC</span>
                </div>
                <div className="modal-details-group-v4 receipt">
                    <p><strong>Game:</strong><span>{order.game}</span></p>
                    <p><strong>Username:</strong><span>{order.username}</span></p>
                    <p><strong>Payment ID:</strong><span>{order.orderId}</span></p>
                    <p><strong>Invoice:</strong><span title={order.invoice}>{shorten(order.invoice)}</span></p>
                </div>
                <button className="modal-action-button-v4 primary" onClick={resetModals}>✨ Awesome!</button>
            </div>
        </div>
    </div>
  );
}