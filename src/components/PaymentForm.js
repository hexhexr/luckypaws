// src/components/PaymentForm.js
import React, { useState, useEffect, useRef } from 'react';
import { db } from '../lib/firebaseClient';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { useRouter } from 'next/router';

import InvoiceModal from './InvoiceModal';
import PYUSDInvoiceModal from './PYUSDInvoiceModal';
import ExpiredModal from './ExpiredModal';
import ReceiptModal from './ReceiptModal';
import PYUSDReceiptModal from './PYUSDReceiptModal';

export default function PaymentForm() {
  const router = useRouter();
  // The 'card' value now represents all Paygate.to methods
  const [form, setForm] = useState({ username: '', game: '', amount: '', method: 'lightning', email: '' });
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
        setError('Could not load game list.');
      }
    };
    loadGames();
  }, []);

  const handleSubmit = async e => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (form.method === 'card' && !form.email) {
        setError('Email address is required for this payment method.');
        setLoading(false);
        return;
    }

    let apiEndpoint;
    switch (form.method) {
        case 'lightning': apiEndpoint = '/api/create-payment'; break;
        case 'pyusd': apiEndpoint = '/api/pyusd/create-deposit'; break;
        case 'card': apiEndpoint = '/api/paygate/create-payment'; break; // Updated to use 'card'
        default:
            setError('Please select a valid payment method.');
            setLoading(false);
            return;
    }

    try {
      const res = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Pass a generic 'card' method to the backend for Paygate
        body: JSON.stringify({ ...form, method: 'card' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to generate payment details.');

      if (form.method === 'lightning' || form.method === 'pyusd') {
        if (form.method === 'lightning') {
            setOrder({ ...form, ...data, status: 'pending' });
            setModals({ invoice: true });
        } else {
            setOrder({ ...form, ...data, status: 'pending' });
            setModals({ pyusdInvoice: true });
        }
      } else {
        window.location.href = data.paymentUrl;
      }
    } catch (err) {
      setError(err.message);
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
              
              {/* This will now show if the single 'card' option is selected */}
              {form.method === 'card' && (
                <div className="form-group">
                    <label htmlFor="email">Your Email</label>
                    <input id="email" className="input" name="email" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required placeholder="Required for card payments"/>
                </div>
              )}

              <div className="form-group">
                  <label>Payment Method</label>
                  <div className="payment-method-group">
                      <label className={`payment-method-card ${form.method === 'lightning' ? 'selected' : ''}`}>
                          <input type="radio" name="method" value="lightning" checked={form.method === 'lightning'} onChange={e => setForm(f => ({ ...f, method: e.target.value }))} />
                          <div className="method-card-content">
                              <span className="method-card-icon">⚡</span> <span className="method-card-title">Lightning</span> <span className="method-card-desc">Instant & Anonymous</span>
                          </div>
                      </label>
                       <label className={`payment-method-card ${form.method === 'pyusd' ? 'selected' : ''}`}>
                          <input type="radio" name="method" value="pyusd" checked={form.method === 'pyusd'} onChange={e => setForm(f => ({ ...f, method: e.target.value }))} />
                          <div className="method-card-content">
                              <span className="method-card-icon">🅿️</span> <span className="method-card-title">PYUSD</span> <span className="method-card-desc">PayPal / Venmo</span>
                          </div>
                      </label>
                      {/* --- NEW UNIFIED CARD OPTION --- */}
                      <label className={`payment-method-card ${form.method === 'card' ? 'selected' : ''}`}>
                          <input type="radio" name="method" value="card" checked={form.method === 'card'} onChange={e => setForm(f => ({ ...f, method: e.target.value }))} />
                          <div className="method-card-content">
                              <span className="method-card-icon">💳</span> <span className="method-card-title">Card / Wallets</span> <span className="method-card-desc">Google & Apple Pay</span>
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

      {/* --- ALL MODALS REMAIN UNCHANGED --- */}
      {modals.invoice && (<InvoiceModal order={order} expiresAt={order.expiresAt} resetModals={() => setModals({invoice: false})} />)}
      {modals.expired && <ExpiredModal resetModals={() => setModals({expired: false})} />}
      {modals.receipt && <ReceiptModal order={order} resetModals={() => setModals({receipt: false})} />}
      {modals.pyusdInvoice && (<PYUSDInvoiceModal order={order} resetModals={() => setModals({pyusdInvoice: false})} onPaymentSuccess={() => { setModals({ pyusdInvoice: false, pyusdReceipt: true }); setStatus('completed'); }} />)}
      {modals.pyusdReceipt && (<PYUSDReceiptModal order={order} resetModals={() => setModals({pyusdReceipt: false})} />)}
    </>
  );
}