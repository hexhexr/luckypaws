// src/components/InvoiceModal.js
import React, { useState, useEffect, useRef } from 'react';
import QRErrorBoundary from './QRErrorBoundary';
import QRCodeLib from 'qrcode';

export default function InvoiceModal({ order, expiresAt, setCopied, copied, resetModals, isValidQRValue }) {
  const [countdown, setCountdown] = useState(0);
  const [isExpired, setIsExpired] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  const timerIntervalRef = useRef(null);

  // --- NEW LOGS HERE ---
  useEffect(() => {
    console.log('--- FRONTEND DEBUG START ---');
    console.log('InvoiceModal received expiresAt prop:', expiresAt, 'Type:', typeof expiresAt);
    console.log('Client Date.now() at component render:', Date.now());
    if (expiresAt) {
      const initialRemainingSeconds = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
      console.log(`Initial remaining time on client: ${initialRemainingSeconds} seconds`);
      if (initialRemainingSeconds <= 0) {
        console.warn('WARNING: Invoice already expired or about to expire on client side!');
      }
    } else {
         console.warn('WARNING: expiresAt prop is null or invalid in InvoiceModal.');
    }
    console.log('--- FRONTEND DEBUG END ---');
  }, [expiresAt]); // Log when expiresAt changes

  // Effect for countdown timer
  useEffect(() => {
    if (!expiresAt) {
      setCountdown(0);
      setIsExpired(true);
      return;
    }

    const calculateRemaining = () => {
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((expiresAt - now) / 1000));
      setCountdown(remaining);

      if (remaining <= 0) {
        clearInterval(timerIntervalRef.current);
        setIsExpired(true);
      } else {
        setIsExpired(false);
      }
    };

    calculateRemaining();
    timerIntervalRef.current = setInterval(calculateRemaining, 1000);

    return () => {
      clearInterval(timerIntervalRef.current);
    };
  }, [expiresAt]);

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
      });
    } else {
      setQrCodeDataUrl('');
    }
  }, [order?.invoice, isValidQRValue]);


  const formatTime = sec => {
    if (sec < 0) return '0:00';
    const min = Math.floor(sec / 60);
    const s = String(sec % 60).padStart(2, '0');
    return `${min}:${s}`;
  };

  const handleCopyToClipboard = () => {
    const text = order?.invoice || '';
    if (!text || isExpired) return;
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
            {qrCodeDataUrl && !isExpired ? (
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