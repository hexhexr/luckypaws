// src/components/PYUSDInvoiceModal.js
import React, { useState, useEffect, useRef } from 'react';
import QRCodeLib from 'qrcode';

const CopyIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>;

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
                width: 160,
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
            } catch (err) { console.error('PYUSD polling error:', err); }
        }, 5000);
        return () => clearInterval(pollingRef.current);
    }, [order?.depositId, onPaymentSuccess]);

    const handleCopy = (text, type) => {
        navigator.clipboard.writeText(text).then(() => {
            if (type === 'address') setCopiedAddress(true);
            else setCopiedMemo(true);
            setTimeout(() => {
                setCopiedAddress(false);
                setCopiedMemo(false);
            }, 2000);
        });
    };

    if (!order) return null;

    return (
        <div className="modal-backdrop-v4" onClick={resetModals}>
            <div className="modal-glassmorphic-v4" onClick={(e) => e.stopPropagation()}>
                <button onClick={resetModals} className="modal-close-button-v4">×</button>
                <div className="modal-header-v4">
                    <h3>🅿️ PYUSD on Solana</h3>
                </div>
                <div className="modal-content-grid-v4">
                     <div className="modal-col-left-v4">
                        <div className="modal-qr-container-v4">
                            {qrCodeDataUrl ? <img src={qrCodeDataUrl} alt="Solana Address" /> : <p>Loading QR</p>}
                        </div>
                     </div>
                     <div className="modal-col-right-v4">
                        <div className="modal-amount-display-v4">
                            <span className="modal-amount-usd-v4">${order.amount}</span>
                            <span className="modal-amount-alt-v4">PYUSD</span>
                        </div>
                        <div className="modal-details-group-v4 compact">
                            <h4>To Address</h4>
                            <div className="modal-copy-group-v4">
                                <input type="text" readOnly value={order.depositAddress} />
                                <button onClick={() => handleCopy(order.depositAddress, 'address')}>
                                    {copiedAddress ? '✓' : <CopyIcon />}
                                </button>
                            </div>
                        </div>
                        <div className="modal-details-group-v4 compact">
                            <h4>Memo (Required)</h4>
                             <div className="modal-copy-group-v4">
                                <input type="text" readOnly value={order.memo} />
                                <button onClick={() => handleCopy(order.memo, 'memo')}>
                                    {copiedMemo ? '✓' : <CopyIcon />}
                                </button>
                            </div>
                        </div>
                     </div>
                </div>
                <div className="alert alert-warning" style={{margin: '0.75rem 0', textAlign: 'center', fontSize: '0.8rem', padding: '0.5rem'}}>
                    <strong>Important:</strong> Memo is required for payment.
                </div>
                <div className="modal-footer-v4">
                   <p className="modal-waiting-text-v4">⏳ Waiting for payment...</p>
                   <button className="modal-action-button-v4" onClick={resetModals}>Cancel</button>
                </div>
            </div>
        </div>
    );
}