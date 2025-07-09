// src/components/PYUSDReceiptModal.js
import React from 'react';

const ExplorerIcon = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>;

export default function PYUSDReceiptModal({ order, resetModals }) {
    if (!order) return null;

    const getExplorerLink = (signature) => {
        if (!signature) return null;
        return `https://solscan.io/tx/${signature}`;
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
                        <span className="modal-amount-alt-v4">PYUSD</span>
                    </div>
                    <div className="modal-details-group-v4 receipt">
                        <p><strong>Game:</strong><span>{order.game}</span></p>
                        <p><strong>Username:</strong><span>{order.username}</span></p>
                        {getExplorerLink(order.transactionSignature) && (
                            <p><strong>Transaction:</strong>
                                <a href={getExplorerLink(order.transactionSignature)} target="_blank" rel="noopener noreferrer">
                                    View on Solscan <ExplorerIcon />
                                </a>
                            </p>
                        )}
                    </div>
                    <button className="modal-action-button-v4 primary" onClick={resetModals}>✨ Awesome!</button>
                </div>
            </div>
        </div>
    );
}