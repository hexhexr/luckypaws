// src/components/PYUSDReceiptModal.js
import React from 'react';

const ExplorerIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>;

export default function PYUSDReceiptModal({ order, resetModals }) {
    if (!order) return null;

    // Function to create a link to the Solscan explorer
    const getExplorerLink = (signature) => {
        if (!signature) return null;
        return `https://solscan.io/tx/${signature}`;
    }

    return (
        <div className="modal-backdrop">
            <div className="modal-glassmorphic receipt">
                <button onClick={resetModals} className="modal-close-button" aria-label="Close modal">×</button>
                 <div className="modal-receipt-header">
                    <div className="modal-receipt-icon">
                        <svg viewBox="0 0 52 52">
                            <circle className="receipt-circle-bg" cx="26" cy="26" r="25" fill="none"/>
                            <circle className="receipt-circle" cx="26" cy="26" r="25" fill="none"/>
                            <path className="receipt-checkmark" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
                        </svg>
                    </div>
                    <h2>Payment Received!</h2>
                </div>
                <div className="modal-receipt-content">
                    <div className="modal-amount-display receipt">
                        <span className="modal-amount-usd">${order.amount} USD</span>
                        <span className="modal-amount-alt">PYUSD</span>
                    </div>
                    <div className="modal-details-group receipt">
                        <p><strong>Game:</strong><span>{order.game}</span></p>
                        <p><strong>Username:</strong><span>{order.username}</span></p>
                         {order.transactionSignature && getExplorerLink(order.transactionSignature) && (
                            <p><strong>Transaction:</strong>
                                <a href={getExplorerLink(order.transactionSignature)} target="_blank" rel="noopener noreferrer">
                                    View on Solscan <ExplorerIcon />
                                </a>
                            </p>
                        )}
                    </div>
                    <button className="modal-action-button primary" onClick={resetModals}>✨ Awesome!</button>
                </div>
            </div>
        </div>
    );
}