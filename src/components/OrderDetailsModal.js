// src/components/OrderDetailsModal.js
import React from 'react';

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

export default function OrderDetailsModal({ order, onClose, onMerge }) {
    if (!order) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
                <button onClick={onClose} className="modal-close-btn" aria-label="Close modal">&times;</button>
                <h2 className="modal-title">Order Details</h2>

                <div className="info-section">
                    <p><strong>Order ID:</strong> <span>{order.orderId || order.id}</span></p>
                    <p><strong>Status:</strong> <span className={`status-badge status-${order.status}`}>{order.status.replace('_', ' ')}</span></p>
                    <p><strong>Customer Username:</strong> <span>{order.username}</span></p>
                    <p><strong>Game:</strong> <span>{order.game}</span></p>
                </div>

                <div className="info-section mt-md">
                    <h4>Payment Information</h4>
                    <p><strong>Method:</strong> <span>{order.method === 'pyusd' ? 'PYUSD' : 'Lightning'}</span></p>
                    <p><strong>Requested Amount:</strong> <span>${parseFloat(order.amount || 0).toFixed(2)}</span></p>
                    {order.amountReceived && <p><strong>Amount Received:</strong> <span>${parseFloat(order.amountReceived).toFixed(2)}</span></p>}
                    <p><strong>Memo Provided:</strong> <span>{order.memo || 'N/A'}</span></p>
                    <p><strong>Transaction Signature:</strong>
                        {order.transactionSignature ? (
                            <a href={`https://solscan.io/tx/${order.transactionSignature}`} target="_blank" rel="noopener noreferrer" title={order.transactionSignature}>
                                View on Solscan
                            </a>
                        ) : 'N/A'}
                    </p>
                </div>
                
                <div className="info-section mt-md">
                    <h4>Timestamps</h4>
                    <p><strong>Created At:</strong> <span>{formatTimestamp(order.created)}</span></p>
                    <p><strong>Paid At:</strong> <span>{formatTimestamp(order.paidAt)}</span></p>
                </div>

                <div className="modal-actions mt-lg">
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