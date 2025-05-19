// ✅ FIXED index.js with full Firebase + Speed integration
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

  useEffect(() => {
    if (!showInvoiceModal) return;
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          resetModals();
          setShowExpiredModal(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [showInvoiceModal]);

  const formatTime = sec => {
    const min = Math.floor(sec / 60);
    const s = String(sec % 60).padStart(2, '0');
    return `${min}:${s}`;
  };

  const resetModals = () => {
    setShowInvoiceModal(false);
    setShowReceiptModal(false);
    setShowExpiredModal(false);
    setCopied(false);
  };

  const copyToClipboard = () => {
    const text = order?.invoice || '';
    if (!text) {
      setError('No payment details to copy');
      return;
    }
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shorten = str => {
    if (!str) return 'N/A';
    if (str.length <= 14) return str;
    return `${str.slice(0, 8)}…${str.slice(-6)}`;
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setLoading(true);
    setError('');
    resetModals();

    try {
      const res = await fetch('/api/create-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Payment failed');
      if (!data.invoice) throw new Error('Invoice not generated');

      const orderPayload = {
        ...form,
        ...data,
        created: new Date().toISOString(),
        orderId: data.orderId,
      };

      setOrder(orderPayload);
      setShowInvoiceModal(true);
      setStatus('pending');
      setCountdown(600);
    } catch (err) {
      console.error('Create-payment error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const renderInvoiceModal = () => {
    if (!order) return null;
    const qrValue = order.invoice || '';
    const isValidQR = typeof qrValue === 'string' && qrValue.trim() !== '';

    return (
      <div className="modal-overlay">
        <div className="modal">
          <h2 className="receipt-header">Send Payment</h2>
          <div className="receipt-amounts">
            <p className="usd-amount">${order.amount ?? '0.00'} USD</p>
            <p className="btc-amount">{order.btc ?? '0.00000000'} BTC</p>
          </div>
          <p className="text-center">
            Expires in: <strong>{formatTime(countdown)}</strong>
          </p>

          {isValidQR ? (
            <div className="qr-container mt-md">
              <QRCode value={qrValue} size={180} />
              <p className="mt-sm qr-text">{qrValue}</p>
            </div>
          ) : (
            <p className="alert alert-warning">Invoice not available</p>
          )}

          <button className="btn btn-success mt-md" onClick={copyToClipboard}>
            {copied ? 'Copied!' : 'Copy Invoice'}
          </button>
        </div>
      </div>
    );
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
              name="username"
              value={form.username}
              onChange={e => setForm(prev => ({ ...prev, username: e.target.value }))}
              required
              placeholder="Your username"
            />

            <label>Select Game</label>
            <select
              className="select"
              name="game"
              value={form.game}
              onChange={e => setForm(prev => ({ ...prev, game: e.target.value }))}
              required
            >
              <option value="" disabled>
                Select Game
              </option>
              {games.map(g => (
                <option key={g.id} value={g.name ?? ''}>
                  {g.name ?? 'Unnamed Game'}
                </option>
              ))}
            </select>

            <label>Amount (USD)</label>
            <input
              className="input"
              type="number"
              name="amount"
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
                  name="method"
                  value="lightning"
                  checked={form.method === 'lightning'}
                  onChange={e => setForm(prev => ({ ...prev, method: e.target.value }))}
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

      {showInvoiceModal && renderInvoiceModal()}

      {showExpiredModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h2 className="receipt-header" style={{ color: '#d32f2f' }}>
              ⚠️ Invoice Expired
            </h2>
            <p>The invoice has expired. Please generate a new one to continue.</p>
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
            <div className="receipt-amounts">
              <p className="usd-amount">
                <strong>${order.amount}</strong> USD
              </p>
              <p className="btc-amount">{order.btc}</p>
            </div>
            <div className="receipt-details">
              <p>
                <strong>Username:</strong> {order.username}
              </p>
              <p>
                <strong>Game:</strong> {order.game}
              </p>
              <p>
                <strong>Order ID:</strong> {order.orderId}
              </p>
              <p>
                <strong>Short Invoice:</strong>
              </p>
              <div className="scroll-box short-invoice">{shorten(order.invoice)}</div>
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
