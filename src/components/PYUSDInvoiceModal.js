// File: src/components/PYUSDInvoiceModal.js
import React, { useState, useEffect, useRef } from 'react';
import QRCodeLib from 'qrcode';

export default function PYUSDInvoiceModal({ order, resetModals, onPaymentSuccess }) {
    const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
    const [copied, setCopied] = useState(false);
    const [statusMessage, setStatusMessage] = useState('Waiting for payment...');
    const pollingRef = useRef(null);

    const explorerUrl = `https://solscan.io/account/${order?.depositAddress}?cluster=${process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'mainnet-beta'}`;

    useEffect(() => {
        const depositAddress = order?.depositAddress || '';
        if (depositAddress) {
            QRCodeLib.toDataURL(depositAddress, { errorCorrectionLevel: 'M', width: 180, margin: 2 })
                .then(setQrCodeDataUrl)
                .catch(err => console.error('QR generation failed:', err));
        }
    }, [order?.depositAddress]);

    useEffect(() => {
        if (!order?.orderId) return;

        const pollStatus = async () => {
            try {
                const res = await fetch(`/api/pyusd/check-status?id=${order.orderId}`);
                const data = await res.json();

                switch (data?.status) {
                    case 'paid':
                    case 'sweeping':
                        setStatusMessage('Transaction found, finalizing...');
                        // Give a moment for the user to see the message before closing
                        setTimeout(() => {
                            clearInterval(pollingRef.current);
                            onPaymentSuccess();
                        }, 1500);
                        break;
                    case 'completed':
                        clearInterval(pollingRef.current);
                        onPaymentSuccess();
                        break;
                    case 'pending':
                        setStatusMessage('Waiting for deposit...');
                        break;
                    default:
                        setStatusMessage(`Status: ${data?.status || 'Unknown'}`);
                }
            } catch (err) {
                console.error('PYUSD status polling error:', err);
                setStatusMessage('Polling error. Please check back.');
            }
        };

        // Initial check
        pollStatus();
        // Set interval
        pollingRef.current = setInterval(pollStatus, 5000);

        return () => clearInterval(pollingRef.current);
    }, [order?.orderId, onPaymentSuccess]);

    const handleCopyToClipboard = () => {
        const text = order?.depositAddress || '';
        navigator.clipboard.writeText(text).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    if (!order) return null;

    return (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) resetModals(); }}>
            <div className="modal">
                <button onClick={resetModals} className="modal-close-btn">&times;</button>
                <h2 className="modal-title" style={{ color: 'var(--primary-blue)' }}>Deposit PYUSD</h2>
                <p className="section-subtitle" style={{fontSize: '0.9rem', marginBottom: 'var(--spacing-md)'}}>
                    Send exactly <strong>${order.amount} of PYUSD</strong> to the address below.
                </p>
                <div className="amount-display mb-md">
                    <span className="usd-amount"><strong>${order.amount}</strong> USD</span>
                    <span className="btc-amount">PYUSD on Solana</span>
                </div>
                <div className="qr-container mb-md">
                    {qrCodeDataUrl ? <img src={qrCodeDataUrl} alt="PYUSD Deposit QR Code" width={180} height={180} /> : <p>Generating QR code...</p>}
                </div>
                <div className="short-invoice-display" style={{ cursor: 'pointer' }} onClick={handleCopyToClipboard}>
                    <strong>Deposit Address:</strong> {order.depositAddress}
                </div>
                <a href={explorerUrl} target="_blank" rel="noopener noreferrer" style={{fontSize: '0.8rem', textDecoration: 'underline'}}>View on Block Explorer</a>
                <button className="btn btn-primary mt-md" onClick={handleCopyToClipboard}>{copied ? 'Copied!' : 'Copy Address'}</button>
                <p className="text-center mt-lg" style={{fontSize: '0.9rem', color: 'var(--text-light)', opacity: 0.9}}>
                    <span style={{fontSize: '1.5rem', display: 'block'}}>⏳</span>
                    {statusMessage}
                </p>
            </div>
        </div>
    );
}