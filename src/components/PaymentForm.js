// src/components/PaymentForm.js
import React, { useState, useEffect, useRef } from 'react';
import { db } from '../lib/firebaseClient';
import QRCodeLib from 'qrcode';
// Import Icons (example using React Icons)
import { FaLightningBolt, FaBitcoin, FaSpinner } from 'react-icons/fa'; // Assuming you install react-icons
// Import Modals
import InvoiceModal from './InvoiceModal';
import ExpiredModal from './ExpiredModal';
import ReceiptModal from './ReceiptModal';
import QRErrorBoundary from './QRErrorBoundary';

export default function PaymentForm() {
  const [form, setForm] = useState({ username: '', game: '', amount: '', method: 'lightning' });
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(false);
  const [order, setOrder] = useState(null);
  const [status, setStatus] = useState('idle'); // idle, pending, paid, expired
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [modals, setModals] = useState({ invoice: false, receipt: false, expired: false });

  const expiresAtRef = useRef(null);
  const pollingRef = useRef(null);

  useEffect(() => {
    const loadGames = async () => {
      try {
        const snap = await db.collection('games').orderBy('name').get();
        setGames(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (err) {
        console.error("Error loading games:", err);
        setError("Failed to load games. Please try again later."); // User-friendly error
      }
    };
    loadGames();
    return () => {
      // Cleanup any listeners if necessary
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); // Clear previous errors
    setLoading(true);

    // Basic client-side validation
    if (!form.username || !form.game || !form.amount) {
      setError("Please fill in all required fields.");
      setLoading(false);
      return;
    }
    const amountNum = parseFloat(form.amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError("Please enter a valid positive amount.");
      setLoading(false);
      return;
    }

    try {
      // Simulate API call for invoice generation
      const response = await fetch('/api/generateInvoice', { // Assuming you have an API route
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || 'Failed to generate invoice.');
      }

      const data = await response.json();
      setOrder(data.order);
      expiresAtRef.current = data.expiresAt;
      setModals(m => ({ ...m, invoice: true }));
      setStatus('pending');

      // Start polling for payment status
      // You'll need to implement the actual polling logic here,
      // e.g., using setInterval to check Firebase/backend.
      // Example: pollingRef.current = setInterval(() => checkPaymentStatus(data.order.id), 5000);

    } catch (err) {
      console.error("Invoice generation error:", err);
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const selectPredefinedAmount = (amount) => {
    setForm(f => ({ ...f, amount: amount.toString() }));
  };

  // Helper for QR code validation (assuming it's used somewhere in your modals)
  const isValidQRValue = (value) => {
    try {
      QRCodeLib.toDataURL(value);
      return true;
    } catch (err) {
      return false;
    }
  };

  const resetAllModals = () => {
    setModals({ invoice: false, receipt: false, expired: false });
    setOrder(null);
    setError('');
    setStatus('idle');
    setCopied(false);
    if (pollingRef.current) clearInterval(pollingRef.current);
  };

  return (
    <section id="payment-form-section" className="section-padded payment-section-container">
      <div className="container">
        <div className="card payment-form-card"> {/* Added card class here */}
          <h2 className="section-title text-center mb-md">Top Up Your Balance</h2>
          <p className="section-subtitle text-center mb-lg">
            Instant deposits using Bitcoin Lightning Network.
          </p>

          {error && <div className="alert alert-danger mt-md mb-md">{error}</div>}

          <form onSubmit={handleSubmit} className="payment-form-grid"> {/* Apply grid for layout */}
            <div className="form-group">
              <label htmlFor="username">Your Game Username</label>
              <input
                type="text"
                id="username"
                className="input-field"
                placeholder="e.g., PlayerOne"
                value={form.username}
                onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="game">Select Game</label>
              <select
                id="game"
                className="input-field"
                value={form.game}
                onChange={e => setForm(f => ({ ...f, game: e.target.value }))}
                required
                disabled={games.length === 0} // Disable if games not loaded
              >
                <option value="">{games.length === 0 ? 'Loading games...' : 'Choose a game...'}</option>
                {games.map(game => (
                  <option key={game.id} value={game.id}>{game.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="amount">Amount (USD)</label>
              <input
                type="number"
                id="amount"
                className="input-field"
                placeholder="Minimum $10"
                value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                min="10" // Example minimum
                step="0.01"
                required
              />
              <div className="amount-suggestions mt-xs">
                <button type="button" className="btn btn-secondary btn-small mr-sm" onClick={() => selectPredefinedAmount(10)}>$10</button>
                <button type="button" className="btn btn-secondary btn-small mr-sm" onClick={() => selectPredefinedAmount(20)}>$20</button>
                <button type="button" className="btn btn-secondary btn-small" onClick={() => selectPredefinedAmount(50)}>$50</button>
              </div>
            </div>

            <div className="form-group">
              <label>Payment Method</label>
              <div className="radio-option-group">
                <label className="radio-label">
                  <input
                    type="radio"
                    name="method"
                    value="lightning"
                    checked={form.method === 'lightning'}
                    onChange={e => setForm(f => ({ ...f, method: e.target.value }))}
                  />
                  <FaLightningBolt className="icon-inline mr-xs" /> Lightning (Instant)
                </label>
                {/* Potentially add other methods here */}
                {/* <label className="radio-label">
                  <input type="radio" name="method" value="bitcoin" disabled />
                  <FaBitcoin className="icon-inline mr-xs" /> Bitcoin (On-chain) - Coming Soon
                </label> */}
              </div>
            </div>

            <div className="button-group text-center">
              <button
                className="btn btn-primary btn-large"
                type="submit"
                disabled={loading || !form.username || !form.game || !form.amount || parseFloat(form.amount) <= 0}
              >
                {loading ? (
                  <>
                    <FaSpinner className="icon-spin mr-sm" /> Generating Invoice...
                  </>
                ) : (
                  'Generate Invoice'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
      {/* Render Modals here */}
      {modals.invoice && (
        <InvoiceModal
          order={order}
          expiresAt={expiresAtRef.current}
          setCopied={setCopied}
          copied={copied}
          resetModals={resetAllModals}
          isValidQRValue={isValidQRValue}
        />
      )}
      {modals.expired && (<ExpiredModal resetModals={resetAllModals} />)}
      {modals.receipt && order && (<ReceiptModal order={order} resetModals={resetAllModals} />)}
    </section>
  );
}