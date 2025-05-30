// src/components/InvoiceModal.js
import React, { useState, useEffect, useRef } from 'react';
import QRErrorBoundary from './QRErrorBoundary';
import QRCodeLib from 'qrcode';

export default function InvoiceModal({ order, expiresAt, setCopied, copied, resetModals, isValidQRValue }) {
  const [countdown, setCountdown] = useState(0);
  const [isExpired, setIsExpired] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  const timerIntervalRef = useRef(null);

  // Effect for countdown timer
  useEffect(() => {
    // If expiresAt is not provided or invalid, treat as expired
    if (!expiresAt || typeof expiresAt !== 'number' || expiresAt <= 0) {
      setCountdown(0);
      setIsExpired(true);
      return;
    }

    const calculateRemaining = () => {
      const now = Date.now(); // Current client time in milliseconds
      // Calculate remaining time in seconds
      const remaining = Math.max(0, Math.floor((expiresAt - now) / 1000));
      setCountdown(remaining);

      if (remaining <= 0) {
        clearInterval(timerIntervalRef.current);
        setIsExpired(true);
      } else {
        setIsExpired(false);
      }
    };

    // Set initial countdown immediately
    calculateRemaining();
    // Set up interval to update countdown every second
    timerIntervalRef.current = setInterval(calculateRemaining, 1000);

    // Cleanup function to clear interval when component unmounts or deps change
    return () => {
      clearInterval(timerIntervalRef.current);
    };
  }, [expiresAt]); // Re-run effect if expiresAt changes

  // Effect for QR code generation
  useEffect(() => {
    const invoiceText = order?.invoice || '';
    if (invoiceText && isValidQRValue(invoiceText) && !isExpired) { // Only generate QR if valid and not expired
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
      });
    } else {
      setQrCodeDataUrl(''); // Clear QR if no invoice, invalid, or expired
    }
  }, [order?.invoice, isValidQRValue, isExpired]); // Add isExpired to dependencies for QR generation

  const formatTime = sec => {
    if (sec < 0) return '0:00';
    const min = Math.floor(sec / 60);
    const s = String(sec % 60).padStart(2, '0');
    return `${min}:${s}`;
  };

  const handleCopyToClipboard = () => {
    const text = order?.invoice || '';
    if (!text || isExpired) return; // Prevent copying if expired
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(err => {
        console.error('Failed to copy in InvoiceModal:', err);
    });
  };

  if (!order) return null; // Don't render if no order data

  const invoiceText = order.invoice || '';

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) resetModals(); }}>
      <div className="modal">
        <button onClick={resetModals} className="modal-close-btn" aria-label="Close modal">&times;</button>
        <h2 className="modal-title" style={{ color: 'var(--primary-green)' }}>Complete Payment</h2>

        <div className="invoice-countdown" data-testid="countdown-timer">
          {isExpired ? (
            <span style={{color: 'red', fontWeight: 'bold'}}>Invoice Expired!</span>
          ) : (
            `Expires in: ${formatTime(countdown)}`
          )}
        </div>

        <div className="amount-display mb-md">
          <span className="usd-amount">${order.amount ?? '0.00'} USD</span>
          <span className="btc-amount">{order.btc ?? '0.00000000'} BTC</span>
        </div>

        <QRErrorBoundary
          fallback={<p className="alert alert-danger">⚠️ Could not display QR code. Please copy the invoice text below.</p>}
        >
          <div className="qr-container mb-md">
            {qrCodeDataUrl && !isExpired ? ( // Only show QR if data exists and not expired
              <img src={qrCodeDataUrl} alt="Lightning Invoice QR Code" width={140} height={140} />
            ) : isExpired ? (
              <p className="alert alert-danger">QR code expired.</p>
            ) : (
              isValidQRValue(invoiceText) ? <p>Generating QR code...</p> : <p className="alert alert-warning">Invalid invoice data for QR.</p>
            )}
            {isValidQRValue(invoiceText) && (
              <p className="qr-text">{invoiceText}</p>
            )}
          </div>
        </QRErrorBoundary>

        <button
          className="btn btn-primary"
          onClick={handleCopyToClipboard}
          disabled={!isValidQRValue(invoiceText) || isExpired}
        >
          {copied ? 'Copied!' : 'Copy Invoice'}
        </button>

        <p className="text-center mt-sm" style={{fontSize: '0.75rem', color: 'var(--text-light)', opacity: 0.8}}>Order ID: {order.orderId}</p>

      </div>
    </div>
  );
}