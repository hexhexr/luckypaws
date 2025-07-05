// src/components/CustomerQuickView.js
import React from 'react';

export default function CustomerQuickView({ stats, position, onClose }) {
    if (!stats) return null;

    // --- THIS IS THE FIX for the pop-up position ---
    // The position is now calculated on the dashboard page.
    // This style ensures the pop-up appears just above and to the left of the cursor.
    const style = {
        position: 'absolute',
        top: `${position.y}px`,
        left: `${position.x}px`,
        transform: 'translate(-105%, -105%)', // Move it slightly away from the cursor
        zIndex: 3000,
        pointerEvents: 'none', // Prevents the pop-up from interfering with mouse events
    };

    return (
        <div className="quick-view-popover" style={style}>
            {/* The close button is removed as it's now controlled by mouse hover */}
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