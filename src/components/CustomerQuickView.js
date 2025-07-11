// src/components/CustomerQuickView.js
import React from 'react';

export default function CustomerQuickView({ stats, position, onClose }) {
    if (!stats) return null;

    const style = {
        position: 'absolute',
        top: `${position.y}px`,
        left: `${position.x}px`,
        transform: 'translate(-105%, -105%)',
        zIndex: 3000,
        pointerEvents: 'none',
    };

    return (
        <div className="quick-view-popover" style={style}>
            <h4 className="popover-title">{stats.username}</h4>
            {stats.isLoading ? <p>Loading stats...</p> : (
                <div className="info-section">
                    <p><strong>Total Deposits:</strong> <span>${stats.totalDeposits.toFixed(2)}</span></p>
                    <p><strong>Total Cashouts:</strong> <span>${stats.totalCashouts.toFixed(2)}</span></p>
                    <p><strong>Net P/L:</strong> <span style={{color: stats.net >= 0 ? 'var(--primary-green)' : 'var(--red-alert)'}}>${stats.net.toFixed(2)}</span></p>
                </div>
            )}
        </div>
    );
}