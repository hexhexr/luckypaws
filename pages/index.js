import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { db } from '../lib/firebaseClient';

const QRCode = dynamic(() => import('qrcode.react'), { ssr: false });

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

  // Fixed games loading useEffect
  useEffect(() => {
    const loadGames = async () => {
      try {
        const snap = await db.collection('games').orderBy('name').get();
        setGames(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))); // Fixed missing parenthesis
      } catch (err) {
        console.error('Error loading games:', err);
        setError('Failed to load games');
      }
    };
    loadGames();
  }, []);

  // Payment status polling
  useEffect(() => {
    if (!order || status !== 'pending') return;
    
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/check-status?id=${order.orderId}`);
        const data = await res.json();
        if (data?.status === 'paid') {
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

  // Countdown timer
  useEffect(() => {
    if (!showInvoiceModal || !order?.expiresAt) return;

    const expiryTime = new Date(order.expiresAt).getTime();
    const timer = setInterval(() => {
      const now = Date.now();
      const remainingSeconds = Math.max(0, Math.floor((expiryTime - now) / 1000));
      setCountdown(remainingSeconds);

      if (remainingSeconds <= 0) {
        clearInterval(timer);
        setShowExpiredModal(true);
        setShowInvoiceModal(false);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [showInvoiceModal, order?.expiresAt]);

  const formatTime = sec => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

  const resetModals = () => {
    setShowInvoiceModal(false);
    setShowReceiptModal(false);
    setShowExpiredModal(false);
    setCopied(false);
    setCountdown(600);
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(order?.invoice || '');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
      setError('Failed to copy invoice');
    }
  };

  const shorten = str => str?.length > 14 ? `${str.slice(0, 8)}…${str.slice(-6)}` : str || 'N/A';

  const handleSubmit = async e => {
    e.preventDefault();
    setLoading(true);
    setError('');
    resetModals();

    try {
      const res = await fetch('/api/create-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Payment failed');
      
      setOrder({
        ...data,
        ...form,
        created: new Date().toISOString(),
        orderId: data.orderId || Date.now().toString(),
      });
      
      setShowInvoiceModal(true);
      setStatus('pending');
      setCountdown(600);
    } catch (err) {
      console.error('Payment error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mt-lg">
      <div className="card">
        <h1 className="card-header text-center">🎣 Lucky Paw’s Fishing Room</h1>
        <div className="card-body">
          <form onSubmit={handleSubmit}>
            <label>Username</label>
            <input
              className="input"
              value={form.username}
              onChange={e => setForm(prev => ({ ...prev, username: e.target.value }))}
              required
              placeholder="Your username"
            />

            <label>Select Game</label>
            <select
              className="select"
              value={form.game}
              onChange={e => setForm(prev => ({ ...prev, game: e.target.value }))}
              required
            >
              <option value="" disabled>Select Game</option>
              {games.map(g => (
                <option key={g.id} value={g.name}>{g.name}</option>
              ))}
            </select>

            <label>Amount (USD)</label>
            <input
              className="input"
              type="number"
              value={form.amount}
              onChange={e => setForm(prev => ({ ...prev, amount: e.target.value }))}
              required
              placeholder="Amount in USD"
            />

            <label>Payment Method</label>
            <div className="radio-group">
              <label>
                <input
                  type="radio"
                  value="lightning"
                  checked={form.method === 'lightning'}
                  onChange={e => setForm(prev => ({ ...prev, method: e.target.value })}
                />
                Lightning
              </label>
            </div>

            <button className="btn btn-primary mt-md" type="submit" disabled={loading}>
              {loading ? 'Generating…' : 'Generate Invoice'}
            </button>
          </form>

          {error && <div className="alert alert-danger mt-md">{error}</div>}
        </div>
      </div>

      {showInvoiceModal && order?.invoice && (
        <div className="modal-overlay">
          <div className="modal">
            <h2 className="receipt-header">Send Payment</h2>
            <div className="receipt-amounts">
              <p className="usd-amount">${order.amount} USD</p>
              <p className="btc-amount">{order.btc} BTC</p>
            </div>
            <p className="text-center">
              Expires in: <strong>{formatTime(countdown)}</strong>
            </p>

            <div className="qr-container mt-md">
              <QRCode value={order.invoice} size={180} />
              <p className="mt-sm qr-text">{order.invoice}</p>
            </div>

            <button className="btn btn-success mt-md" onClick={copyToClipboard}>
              {copied ? 'Copied!' : 'Copy Invoice'}
            </button>
          </div>
        </div>
      )}

      {showExpiredModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h2 className="receipt-header" style={{ color: '#d32f2f' }}>
              ⚠️ Invoice Expired
            </h2>
            <button className="btn btn-primary mt-md" onClick={resetModals}>
              Generate New
            </button>
          </div>
        </div>
      )}

      {showReceiptModal && order && (
        <div className="modal-overlay">
          <div className="modal receipt-modal">
            <h2 className="receipt-header">✅ Payment Received</h2>
            <div className="receipt-details">
              <p>Amount: ${order.amount} USD</p>
              <p>Transaction ID: {shorten(order.orderId)}</p>
            </div>
            <button className="btn btn-primary mt-md" onClick={resetModals}>
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}