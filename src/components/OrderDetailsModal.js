// src/components/OrderDetailsModal.js
import React from 'react';

// Helper function to format the timestamp
const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'N/A';
    if (typeof timestamp.toDate === 'function') {
        return timestamp.toDate().toLocaleString();
    }
    try {
        const date = new Date(timestamp);
        if (isNaN(date.getTime())) return 'N/A';
        return date.toLocaleString();
    } catch (e) { return 'N/A'; }
};

// SVG Icon for the external link
const ExplorerIcon = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>;


// FINAL FIX: This version perfects the spacing, alignment, and typography.
export default function OrderDetailsModal({ order, onClose, onMerge }) {
    if (!order) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal details-modal" onClick={(e) => e.stopPropagation()}>
                <div className="details-modal-header">
                    <h3>Order Details</h3>
                    <button onClick={onClose} className="modal-close-btn" aria-label="Close modal">&times;</button>
                </div>
                
                <div className="details-modal-content">
                    {/* Customer Info Section */}
                    <div className="details-section">
                        <div className="details-row">
                            <span className="details-label">Customer Username</span>
                            <span className="details-value">{order.username}</span>
                        </div>
                        <div className="details-row">
                            <span className="details-label">Game</span>
                            <span className="details-value">{order.game}</span>
                        </div>
                        <div className="details-row">
                            <span className="details-label">Status</span>
                            <span className="details-value">
                                <span className={`status-badge status-${order.status}`}>{order.status.replace('_', ' ')}</span>
                            </span>
                        </div>
                    </div>

                    {/* Payment Info Section */}
                    <div className="details-section">
                        <h4 className="details-section-title">Payment Information</h4>
                        <div className="details-row">
                            <span className="details-label">Method</span>
                            <span className="details-value">
                                 <span className={`method-badge method-${order.method || 'lightning'}`}>{order.method === 'pyusd' ? 'PYUSD' : 'Lightning'}</span>
                            </span>
                        </div>
                        <div className="details-row">
                            <span className="details-label">Requested Amount</span>
                            <span className="details-value">${parseFloat(order.amount || 0).toFixed(2)}</span>
                        </div>
                        {order.amountReceived && (
                            <div className="details-row">
                                <span className="details-label">Amount Received</span>
                                <span className="details-value highlight-success">${parseFloat(order.amountReceived).toFixed(2)}</span>
                            </div>
                        )}
                        <div className="details-row">
                            <span className="details-label">Memo Provided</span>
                            <span className="details-value">{order.memo || 'N/A'}</span>
                        </div>
                         <div className="details-row">
                            <span className="details-label">Transaction ID</span>
                            <span className="details-value">
                                {order.transactionSignature ? (
                                    <a href={`https://solscan.io/tx/${order.transactionSignature}`} target="_blank" rel="noopener noreferrer" title={order.transactionSignature}>
                                        View on Solscan <ExplorerIcon />
                                    </a>
                                ) : 'N/A'}
                            </span>
                        </div>
                    </div>

                    {/* Timestamps Section */}
                    <div className="details-section">
                        <h4 className="details-section-title">Timestamps</h4>
                        <div className="details-row">
                            <span className="details-label">Created At</span>
                            <span className="details-value">{formatTimestamp(order.created)}</span>
                        </div>
                         <div className="details-row">
                            <span className="details-label">Paid At</span>
                            <span className="details-value">{formatTimestamp(order.paidAt)}</span>
                        </div>
                    </div>
                </div>

                <div className="details-modal-actions">
                    {order.status === 'unmatched_payment' && (
                        <button className="btn btn-success" onClick={() => onMerge(order)}>
                            Find Match & Merge
                        </button>
                    )}
                    <button className="btn btn-secondary" onClick={onClose}>Close</button>
                </div>
            </div>
        </div>
    );
}