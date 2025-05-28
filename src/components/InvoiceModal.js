// src/components/InvoiceModal.js
import React, { useEffect, useState } from 'react';
import QRCodeLib from 'qrcode';
import QRErrorBoundary from './QRErrorBoundary';

export default function InvoiceModal({ order, countdown, setCopied, copied, resetModals }) {
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');

  const formatTime = sec => {
    const min = Math.floor(sec / 60);
    const s = String(sec % 60).padStart(2, '0');
    return `${min}:${s}`;
  };

  const isValidQRValue = value =>
    typeof value === 'string' &&
    value.trim().length > 10 &&
    /^ln(bc|tb|bcrt)[0-9a-z]+$/i.test(value.trim());

  useEffect(() => {
    if (order && order.invoice && isValidQRValue(order.invoice)) {
      QRCodeLib.toDataURL(order.invoice, {
        errorCorrectionLevel: 'M',
        width: 140,
        margin: 2,
      })
      .then(url => {
        setQrCodeDataUrl(url);
      })
      .catch(err => {
        console.error('Failed to generate QR code data URL in InvoiceModal:', err);
        setQrCodeDataUrl('');
      });
    } else {
      setQrCodeDataUrl('');
    }
  }, [order?.invoice]);

  const copyToClipboard = () => {
    const text = order?.invoice || '';
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(err => {
        console.error('Failed to copy in InvoiceModal:', err);
    });
  };

  if (!order) return null;

  const invoiceText = order.invoice || '';

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) resetModals(); }}>
      <div className="modal">
        <button onClick={resetModals} className="modal-close-btn" aria-label="Close modal">&times;</button>
        <h2 className="modal-title">Complete Payment</h2>

        <div className="invoice-countdown" data-testid="countdown-timer">
          Expires in: {formatTime(countdown)}
        </div>

        <div className="amount-display mb-md">
          <span className="usd-amount">${order.amount ?? '0.00'} USD</span>
          <span className="btc-amount">{order.btc ?? '0.00000000'} BTC</span>
        </div>

        <QRErrorBoundary
          fallback={<p className="alert alert-danger">⚠️ Could not display QR code. Please copy the invoice text below.</p>}
        >
          <div className="qr-container mb-md">
            {qrCodeDataUrl ? (
              <img src={qrCodeDataUrl} alt="Lightning Invoice QR Code" width={140} height={140} />
            ) : (
              isValidQRValue(invoiceText) ? <p>Generating QR code...</p> : <p className="alert alert-warning">Invalid invoice data for QR.</p>
            )}
            {isValidQRValue(invoiceText) && (
              <p className="qr-text">{invoiceText}</p>
            )}
          </div>
        </QRErrorBoundary>

        <button className="btn btn-success" onClick={copyToClipboard} disabled={!isValidQRValue(invoiceText)}>
          {copied ? 'Copied!' : 'Copy Invoice'}
        </button>

        <p className="text-center mt-sm" style={{fontSize: '0.75rem', color: 'var(--text-light)', opacity: 0.8}}>Order ID: {order.orderId}</p>

      </div>
    </div>
  );
}