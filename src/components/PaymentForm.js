// src/components/PaymentForm.js
import React, { useState, useEffect, useRef } from 'react';
import { db } from '../lib/firebaseClient';
import { collection, getDocs, orderBy } from 'firebase/firestore';

// Import Modals
import InvoiceModal from './InvoiceModal';
import ExpiredModal from './ExpiredModal';
import ReceiptModal from './ReceiptModal';

export default function PaymentForm() {
  const [form, setForm] = useState({ username: '', game: '', amount: '', method: 'lightning' });
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(false);
  const [order, setOrder] = useState(null);
  const [status, setStatus] = useState('idle'); // idle, pending, paid, expired
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [modals, setModals] = useState({ invoice: false, receipt: false, expired: false });

  // Use a ref to store the expiresAt timestamp for more reliable countdown
  const expiresAtRef = useRef(null);
  const pollingRef = useRef(null);

  useEffect(() => {
    const loadGames = async () => {
      try {
        const gamesCollection = collection(db, 'games');
        const q = query(gamesCollection, orderBy('name'));
        const snap = await getDocs(q);
        setGames(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (err) {
        console.error('Error loading games:', err);
        setError('Failed to load games');
      }
    };
    loadGames();
  }, []);

  // Polling useEffect for status updates
  useEffect(() => {
    if (!order || status !== 'pending') {
      clearInterval(pollingRef.current); // Ensure polling stops if not in pending state
      return;
    }

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

    return () => clearInterval(pollingRef.current); // Cleanup
  }, [order, status]); // Dependencies: re-run if order or overall status changes

  const resetAllModals = () => {
    setModals({ invoice: false, receipt: false, expired: false });
    setCopied(false);
    expiresAtRef.current = null; // Clear expiry timestamp
    clearInterval(pollingRef.current); // Ensure polling stops
    setError('');
    // Optionally reset form if you want the user to start fresh
    // setForm({ username: '', game: '', amount: '', method: 'lightning' });
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
    <div className="payment-form-card">
        <h2 className="card-subtitle text-center mb-md" style={{ color: 'var(--primary-green)' }}>Generate Your Payment Invoice</h2>
        <form onSubmit={handleSubmit} className="payment-form-grid">
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
                    className="select"
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
                    <label className="radio-label">
                        <input
                            type="radio"
                            name="method"
                            value="lightning"
                            checked={form.method === 'lightning'}
                            onChange={e => setForm(f => ({ ...f, method: e.target.value }))}
                        />
                        <span className="icon-inline">⚡</span>
                        Lightning (Instant)
                    </label>
                </div>
            </div>

            <button className="btn btn-primary btn-full-width" type="submit" disabled={loading || !form.username || !form.game || !form.amount}>
                {loading ? 'Generating...' : 'Generate Invoice'}
            </button>
        </form>

      {error && <div className="alert alert-danger mt-md">{error}</div>}

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

      {modals.expired && <ExpiredModal resetModals={resetAllModals} />}

      {modals.receipt && order && (
        <ReceiptModal order={order} resetModals={resetAllModals} shorten={shorten} />
      )}
    </div>
  );
}