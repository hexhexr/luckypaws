// src/components/PaymentForm.js
import React, { useState, useEffect, useRef } from 'react';
import { db } from '../lib/firebaseClient';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';

// Import Modals
import InvoiceModal from './InvoiceModal';
import ExpiredModal from './ExpiredModal';
import ReceiptModal from './ReceiptModal';
import PYUSDInvoiceModal from './PYUSDInvoiceModal'; // New
import PYUSDReceiptModal from './PYUSDReceiptModal'; // New

export default function PaymentForm() {
  // Default payment method is now 'lightning'
  const [form, setForm] = useState({ username: '', game: '', amount: '', method: 'lightning' });
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(false);
  const [order, setOrder] = useState(null);
  const [status, setStatus] = useState('idle'); // idle, pending, paid, expired
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  // Add new modal states for PYUSD
  const [modals, setModals] = useState({ invoice: false, receipt: false, expired: false, pyusdInvoice: false, pyusdReceipt: false });

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

  // This polling is for Lightning only, PYUSD polling is in its own modal
  useEffect(() => {
    if (!order || status !== 'pending' || form.method !== 'lightning') {
      clearInterval(pollingRef.current);
      return;
    }
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
        } else if (data?.status === 'expired') {
          setStatus('expired');
          setModals({ invoice: false, receipt: false, expired: true });
          clearInterval(pollingRef.current);
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 3000);

    return () => clearInterval(pollingRef.current);
  }, [order, status, form.method]);

  const resetAllModals = () => {
    setModals({ invoice: false, receipt: false, expired: false, pyusdInvoice: false, pyusdReceipt: false });
    setCopied(false);
    expiresAtRef.current = null;
    clearInterval(pollingRef.current);
    setError('');
  };

  const isValidQRValue = value =>
    typeof value === 'string' &&
    value.trim().length > 10 &&
    /^ln(bc|tb|bcrt)[0-9a-z]+$/i.test(value.trim());

  const handleSubmit = async e => {
    e.preventDefault();
    setLoading(true);
    setError('');
    resetAllModals();

    if (form.method === 'lightning') {
      // --- Existing Lightning Logic ---
      try {
        const res = await fetch('/api/create-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
        const data = await res.json();
        if (!res.ok || !data.invoice) throw new Error(data.message || 'Invoice generation failed.');
        if (typeof data.invoice !== 'string' || !isValidQRValue(data.invoice)) {
            throw new Error('Received invalid invoice format from server.');
        }

        const newOrder = { ...form, invoice: data.invoice, orderId: data.orderId, btc: data.btc, expiresAt: data.expiresAt, status: 'pending' };
        setOrder(newOrder);
        setStatus('pending');
        expiresAtRef.current = data.expiresAt;
        setModals({ invoice: true });
      } catch (err) {
        setError(err.message || 'An error occurred.');
      } finally {
        setLoading(false);
      }
    } else if (form.method === 'pyusd') {
      // --- New PYUSD Logic ---
      try {
        const res = await fetch('/api/pyusd/create-deposit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(form),
        });
        const data = await res.json();
        if (!res.ok || !data.depositAddress || !data.depositId) {
            throw new Error(data.message || 'PYUSD deposit address generation failed.');
        }

        const newOrder = { ...form, depositAddress: data.depositAddress, depositId: data.depositId, status: 'pending' };
        setOrder(newOrder);
        setStatus('pending');
        setModals({ pyusdInvoice: true });

      } catch (err) {
        setError(err.message || 'An error occurred.');
      } finally {
        setLoading(false);
      }
    }
  };

  const shorten = str => !str ? 'N/A' : str.length <= 14 ? str : `${str.slice(0, 8)}…${str.slice(-6)}`;

  return (
    <div className="payment-form-card">
        <h2 className="card-subtitle text-center mb-md" style={{ color: 'var(--primary-green)' }}>Generate Your Payment Invoice</h2>
        <form onSubmit={handleSubmit} className="payment-form-grid">
            <div className="form-group">
                <label htmlFor="username">Username</label>
                <input id="username" className="input-field" name="username" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} required placeholder="Your in-game username" />
            </div>

            <div className="form-group">
                <label htmlFor="game">Select Game</label>
                <select id="game" className="select" name="game" value={form.game} onChange={e => setForm(f => ({ ...f, game: e.target.value }))} required>
                    <option value="" disabled>Select a Game</option>
                    {games.map(g => (<option key={g.id} value={g.name}>{g.name}</option>))}
                </select>
            </div>

            <div className="form-group">
                <label htmlFor="amount">Amount (USD)</label>
                <input id="amount" className="input-field" type="number" min="1" step="0.01" name="amount" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required placeholder="e.g., 50.00" />
            </div>

            <div className="form-group">
                <label>Payment Method</label>
                <div className="radio-option-group">
                    <label className="radio-label">
                        <input type="radio" name="method" value="lightning" checked={form.method === 'lightning'} onChange={e => setForm(f => ({ ...f, method: e.target.value }))} />
                        <span className="icon-inline">⚡</span> Lightning (Instant)
                    </label>
                    <label className="radio-label">
                        <input type="radio" name="method" value="pyusd" checked={form.method === 'pyusd'} onChange={e => setForm(f => ({ ...f, method: e.target.value }))} />
                        <span className="icon-inline">🅿️</span> PYUSD (PayPal/Venmo)
                    </label>
                </div>
            </div>

            <button className="btn btn-primary btn-full-width" type="submit" disabled={loading || !form.username || !form.game || !form.amount}>
                {loading ? 'Generating...' : form.method === 'lightning' ? 'Generate Invoice' : 'Get Deposit Address'}
            </button>
        </form>

      {error && <div className="alert alert-danger mt-md">{error}</div>}

      {modals.invoice && (<InvoiceModal order={order} expiresAt={expiresAtRef.current} setCopied={setCopied} copied={copied} resetModals={resetAllModals} isValidQRValue={isValidQRValue} />)}
      {modals.expired && <ExpiredModal resetModals={resetAllModals} />}
      {modals.receipt && order && (<ReceiptModal order={order} resetModals={resetAllModals} shorten={shorten} />)}

      {/* --- New PYUSD Modals --- */}
      {modals.pyusdInvoice && (
        <PYUSDInvoiceModal
          order={order}
          resetModals={resetAllModals}
          onPaymentSuccess={() => {
            setModals({ pyusdReceipt: true });
            setStatus('paid');
          }}
        />
      )}
      {modals.pyusdReceipt && order && (<PYUSDReceiptModal order={order} resetModals={resetAllModals} />)}
    </div>
  );
}