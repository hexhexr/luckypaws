// src/components/InvoiceModal.js
import React, { useState, useEffect, useRef } from 'react';
import QRCodeLib from 'qrcode';

// --- SVG Icons ---
const ClockIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>;
const CopyIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>;

export default function InvoiceModal({ order, expiresAt, resetModals }) {
    const [countdown, setCountdown] = useState('');
    const [isExpired, setIsExpired] = useState(false);
    const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
    const [copied, setCopied] = useState(false);
    const timerIntervalRef = useRef(null);

    useEffect(() => {
        if (!expiresAt || typeof expiresAt !== 'number' || expiresAt <= 0) {
            setCountdown('Expired');
            setIsExpired(true);
            return;
        }
        const calculateRemaining = () => {
            const now = Date.now();
            const remaining = Math.max(0, Math.floor((expiresAt - now) / 1000));
            if (remaining <= 0) {
                clearInterval(timerIntervalRef.current);
                setIsExpired(true);
                setCountdown('Expired');
            } else {
                const min = Math.floor(remaining / 60);
                const sec = String(remaining % 60).padStart(2, '0');
                setCountdown(`${min}:${sec}`);
                setIsExpired(false);
            }
        };
        calculateRemaining();
        timerIntervalRef.current = setInterval(calculateRemaining, 1000);
        return () => clearInterval(timerIntervalRef.current);
    }, [expiresAt]);

    useEffect(() => {
        const invoiceText = order?.invoice || '';
        if (invoiceText && !isExpired) {
            QRCodeLib.toDataURL(invoiceText, {
                errorCorrectionLevel: 'M',
                width: 160,
                margin: 2,
                color: { dark: '#000000', light: '#FFFFFF' }
            })
            .then(setQrCodeDataUrl)
            .catch(err => console.error('QR generation failed:', err));
        } else {
            setQrCodeDataUrl('');
        }
    }, [order?.invoice, isExpired]);

    const handleCopyToClipboard = () => {
        const text = order?.invoice || '';
        if (!text || isExpired) return;
        navigator.clipboard.writeText(text).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    if (!order) return null;

    return (
        <div className="modal-backdrop" onClick={resetModals}>
            <div className="modal-glassmorphic" onClick={(e) => e.stopPropagation()}>
                <button onClick={resetModals} className="modal-close-button">×</button>
                <div className="modal-header">
                    <h3>⚡ Lightning Payment</h3>
                </div>
                <div className="modal-content-grid">
                    <div className="modal-col-left">
                         <div className="modal-qr-container">
                            {qrCodeDataUrl && !isExpired ? (
                                <img src={qrCodeDataUrl} alt="Lightning Invoice" />
                            ) : (
                                <div className="modal-qr-expired">EXPIRED</div>
                            )}
                        </div>
                        <button className="modal-copy-button" onClick={handleCopyToClipboard} disabled={isExpired}>
                            <CopyIcon /> {copied ? 'Copied!' : 'Copy Invoice'}
                        </button>
                    </div>
                    <div className="modal-col-right">
                        <div className="modal-amount-display">
                            <span className="modal-amount-usd">${order.amount ?? '0.00'}</span>
                            <span className="modal-amount-alt">{order.btc ?? '0.00000000'} BTC</span>
                        </div>
                        <div className="modal-details-group">
                             <p><strong>Game:</strong><span>{order.game}</span></p>
                             <p><strong>Username:</strong><span>{order.username}</span></p>
                             <p><strong>Payment ID:</strong><span>{order.orderId}</span></p>
                        </div>
                    </div>
                </div>
                <div className="modal-footer">
                    <div className={`modal-timer ${isExpired ? 'expired' : ''}`}>
                        <ClockIcon />
                        <span>{countdown}</span>
                    </div>
                    <button className="modal-action-button" onClick={resetModals}>Cancel</button>
                </div>
            </div>
        </div>
    );
}