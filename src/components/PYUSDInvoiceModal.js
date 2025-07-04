// src/components/PYUSDInvoiceModal.js
import React, { useState, useEffect, useRef } from 'react';
import QRCodeLib from 'qrcode';

export default function PYUSDInvoiceModal({ order, resetModals, onPaymentSuccess }) {
    const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
    const [copiedAddress, setCopiedAddress] = useState(false);
    const [copiedMemo, setCopiedMemo] = useState(false);
    const pollingRef = useRef(null);

    useEffect(() => {
        const depositAddress = order?.depositAddress || '';
        if (depositAddress) {
            QRCodeLib.toDataURL(depositAddress, { errorCorrectionLevel: 'M', width: 180, margin: 2 })
                .then(setQrCodeDataUrl)
                .catch(err => console.error('QR generation failed:', err));
        }
    }, [order?.depositAddress]);

    useEffect(() => {
        if (!order?.depositId) return;
        pollingRef.current = setInterval(async () => {
             try {
                const res = await fetch(`/api/pyusd/check-status?id=${order.depositId}`);
                if (!res.ok) return;
                const data = await res.json();
                if (data?.status === 'completed') {
                    clearInterval(pollingRef.current);
                    onPaymentSuccess();
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
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) resetModals(); }}>
            <div className="modal">
                <button onClick={resetModals} className="modal-close-btn">&times;</button>
                <h2 className="modal-title" style={{ color: 'var(--primary-blue)' }}>Deposit PYUSD on Solana</h2>
                
                <div className="alert alert-warning" style={{ textAlign: 'left' }}>
                    <strong>IMPORTANT:</strong> You MUST include the <strong style={{color: 'var(--red-alert)'}}>6-Digit Memo</strong> in your transaction. Without it, your deposit will be lost.
                </div>

                <div className="info-section mt-md">
                    <p><strong>Send Amount:</strong> <span>${order.amount} USD</span></p>
                </div>

                <div className="qr-container mt-md mb-md">
                    {qrCodeDataUrl ? <img src={qrCodeDataUrl} alt="PYUSD Deposit QR Code" width={180} height={180} /> : <p>Generating QR code...</p>}
                </div>
                
                <div className="form-group">
                    <label>To Address (Your Main Wallet)</label>
                    <div className="input-group">
                        <input type="text" className="input" readOnly value={order.depositAddress} />
                        <button className="btn btn-secondary" onClick={() => handleCopy(order.depositAddress, 'address')}>{copiedAddress ? 'Copied!' : 'Copy'}</button>
                    </div>
                </div>

                <div className="form-group">
                    <label>6-Digit Memo (Required)</label>
                     <div className="input-group">
                        <input type="text" className="input" readOnly value={order.memo} />
                        <button className="btn btn-secondary" onClick={() => handleCopy(order.memo, 'memo')}>{copiedMemo ? 'Copied!' : 'Copy'}</button>
                    </div>
                </div>

                <p className="text-center mt-lg" style={{fontSize: '0.9rem', color: 'var(--text-light)', opacity: 0.9}}>
                    <span style={{fontSize: '1.5rem', display: 'block'}}>⏳</span>
                    Waiting for payment...
                </p>
            </div>
        </div>
    );
}
