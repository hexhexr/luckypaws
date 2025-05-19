import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { db } from '../lib/firebaseClient';

// Dynamically import the QRCode component so it's only used client-side
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

  // Load available games on mount
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

  // Poll for the payment status if an order is “pending”
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

  // Countdown timer for invoice expiry
  useEffect(() => {
    if (!showInvoiceModal || !order?.expiresAt) return; // Ensure expiresAt exists

    const expiryTime = new Date(order.expiresAt).getTime();

    const timer = setInterval(() => {
      const now = Date.now();
      const remainingSeconds = Math.max(0, Math.floor((expiryTime - now) / 1000));

      setCountdown(remainingSeconds);

      if (remainingSeconds <= 0) {
        clearInterval(timer);
        resetModals();
        setShowExpiredModal(true);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [showInvoiceModal, order?.expiresAt]);

  // Utility: format seconds as “MM:SS”
  const formatTime = sec => {
    const min = Math.floor(sec / 60);
    const s = String(sec % 60).padStart(2, '0');
    return `${min}:${s}`;
  };

  // Reset all modals and “copied” flag
  const resetModals = () => {
    setShowInvoiceModal(false);
    setShowReceiptModal(false);
    setShowExpiredModal(false);
    setCopied(false);
    setCountdown(600); // Reset countdown for new invoices
  };

  // Copy invoice text to clipboard (safely)
  const copyToClipboard = async () => {
    const text = order?.invoice || '';
    if (!text) {
      setError('No payment details to copy');
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      setError('Failed to copy invoice');
    }
  };

  // Shorten a long invoice/address string
  const shorten = str => {
    if (!str) return 'N/A';
    if (typeof str !== 'string') return String(str); // Ensure it's a string
    if (str.length <= 14) return str;
    return `${str.slice(0, 8)}…${str.slice(-6)}`;
  };

  // Handle “Generate Invoice” form submit
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
      if (!data.expiresAt) console.warn('Invoice response missing expiresAt'); // Warn if expiresAt is missing

      setOrder({
        ...data,
        ...form,
        created: new Date().toISOString(),
        orderId: data.orderId || Date.now().toString(),
      });
      setShowInvoiceModal(true);
      setStatus('pending');
      setCountdown(600); // Initial countdown
    } catch (err) {
      console.error('Create-payment error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Render invoice modal only if order & its invoice exist
  const renderInvoiceModal = () => {
    if (!order || !order.invoice) return null; // Ensure order and invoice exist
    const qrValue = order.invoice;
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