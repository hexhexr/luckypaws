// src/components/PaymentForm.js
import React, { useState, useEffect, useRef } from 'react';
import { db } from '../lib/firebaseClient'; // Adjust path based on your lib folder
import QRCodeLib from 'qrcode'; // Import the base qrcode library

// Import Modals (assuming they are in the same src/components/ directory)
import InvoiceModal from './InvoiceModal';
import ExpiredModal from './ExpiredModal';
import ReceiptModal from './ReceiptModal';
import QRErrorBoundary from './QRErrorBoundary'; // Ensure this path is correct

export default function PaymentForm() {
  const [form, setForm] = useState({ username: '', game: '', amount: '', method: 'lightning' });
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(false);
  const [order, setOrder] = useState(null);
  const [status, setStatus] = useState('idle'); // idle, pending, paid, expired
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [modals, setModals] = useState({ invoice: false, receipt: false, expired: false });
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState(''); // State for QR code data URL

  // Use a ref to store the expiresAt timestamp for more reliable countdown
  const expiresAtRef = useRef(null);

  const pollingRef = useRef(null);

  useEffect(() => {
    const loadGames = async () => {
      try {
        const snap = await db.collection('games').orderBy('name').get();
        setGames(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (err) {
        console.error('Error loading games:', err);
        setError('Failed to load games');
      }
    };
    loadGames();
  }, []);

  useEffect(() => {
    if (!order || status !== 'pending') return;

    // Clear any existing polling interval before setting a new one
    if (pollingRef.current) {
        clearInterval(pollingRef.current);
    }

    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/check-status?id=${order.orderId}`);
        const data = await res.json();
        if (data?.status === 'paid') {
          setStatus('paid');
          setOrder(prev => ({ ...prev, status: 'paid' }));
          setModals({ invoice: false, receipt: true, expired: false });
          clearInterval(pollingRef.current);
          expiresAtRef.current = null; // Clear expiry
        } else if (data?.status === 'expired') {
          setStatus('expired');
          setModals({ invoice: false, receipt: false, expired: true });
          clearInterval(pollingRef.current);
          expiresAtRef.current = null; // Clear expiry
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(pollingRef.current);
  }, [order, status]);

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
        console.error('Failed to generate QR code data URL in PaymentForm component:', err);
        setQrCodeDataUrl('');
      });
    } else {
      setQrCodeDataUrl('');
    }
  }, [order?.invoice]); // Regenerate QR code if invoice changes

  const resetAllModals = () => {
    setModals({ invoice: false, receipt: false, expired: false });
    setCopied(false);
    expiresAtRef.current = null; // Clear expiry timestamp
    clearInterval(pollingRef.current); // Ensure polling stops
    setError('');
    setQrCodeDataUrl(''); // Also clear QR code
  };

  const copyToClipboard = () => {
    const text = order?.invoice || '';
    if (!text) {
      setError('No invoice to copy');
      return;
    }
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(err => {
        console.error('Failed to copy:', err);
        setError('Failed to copy invoice to clipboard.');
    });
  };

  const isValidQRValue = value =>
    typeof value === 'string' &&
    value.trim().length > 10 && // Basic length check
    /^ln(bc|tb|bcrt)[0-9a-z]+$/i.test(value.trim()); // More robust lightning invoice regex

  const handleSubmit = async e => {
    e.preventDefault();
    setLoading(true);
    setError('');
    resetAllModals(); // Reset previous modals and states
    expiresAtRef.current = null; // Ensure no stale expiry time

    try {
      const res = await fetch('/api/create-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok || !data.invoice || !data.expiresAt) { // Ensure expiresAt is received
        throw new Error(data.message || 'Invoice generation failed. Missing data.');
      }
      if (typeof data.invoice !== 'string' || !isValidQRValue(data.invoice)) {
        console.error('Invalid invoice format received from API:', data.invoice);
        throw new Error('Received invalid invoice format from server.');
      }

      const newOrder = {
        ...form,
        invoice: data.invoice,
        orderId: data.orderId,
        btc: typeof data.btc === 'string' ? data.btc : '0.00000000',
        created: new Date().toISOString(),
        expiresAt: data.expiresAt, // Store the expiry timestamp
        status: 'pending',
      };
      setOrder(newOrder);
      setStatus('pending');
      expiresAtRef.current = data.expiresAt; // Update ref for new expiry
      setModals({ invoice: true, receipt: false, expired: false });

    } catch (err) {
      console.error('Handle submit error:', err);
      setError(err.message || 'An error occurred while generating the invoice.');
    } finally {
      setLoading(false);
    }
  };

  const shorten = str =>
    !str ? 'N/A' : str.length <= 14 ? str : `${str.slice(0, 8)}…${str.slice(-6)}`;

  return (
    <>
      <h2 className="card-subtitle text-center mb-md" style={{ color: 'var(--primary-green)' }}>Generate Your Payment Invoice</h2>
      <form onSubmit={handleSubmit} className="payment-form-layout">
        <div className="form-group">
          <label htmlFor="username">Username</label>
          <input
            id="username"
            className="input-field"
            name="username"
            value={form.username}
            onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
            required
            placeholder="Your in-game username"
          />
        </div>

        <div className="form-group">
          <label htmlFor="game">Select Game</label>
          <select
            id="game"
            className="select-field"
            name="game"
            value={form.game}
            onChange={e => setForm(f => ({ ...f, game: e.target.value }))}
            required
          >
            <option value="" disabled>Select a Game</option>
            {games.map(g => (
              <option key={g.id} value={g.name}>{g.name}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="amount">Amount (USD)</label>
          <input
            id="amount"
            className="input-field"
            type="number"
            min="1"
            step="0.01"
            name="amount"
            value={form.amount}
            onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
            required
            placeholder="e.g., 50.00"
          />
        </div>

        <div className="form-group">
          <label>Payment Method</label>
          <div className="radio-option-group">
            <label>
              <input
                type="radio"
                name="method"
                value="lightning"
                checked={form.method === 'lightning'}
                onChange={e => setForm(f => ({ ...f, method: e.target.value }))}
              />
              Lightning (Instant)
            </label>
          </div>
        </div>

        <div className="button-group">
          <button className="btn btn-primary" type="submit" disabled={loading || !form.username || !form.game || !form.amount}>
            {loading ? 'Generating Invoice...' : 'Generate Invoice'}
          </button>
        </div>
      </form>

      {error && <div className="alert alert-danger mt-md">{error}</div>}

      {/* Render Modals here, passing necessary props */}
      {modals.invoice && (
        <InvoiceModal
          order={order}
          expiresAt={expiresAtRef.current} // Pass the expiresAt timestamp
          setCopied={setCopied}
          copied={copied}
          resetModals={resetAllModals}
          qrCodeDataUrl={qrCodeDataUrl} // Pass the generated QR code URL
          isValidQRValue={isValidQRValue}
        />
      )}

      {modals.expired && (
        <ExpiredModal resetModals={resetAllModals} />
      )}

      {modals.receipt && order && (
        <ReceiptModal
          order={order}
          resetModals={resetAllModals}
          shorten={shorten}
        />
      )}
    </>
  );
}