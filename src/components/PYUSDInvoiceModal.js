// src/components/PYUSDInvoiceModal.js
import React, { useState, useEffect, useRef } from 'react';
import QRCodeLib from 'qrcode';

// --- SVG Icons ---
const CopyIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>;

export default function PYUSDInvoiceModal({ order, resetModals, onPaymentSuccess }) {
    const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
    const [copiedAddress, setCopiedAddress] = useState(false);
    const [copiedMemo, setCopiedMemo] = useState(false);
    const pollingRef = useRef(null);

    useEffect(() => {
        const depositAddress = order?.depositAddress || '';
        if (depositAddress) {
            QRCodeLib.toDataURL(depositAddress, { 
                errorCorrectionLevel: 'M', 
                width: 180, // Corrected smaller size
                margin: 2,
                color: { dark: '#000000', light: '#FFFFFF' }
            })
            .then(setQrCodeDataUrl)
            .catch(err => console.error('QR generation failed:', err));
        }
    }, [order?.depositAddress]);

    useEffect(() => {
        if (!order?.depositId) return;
        pollingRef.current = setInterval(async () => {
             try {
                const res = await fetch(`/api/pyusd/check-status?id=${order.depositId}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data?.status === 'completed') {
                        clearInterval(pollingRef.current);
                        onPaymentSuccess();
                    }
                }
            } catch (err) {
                console.error('PYUSD status polling error:', err);
            }
        }, 5000);
        return () => clearInterval(pollingRef.current);
    }, [order?.depositId, onPaymentSuccess]);

    const handleCopy = (text, type) => {
        navigator.clipboard.writeText(text).then(() => {
            if (type === 'address') {
                setCopiedAddress(true);
                setTimeout(() => setCopiedAddress(false), 2000);
            } else {
                setCopiedMemo(true);
                setTimeout(() => setCopiedMemo(false), 2000);
            }
        });
    };

    if (!order) return null;

    return (
        <div className="modal-backdrop" onClick={resetModals}>
            <div className="modal-glassmorphic" onClick={(e) => e.stopPropagation()}>
                <button onClick={resetModals} className="modal-close-button" aria-label="Close modal">×</button>
                <div className="modal-header">
                    <h3>🅿️ PYUSD on Solana</h3>
                </div>
                <div className="modal-content-grid">
                     <div className="modal-col-left">
                        <div className="modal-qr-container">
                            {qrCodeDataUrl ? <img src={qrCodeDataUrl} alt="Solana Address QR Code" /> : <p>Loading QR...</p>}
                        </div>
                        <div className="alert alert-warning" style={{marginTop: '1rem', textAlign: 'center', fontSize: '0.85rem'}}>
                            <strong>Important:</strong> You must include the <strong>6-Digit Memo</strong>.
                        </div>
                     </div>
                     <div className="modal-col-right">
                        <div className="modal-amount-display">
                            <span className="modal-amount-usd">${order.amount} USD</span>
                            <span className="modal-amount-alt">PYUSD</span>
                        </div>
                        <div className="modal-details-group">
                            <h4>To Address</h4>
                            <div className="modal-copy-group">
                                <input type="text" readOnly value={order.depositAddress} />
                                <button onClick={() => handleCopy(order.depositAddress, 'address')}>
                                    <CopyIcon /> {copiedAddress ? 'Copied' : 'Copy'}
                                </button>
                            </div>
                        </div>
                        <div className="modal-details-group">
                            <h4>Memo (Required)</h4>
                             <div className="modal-copy-group">
                                <input type="text" readOnly value={order.memo} />
                                <button onClick={() => handleCopy(order.memo, 'memo')}>
                                    <CopyIcon /> {copiedMemo ? 'Copied' : 'Copy'}
                                </button>
                            </div>
                        </div>
                     </div>
                </div>
                <div className="modal-footer">
                   <p className="modal-waiting-text">⏳ Waiting for payment...</p>
                   <button className="modal-action-button" onClick={resetModals}>Cancel</button>
                </div>
            </div>
        </div>
    );
}