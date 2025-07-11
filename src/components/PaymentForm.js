// src/components/PaymentForm.js
import React, { useState, useEffect, useRef } from 'react';
import { db } from '../lib/firebaseClient';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';

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
  const [modals, setModals] = useState({ invoice: false, receipt: false, expired: false, pyusdInvoice: false, pyusdReceipt: false });

  const pollingRef = useRef(null);

  useEffect(() => {
    const loadGames = async () => {
      try {
        const q = query(collection(db, 'games'), orderBy('name'));
        const snap = await getDocs(q);
        setGames(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (err) {
        console.error('Failed to load games:', err);
        setError('Could not load game list. Please refresh.');
      }
    };
    loadGames();
  }, []);

  useEffect(() => {
    if (!order || status !== 'pending' || form.method !== 'lightning') {
      clearInterval(pollingRef.current);
      return;
    }
    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/check-status?id=${order.orderId}`);
        const data = await res.json();
        if (data?.status === 'paid') {
          setStatus('paid');
          setModals({ invoice: false, receipt: true });
          clearInterval(pollingRef.current);
        } else if (data?.status === 'expired') {
          setStatus('expired');
          setModals({ invoice: false, expired: true });
          clearInterval(pollingRef.current);
        }
      } catch (err) { console.error('Polling error:', err); }
    }, 3000);
    return () => clearInterval(pollingRef.current);
  }, [order, status, form.method]);

  const resetAllModals = () => {
    setModals({ invoice: false, receipt: false, expired: false, pyusdInvoice: false, pyusdReceipt: false });
    clearInterval(pollingRef.current);
    setError('');
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setLoading(true);
    setError('');
    resetAllModals();

    const apiEndpoint = form.method === 'lightning' ? '/api/create-payment' : '/api/pyusd/create-deposit';
    try {
      const res = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to generate payment details.');

      if (form.method === 'lightning') {
        const newOrder = { ...form, invoice: data.invoice, orderId: data.orderId, btc: data.btc, expiresAt: data.expiresAt, status: 'pending' };
        setOrder(newOrder);
        setStatus('pending');
        setModals({ invoice: true });
      } else { // PYUSD
        if (!data.depositAddress || !data.memo) throw new Error('Deposit address or memo missing from response.');
        
        const newOrder = { 
            ...form, 
            depositAddress: data.depositAddress, 
            depositId: data.depositId, 
            memo: data.memo,
            status: 'pending' 
        };
        setOrder(newOrder);
        setStatus('pending');
        setModals({ pyusdInvoice: true });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="payment-form-container">
          <h2 className="payment-form-title">Top Up Your Account</h2>
          <form onSubmit={handleSubmit}>
              <div className="form-grid">
                  <div className="form-group">
                      <label htmlFor="username">Username</label>
                      <input id="username" className="input" name="username" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} required placeholder="Your in-game username"/>
                  </div>
                  <div className="form-group">
                      <label htmlFor="game">Select Game</label>
                      <select id="game" className="select" name="game" value={form.game} onChange={e => setForm(f => ({ ...f, game: e.target.value }))} required>
                          <option value="" disabled>Select a Game</option>
                          {games.map(g => (<option key={g.id} value={g.name}>{g.name}</option>))}
                      </select>
                  </div>
              </div>

              <div className="form-group">
                  <label>Payment Method</label>
                  <div className="payment-method-group">
                      <label className={`payment-method-card ${form.method === 'lightning' ? 'selected' : ''}`}>
                          <input type="radio" name="method" value="lightning" checked={form.method === 'lightning'} onChange={e => setForm(f => ({ ...f, method: e.target.value }))} />
                          <div className="method-card-content">
                              <span className="method-card-icon">⚡</span>
                              <span className="method-card-title">Lightning</span>
                              <span className="method-card-desc">Instant & Anonymous</span>
                          </div>
                      </label>
                      <label className={`payment-method-card ${form.method === 'pyusd' ? 'selected' : ''}`}>
                          <input type="radio" name="method" value="pyusd" checked={form.method === 'pyusd'} onChange={e => setForm(f => ({ ...f, method: e.target.value }))} />
                          <div className="method-card-content">
                              <span className="method-card-icon">🅿️</span>
                              <span className="method-card-title">PYUSD</span>
                              <span className="method-card-desc">PayPal / Venmo</span>
                          </div>
                      </label>
                  </div>
              </div>

              <div className="form-group">
                  <label htmlFor="amount">Amount (USD)</label>
                  <input id="amount" className="input" type="number" min="1" step="0.01" name="amount" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required placeholder="e.g., 50.00"/>
              </div>

              <button className="btn btn-primary btn-full-width mt-lg" type="submit" disabled={loading || !form.username || !form.game || !form.amount}>
                  {loading ? 'Processing...' : 'Proceed to Payment'}
              </button>
          </form>
          {error && <div className="alert alert-danger mt-md">{error}</div>}
      </div>

      {/* --- Modals remain unchanged --- */}
      {modals.invoice && (<InvoiceModal order={order} expiresAt={order.expiresAt} resetModals={resetAllModals} />)}
      {modals.expired && <ExpiredModal resetModals={resetAllModals} />}
      {modals.receipt && <ReceiptModal order={order} resetModals={resetAllModals} />}
      {modals.pyusdInvoice && (<PYUSDInvoiceModal order={order} resetModals={resetAllModals} onPaymentSuccess={() => { setModals({ pyusdInvoice: false, pyusdReceipt: true }); setStatus('completed'); }} />)}
      {modals.pyusdReceipt && (<PYUSDReceiptModal order={order} resetModals={resetAllModals} />)}
    </>
  );
}