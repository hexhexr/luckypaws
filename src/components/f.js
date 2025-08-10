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

    if (form.method !== 'coinbase') {
        let apiEndpoint;
        switch (form.method) {
            case 'lightning': apiEndpoint = '/api/create-payment'; break;
            case 'pyusd': apiEndpoint = '/api/pyusd/create-deposit'; break;
            case 'card': apiEndpoint = '/api/paygate/create-payment'; break;
            default:
                setError('Please select a valid payment method.');
                setLoading(false);
                return;
        }

        try {
            const res = await fetch(apiEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to generate payment details.');

            if (form.method === 'card') {
                window.location.href = data.paymentUrl;
            } else {
                if (form.method === 'lightning') {
                    setOrder({ ...form, ...data, status: 'pending' });
                    setModals({ invoice: true });
                } else { // PYUSD
                    setOrder({ ...form, ...data, status: 'pending' });
                    setModals({ pyusdInvoice: true });
                }
            }
        } catch (err) {
            setError(err.message);
            setLoading(false);
        }
    } else {
        try {
            const res = await fetch('/api/orders/create-pending', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: form.username,
                    game: form.game,
                    amount: form.amount,
                    method: 'coinbase'
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message);

            const checkoutUrl = new URL(process.env.NEXT_PUBLIC_CHECKOUT_WEBSITE_URL + '/checkout');
            checkoutUrl.searchParams.append('orderId', data.orderId);
            checkoutUrl.searchParams.append('amount', form.amount);
            checkoutUrl.searchParams.append('username', form.username);
            
            window.location.href = checkoutUrl.toString();

        } catch (err) {
            setError(err.message);
            setLoading(false);
        }
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
                              <span className="method-card-icon">⚡</span> <span className="method-card-title">Bitcoin Lightning</span> <span className="method-card-desc">Cash App, etc.</span>
                          </div>
                      </label>
                       <label className={`payment-method-card ${form.method === 'pyusd' ? 'selected' : ''}`}>
                          <input type="radio" name="method" value="pyusd" checked={form.method === 'pyusd'} onChange={e => setForm(f => ({ ...f, method: e.target.value }))} />
                          <div className="method-card-content">
                              <span className="method-card-icon">🅿️</span> <span className="method-card-title">PYUSD</span> <span className="method-card-desc">PayPal / Venmo</span>
                          </div>
                      </label>
                      
                      {/* --- PAYGATE AND COINBASE OPTIONS ARE HIDDEN --- */}
                      {/*
                      <label className={`payment-method-card ${form.method === 'card' ? 'selected' : ''}`}>
                          <input type="radio" name="method" value="card" checked={form.method === 'card'} onChange={e => setForm(f => ({ ...f, method: e.target.value }))} />
                          <div className="method-card-content">
                              <span className="method-card-icon">💳</span> <span className="method-card-title">Card / Wallets</span> <span className="method-card-desc">Paygate</span>
                          </div>
                      </label>
                      <label className={`payment-method-card ${form.method === 'coinbase' ? 'selected' : ''}`}>
                          <input type="radio" name="method" value="coinbase" checked={form.method === 'coinbase'} onChange={e => setForm(f => ({ ...f, method: e.target.value }))} />
                          <div className="method-card-content">
                              <span className="method-card-icon"> G</span> <span className="method-card-title">Apple/Google Pay</span> <span className="method-card-desc">via Coinbase</span>
                          </div>
                      </label>
                      */}
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

      <InvoiceModal order={order} expiresAt={order?.expiresAt} resetModals={() => setModals({invoice: false})} />
      <ExpiredModal resetModals={() => setModals({expired: false})} />
      <ReceiptModal order={order} resetModals={() => setModals({receipt: false})} />
      <PYUSDInvoiceModal order={order} resetModals={() => setModals({pyusdInvoice: false})} onPaymentSuccess={() => { setModals({ pyusdInvoice: false, pyusdReceipt: true }); setStatus('completed'); }} />
      <PYUSDReceiptModal order={order} resetModals={() => setModals({pyusdReceipt: false})} />
    </>
  );
}