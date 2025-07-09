// src/components/InvoiceModal.js
import React, { useState, useEffect, useRef } from 'react';
import QRErrorBoundary from './QRErrorBoundary';
import QRCodeLib from 'qrcode';

// --- SVG Icons ---
const ClockIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>;
const CopyIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>;

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
                width: 180, // Corrected smaller size
                margin: 2,
                color: { dark: '#000000', light: '#FFFFFF' }
            })
            .then(setQrCodeDataUrl)
            .catch(err => {
                console.error('Failed to generate QR code:', err);
                setQrCodeDataUrl('');
            });
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
        }).catch(err => {
            console.error('Failed to copy invoice:', err);
        });
    };

    if (!order) return null;

    return (
        <div className="modal-backdrop" onClick={resetModals}>
            <div className="modal-glassmorphic" onClick={(e) => e.stopPropagation()}>
                <button onClick={resetModals} className="modal-close-button" aria-label="Close modal">×</button>
                <div className="modal-header">
                    <h3>⚡ Complete Your Payment</h3>
                </div>
                <div className="modal-content-grid">
                    <div className="modal-col-left">
                         <QRErrorBoundary fallback={<p className="alert alert-danger">⚠️ QR Error</p>}>
                            <div className="modal-qr-container">
                                {qrCodeDataUrl && !isExpired ? (
                                    <img src={qrCodeDataUrl} alt="Lightning Invoice QR Code" />
                                ) : (
                                    <div className="modal-qr-expired">QR Expired</div>
                                )}
                            </div>
                        </QRErrorBoundary>
                        <button className="modal-copy-button" onClick={handleCopyToClipboard} disabled={isExpired}>
                            <CopyIcon /> {copied ? 'Copied!' : 'Copy Invoice'}
                        </button>
                    </div>
                    <div className="modal-col-right">
                        <div className="modal-amount-display">
                            <span className="modal-amount-usd">${order.amount ?? '0.00'} USD</span>
                            <span className="modal-amount-alt">{order.btc ?? '0.00000000'} BTC</span>
                        </div>
                        <div className="modal-details-group">
                             <h4>Order Details</h4>
                             <p><strong>Game:</strong><span>{order.game}</span></p>
                             <p><strong>Username:</strong><span>{order.username}</span></p>
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