// src/components/InvoiceModal.js
import React, { useState, useEffect, useRef } from 'react';
import QRErrorBoundary from './QRErrorBoundary';
import QRCodeLib from 'qrcode'; // Make sure qrcode is installed

export default function InvoiceModal({ order, expiresAt, setCopied, copied, resetModals, isValidQRValue }) {
  const [countdown, setCountdown] = useState(0);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  const timerIntervalRef = useRef(null);

  // Effect for countdown timer
  useEffect(() => {
    if (!expiresAt) {
      setCountdown(0);
      return;
    }

    const calculateRemaining = () => {
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((expiresAt - now) / 1000));
      setCountdown(remaining);

      if (remaining <= 0) {
        clearInterval(timerIntervalRef.current);
        // If the modal is still open and time runs out, trigger expired state
        // This relies on PaymentForm's polling to eventually confirm expiry or payment.
        // For a more immediate UI feedback, you might need a local state in PaymentForm
        // to directly set modal.expired after this countdown reaches 0, but
        // backend confirmation is always safer.
      }
    };

    // Set initial countdown
    calculateRemaining();

    // Set up interval to update countdown
    timerIntervalRef.current = setInterval(calculateRemaining, 1000);

    // Cleanup function to clear interval when component unmounts or expiresAt changes
    return () => {
      clearInterval(timerIntervalRef.current);
    };
  }, [expiresAt]); // Rerun effect if expiresAt changes

  // Effect for QR code generation
  useEffect(() => {
    const invoiceText = order?.invoice || '';
    if (invoiceText && isValidQRValue(invoiceText)) {
      QRCodeLib.toDataURL(invoiceText, {
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
        // You might want to pass an error state back to PaymentForm or display it here
      });
    } else {
      setQrCodeDataUrl('');
    }
  }, [order?.invoice, isValidQRValue]);


  const formatTime = sec => {
    if (sec < 0) return '0:00'; // Handle negative time gracefully
    const min = Math.floor(sec / 60);
    const s = String(sec % 60).padStart(2, '0');
    return `${min}:${s}`;
  };

  const handleCopyToClipboard = () => {
    const text = order?.invoice || '';
    if (!text) return; // No invoice to copy
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
        <h2 className="modal-title" style={{ color: 'var(--primary-green)' }}>Complete Payment</h2>

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

        <button className="btn btn-primary" onClick={handleCopyToClipboard} disabled={!isValidQRValue(invoiceText)}>
          {copied ? 'Copied!' : 'Copy Invoice'}
        </button>

        <p className="text-center mt-sm" style={{fontSize: '0.75rem', color: 'var(--text-light)', opacity: 0.8}}>Order ID: {order.orderId}</p>

      </div>
    </div>
  );
}