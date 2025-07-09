// src/components/ReceiptModal.js
import React from 'react';

const ExplorerIcon = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>;

export default function ReceiptModal({ order, resetModals }) {
  if (!order) return null;

  const shorten = (str) => {
    if (!str) return '';
    return str.length > 20 ? `${str.slice(0, 10)}...${str.slice(-10)}` : str;
  }

  return (
    <div className="modal-backdrop" onClick={resetModals}>
        <div className="modal-glassmorphic receipt" onClick={(e) => e.stopPropagation()}>
            <button onClick={resetModals} className="modal-close-button">×</button>
            <div className="modal-receipt-header">
                <div className="modal-receipt-icon">
                    <svg viewBox="0 0 52 52">
                        <circle className="receipt-circle-bg" cx="26" cy="26" r="25"/>
                        <circle className="receipt-circle" cx="26" cy="26" r="25"/>
                        <path className="receipt-checkmark" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
                    </svg>
                </div>
                <h2>Payment Received!</h2>
            </div>
            <div className="modal-receipt-content">
                <div className="modal-amount-display receipt">
                    <span className="modal-amount-usd">${order.amount}</span>
                    <span className="modal-amount-alt">{order.btc} BTC</span>
                </div>
                <div className="modal-details-group receipt">
                    <p><strong>Game:</strong><span>{order.game}</span></p>
                    <p><strong>Username:</strong><span>{order.username}</span></p>
                    <p><strong>Payment ID:</strong><span>{order.orderId}</span></p>
                    <p><strong>Invoice:</strong><span title={order.invoice}>{shorten(order.invoice)}</span></p>
                </div>
                <button className="modal-action-button primary" onClick={resetModals}>✨ Awesome!</button>
            </div>
        </div>
    </div>
  );
}