// src/components/PYUSDReceiptModal.js
import React from 'react';

export default function PYUSDReceiptModal({ order, resetModals }) {
    if (!order) return null;

    return (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) resetModals(); }}>
            <div className="modal">
                <button onClick={resetModals} className="modal-close-btn">&times;</button>
                <h2 className="modal-title text-success">✅ Payment Received</h2>

                <div className="amount-display mb-md">
                    <span className="usd-amount"><strong>${order.amount}</strong> USD</span>
                    <span className="btc-amount">PYUSD on Solana</span>
                </div>

                <div className="info-section mb-md">
                    <p><strong>Game:</strong> <span>{order.game}</span></p>
                    <p><strong>Username:</strong> <span>{order.username}</span></p>
                    <p><strong>Order ID:</strong> <span>{order.orderId}</span></p>
                </div>

                <button className="btn btn-primary mt-md" onClick={resetModals}>Done</button>
            </div>
        </div>
    );
}