// src/components/PaymentForm.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { db } from '../lib/firebaseClient';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';

// Import ALL required modals
import InvoiceModal from './InvoiceModal';
import PYUSDInvoiceModal from './PYUSDInvoiceModal';
import ExpiredModal from './ExpiredModal';
import ReceiptModal from './ReceiptModal';
import PYUSDReceiptModal from './PYUSDReceiptModal';

export default function PaymentForm() {
  const [form, setForm] = useState({ username: '', game: '', amount: '', method: 'lightning' });
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(false);
  const [order, setOrder] = useState(null);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
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

  // This polling logic is ONLY for Lightning payments.
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
        // This uses the original check-status for lightning invoices
        const res = await fetch(`/api/check-status?id=${order.orderId}`);
        const data = await res.json();
        
        if (data?.status === 'paid') {
          setStatus('paid');
          setOrder(prev => ({ ...prev, status: 'paid' }));
          setModals({ invoice: false, receipt: true, expired: false, pyusdInvoice: false, pyusdReceipt: false });
          clearInterval(pollingRef.current);
        } else if (data?.status === 'expired') {
          setStatus('expired');
          setModals({ invoice: false, receipt: false, expired: true, pyusdInvoice: false, pyusdReceipt: false });
          clearInterval(pollingRef.current);
        }
      } catch (err) {
        console.error('Lightning polling error:', err);
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
      try {
        const res = await fetch('/api/create-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
        const data = await res.json();
        if (!res.ok || !data.invoice) {
          throw new Error(data.message || 'Invoice generation failed.');
        }

        const newOrder = { ...form, invoice: data.invoice, orderId: data.orderId, btc: data.btc, expiresAt: data.expiresAt, status: 'pending' };
        setOrder(newOrder);
        setStatus('pending');
        setModals({ invoice: true });

      } catch (err) {
        setError(err.message || 'An error occurred generating the Lightning invoice.');
      } finally {
        setLoading(false);
      }
    } else if (form.method === 'pyusd') {
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

        const newOrder = { ...form, depositAddress: data.depositAddress, orderId: data.depositId, status: 'pending' };
        setOrder(newOrder);
        setStatus('pending');
        setModals({ pyusdInvoice: true });

      } catch (err) {
        setError(err.message || 'An error occurred generating the PYUSD deposit address.');
      } finally {
        setLoading(false);
      }
    }
  };
  
  const handlePymtSuccess = useCallback(() => {
    setModals({ invoice: false, receipt: false, expired: false, pyusdInvoice: false, pyusdReceipt: true });
    setStatus('paid');
  }, []);


  const shorten = str =>
    !str ? 'N/A' : str.length <= 14 ? str : `${str.slice(0, 8)}…${str.slice(-6)}`;

  return (
    <div className="payment-form-card">
        <h2 className="card-subtitle text-center mb-md" style={{ color: 'var(--primary-green)' }}>Generate Your Payment Invoice</h2>
        <form onSubmit={handleSubmit} className="payment-form-grid">
            <div className="form-group">
                <label htmlFor="username">Username</label>
                <input id="username" className="input-field" name="username" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} required placeholder="Your in-game username"/>
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
                <input id="amount" className="input-field" type="number" min="1" step="0.01" name="amount" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required placeholder="e.g., 50.00"/>
            </div>

            <div className="form-group">
                <label>Payment Method</label>
                <div className="radio-option-group">
                    <label className="radio-label">
                        <input type="radio" name="method" value="lightning" checked={form.method === 'lightning'} onChange={e => setForm(f => ({ ...f, method: e.target.value }))} />
                        <span className="icon-inline">⚡</span>
                        Lightning (Instant)
                    </label>
                    <label className="radio-label">
                        <input type="radio" name="method" value="pyusd" checked={form.method === 'pyusd'} onChange={e => setForm(f => ({ ...f, method: e.target.value }))} />
                        <span className="icon-inline">🅿️</span>
                        PYUSD (PayPal/Venmo)
                    </label>
                </div>
            </div>

            <button className="btn btn-primary btn-full-width" type="submit" disabled={loading || !form.username || !form.game || !form.amount}>
                {loading ? 'Generating...' : form.method === 'lightning' ? 'Generate Invoice' : 'Get Deposit Address'}
            </button>
        </form>

      {error && <div className="alert alert-danger mt-md">{error}</div>}

      {modals.invoice && (<InvoiceModal order={order} expiresAt={order?.expiresAt} setCopied={setCopied} copied={copied} resetModals={resetAllModals} isValidQRValue={isValidQRValue} />)}
      {modals.expired && <ExpiredModal resetModals={resetAllModals} />}
      {modals.receipt && form.method === 'lightning' && (<ReceiptModal order={order} resetModals={resetAllModals} shorten={shorten} />)}
      
      {modals.pyusdInvoice && (
        <PYUSDInvoiceModal
          order={order}
          resetModals={resetAllModals}
          onPaymentSuccess={handlePymtSuccess}
        />
      )}
      {modals.pyusdReceipt && order && (<PYUSDReceiptModal order={order} resetModals={resetAllModals} />)}
    </div>
  );
}