import { useState, useEffect } from 'react';
import QRCode from 'react-qr-code';
import { db } from '../lib/firebaseClient';

export default function Home() {
  const [form, setForm] = useState({ username: '', game: '', amount: '', method: 'lightning' });
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(false);
  const [order, setOrder] = useState(null);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [showExpiredModal, setShowExpiredModal] = useState(false);
  const [countdown, setCountdown] = useState(600);

  useEffect(() => {
    const loadGames = async () => {
      const snap = await db.collection('games').orderBy('name').get();
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setGames(list);
    };
    loadGames();
  }, []);

  const handleChange = e => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setShowInvoiceModal(false);
    setShowReceiptModal(false);
    setShowExpiredModal(false);

    try {
      const res = await fetch('/api/create-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      let data;
      try {
        data = await res.json();
      } catch (parseErr) {
        const fallback = await res.text();
        throw new Error(`Invalid JSON: ${fallback}`);
      }

      if (!res.ok) {
        throw new Error(data.message || 'Payment request failed');
      }

      setOrder({ ...data, ...form, created: new Date().toISOString() });
      setShowInvoiceModal(true);
      setStatus('pending');
      setCountdown(600);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Payment error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!order || status !== 'pending') return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/check-status?id=${order.orderId}`);
        const upd = await res.json();
        if (upd?.status === 'paid') {
          setStatus('paid');
          setOrder(prev => ({ ...prev, status: 'paid' }));
          setShowInvoiceModal(false);
          setShowReceiptModal(true);
          clearInterval(interval);
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [order, status]);

  useEffect(() => {
    if (!showInvoiceModal) return;
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          setShowInvoiceModal(false);
          setShowExpiredModal(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [showInvoiceModal]);

  const formatTime = sec => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
  const copyToClipboard = () => {
    navigator.clipboard.writeText(order.invoice || order.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const resetAll = () => {
    setForm({ username: '', game: '', amount: '', method: 'lightning' });
    setOrder(null);
    setStatus('idle');
    setError('');
    setShowInvoiceModal(false);
    setShowReceiptModal(false);
    setShowExpiredModal(false);
    setCountdown(0);
  };
  const shorten = str => str ? `${str.slice(0, 8)}…${str.slice(-6)}` : '';

  return (
    <div className="container mt-lg">
      <div className="card">
        <h1 className="card-header text-center">🎣 Lucky Paw’s Fishing Room</h1>
        <div className="card-body">
          <form onSubmit={handleSubmit}>
            <label>Username</label>
            <input className="input" name="username" value={form.username} onChange={handleChange} required placeholder="Your username" />

            <label>Select Game</label>
            <select className="select" name="game" value={form.game} onChange={handleChange} required>
              <option value="" disabled>Select Game</option>
              {games.map(g => (
                <option key={g.id} value={g.name}>{g.name}</option>
              ))}
            </select>

            <label>Amount (USD)</label>
            <input className="input" type="number" name="amount" value={form.amount} onChange={handleChange} required placeholder="Amount in USD" />

            <label>Payment Method</label>
            <div className="radio-group">
              <label><input type="radio" name="method" value="lightning" checked={form.method === 'lightning'} onChange={handleChange} /> Lightning</label>
              <label><input type="radio" name="method" value="onchain" checked={form.method === 'onchain'} onChange={handleChange} /> On-chain</label>
            </div>

            <button className="btn btn-primary" type="submit" disabled={loading}>
              {loading ? 'Generating…' : 'Generate Invoice'}
            </button>
          </form>

          {error && <div className="alert alert-danger mt-md">{error}</div>}
        </div>
      </div>

      {showInvoiceModal && order && (
        <div className="modal-overlay">
          <div className="modal">
            <h2 className="receipt-header">Send Payment</h2>
            <div className="receipt-amounts">
              <p className="usd-amount">${order.amount} USD</p>
              <p className="btc-amount">{order.btc || '0.00000000'} BTC</p>
            </div>
            <p className="text-center">Expires in: <strong>{formatTime(countdown)}</strong></p>
            <div className="qr-container"><QRCode value={order.invoice || order.address} size={140} /></div>
            <div className="scroll-box">{order.invoice || order.address}</div>
            <button className="btn btn-success mt-md" onClick={copyToClipboard}>
              {copied ? 'Copied!' : 'Copy Invoice'}
            </button>
          </div>
        </div>
      )}

      {showExpiredModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h2 className="receipt-header" style={{ color: '#d32f2f' }}>⚠️ Invoice Expired</h2>
            <p>The invoice has expired. Please generate a new one to continue.</p>
            <button className="btn btn-primary mt-md" onClick={resetAll}>Generate New</button>
          </div>
        </div>
      )}

      {showReceiptModal && order && (
        <div className="modal-overlay">
          <div className="modal receipt-modal">
            <h2 className="receipt-header">✅ Payment Received</h2>
            <div className="receipt-amounts">
              <p className="usd-amount"><strong>${order.amount}</strong> USD</p>
              <p className="btc-amount">{order.btc || '0.00000000'} BTC</p>
            </div>
            <div className="receipt-details">
              <p><strong>Username:</strong> {order.username}</p>
              <p><strong>Game:</strong> {order.game}</p>
              <p><strong>Order ID:</strong> {order.orderId}</p>
              <p><strong>Short Invoice:</strong></p>
              <div className="scroll-box short-invoice">{shorten(order.invoice || order.address)}</div>
            </div>
            <button className="btn btn-primary mt-md" onClick={resetAll}>Done</button>
          </div>
        </div>
      )}
    </div>
  );
}
