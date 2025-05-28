// src/components/PaymentForm.js
import React, { useState, useEffect, useRef } from 'react';
import { db } from '../lib/firebaseClient'; // Make sure this path is correct

// Import Modals
import InvoiceModal from './InvoiceModal';
import ExpiredModal from './ExpiredModal'; // Make sure this matches your filename
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
  const [countdown, setCountdown] = useState(600); // 10 minutes

  const timerRef = useRef(null);
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
    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/check-status?id=${order.orderId}`);
        const data = await res.json();
        if (data?.status === 'paid') {
          setStatus('paid');
          setOrder(prev => ({ ...prev, status: 'paid' }));
          setModals({ invoice: false, receipt: true, expired: false });
          clearInterval(pollingRef.current);
          clearInterval(timerRef.current);
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 2000);
    return () => clearInterval(pollingRef.current);
  }, [order, status]);

  // Timer logic for invoice expiration
  useEffect(() => {
    if (!modals.invoice || status !== 'pending') {
      clearInterval(timerRef.current);
      return;
    }
    setCountdown(600); // Reset countdown on modal open
    timerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          setStatus('expired');
          setModals({ invoice: false, receipt: false, expired: true });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [modals.invoice, status]);

  const resetAllModals = () => {
    setModals({ invoice: false, receipt: false, expired: false });
    setCopied(false);
    clearInterval(timerRef.current);
    clearInterval(pollingRef.current);
    setError(''); // Clear any lingering errors
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setLoading(true);
    setError('');
    resetAllModals(); // Reset all modals before a new submission

    try {
      const res = await fetch('/api/create-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok || !data.invoice) {
        throw new Error(data.message || 'Invoice generation failed. No invoice data received.');
      }
      if (typeof data.invoice !== 'string' || !/^ln(bc|tb|bcrt)[0-9a-z]+$/i.test(data.invoice.trim())) {
        console.error('Invalid invoice format received from API:', data.invoice);
        throw new Error('Received invalid invoice format from server.');
      }

      const newOrder = {
        ...form,
        invoice: data.invoice,
        orderId: data.orderId,
        btc: typeof data.btc === 'string' ? data.btc : '0.00000000',
        created: new Date().toISOString(),
        status: 'pending',
      };
      setOrder(newOrder);
      setStatus('pending');
      setModals({ invoice: true, receipt: false, expired: false });
    } catch (err) {
      console.error('Handle submit error:', err);
      setError(err.message || 'An error occurred while generating the invoice.');
    } finally {
      setLoading(false);
    }
  };

  // Utility function for shortening invoice text in ReceiptModal
  const shorten = str =>
    !str ? 'N/A' : str.length <= 14 ? str : `${str.slice(0, 8)}…${str.slice(-6)}`;


  return (
    <div className="card-body">
      <h2 className="card-subtitle text-center mb-md" style={{ color: 'var(--green-dark)' }}>Generate Your Payment Invoice</h2>
      <form onSubmit={handleSubmit}>
        <label htmlFor="username">Username</label>
        <input
          id="username"
          className="input"
          name="username"
          value={form.username}
          onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
          required
          placeholder="Your in-game username"
        />
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
        <label htmlFor="amount">Amount (USD)</label>
        <input
          id="amount"
          className="input"
          type="number"
          min="1"
          step="0.01"
          name="amount"
          value={form.amount}
          onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
          required
          placeholder="e.g., 50.00"
        />
        <label>Payment Method</label>
        <div className="radio-group">
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
        <button className="btn btn-primary" type="submit" disabled={loading || !form.username || !form.game || !form.amount}>
          {loading ? 'Generating Invoice...' : 'Generate Invoice'}
        </button>
      </form>
      {error && <div className="alert alert-danger mt-md">{error}</div>}

      {/* Render Modals here, passing necessary props */}
      {modals.invoice && (
        <InvoiceModal
          order={order}
          countdown={countdown}
          setCopied={setCopied}
          copied={copied}
          resetModals={resetAllModals}
        />
      )}

      {modals.expired && (
        <ExpiredModal resetModals={resetAllModals} />
      )}

      {modals.receipt && order && (
        <ReceiptModal
          order={order}
          resetModals={resetAllModals}
          shorten={shorten} // Pass the utility function
        />
      )}
    </div>
  );
}