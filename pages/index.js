import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { db } from '../lib/firebaseClient';

const SafeQRCode = dynamic(
  () =>
    import('qrcode.react')
      .then(mod => mod.default)
      .catch(() => () => <div>⚠️ Failed to load QR Code</div>),
  { ssr: false }
);

function ErrorBoundary({ children }) {
  try {
    return children;
  } catch (err) {
    console.error('Render error:', err);
    return <div className="alert alert-danger">Something went wrong.</div>;
  }
}

export default function Home() {
  const [form, setForm] = useState({ username: '', game: '', amount: '', method: 'lightning' });
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(false);
  const [order, setOrder] = useState(null);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [modals, setModals] = useState({ invoice: false, receipt: false, expired: false });
  const [countdown, setCountdown] = useState(600);

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
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 2000);

    return () => clearInterval(pollingRef.current);
  }, [order, status]);

  useEffect(() => {
    if (!modals.invoice) return;

    timerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          setModals({ invoice: false, receipt: false, expired: true });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [modals.invoice]);

  const resetModals = () => {
    setModals({ invoice: false, receipt: false, expired: false });
    setCopied(false);
    setCountdown(600);
    clearInterval(timerRef.current);
    clearInterval(pollingRef.current);
  };

  const formatTime = sec => {
    const min = Math.floor(sec / 60);
    const s = String(sec % 60).padStart(2, '0');
    return `${min}:${s}`;
  };

  const copyToClipboard = () => {
    const text = order?.invoice || '';
    if (!text) {
      setError('No invoice to copy');
      return;
    }
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const isLightningInvoice = value => {
    return typeof value === 'string' && /^ln(bc|tb|bcrt)[0-9a-z]+$/i.test(value.trim());
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

      if (!res.ok || !data.invoice) throw new Error(data.message || 'Invoice generation failed');

      const newOrder = {
        ...form,
        ...data,
        orderId: data.orderId,
        created: new Date().toISOString(),
      };

      setOrder(newOrder);
      setStatus('pending');
      setCountdown(600);
      setModals({ invoice: true, receipt: false, expired: false });
    } catch (err) {
      console.error(err);
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const shorten = str =>
    !str ? 'N/A' : str.length <= 14 ? str : `${str.slice(0, 8)}…${str.slice(-6)}`;

  const renderInvoiceModal = () => {
    if (!order) return null;
    const qrValue = order.invoice || '';

    return (
      <div className="modal-overlay" role="dialog" aria-modal="true">
        <div className="modal">
          <h2 className="receipt-header">Send Payment</h2>
          <div className="receipt-amounts">
            <p className="usd-amount">${order.amount ?? '0.00'} USD</p>
            <p className="btc-amount">{order.btc ?? '0.00000000'} BTC</p>
          </div>
          <p className="text-center">Expires in: <strong>{formatTime(countdown)}</strong></p>

          {isLightningInvoice(qrValue) ? (
            <div className="qr-container mt-md">
              <SafeQRCode value={qrValue} size={180} />
              <p className="mt-sm qr-text">{qrValue}</p>
            </div>
          ) : (
            <p className="alert alert-warning">⚠️ Invalid Lightning invoice</p>
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
              onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
              required
              placeholder="Your username"
            />
            <label>Select Game</label>
            <select
              className="select"
              value={form.game}
              onChange={e => setForm(f => ({ ...f, game: e.target.value }))}
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
              min="1"
              value={form.amount}
              onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
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
                  onChange={e => setForm(f => ({ ...f, method: e.target.value }))}
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

      {modals.invoice && (
        <ErrorBoundary>
          {renderInvoiceModal()}
        </ErrorBoundary>
      )}

      {modals.expired && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal">
            <h2 className="receipt-header text-danger">⚠️ Invoice Expired</h2>
            <p>The invoice has expired. Please generate a new one.</p>
            <button className="btn btn-primary mt-md" onClick={resetModals}>Generate New</button>
          </div>
        </div>
      )}

      {modals.receipt && order && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal receipt-modal">
            <h2 className="receipt-header">✅ Payment Received</h2>
            <div className="receipt-amounts">
              <p className="usd-amount"><strong>${order.amount}</strong> USD</p>
              <p className="btc-amount">{order.btc}</p>
            </div>
            <div className="receipt-details">
              <p><strong>Username:</strong> {order.username}</p>
              <p><strong>Game:</strong> {order.game}</p>
              <p><strong>Order ID:</strong> {order.orderId}</p>
              <p><strong>Short Invoice:</strong></p>
              <div className="scroll-box short-invoice">{shorten(order.invoice)}</div>
            </div>
            <button className="btn btn-primary mt-md" onClick={resetModals}>Done</button>
          </div>
        </div>
      )}
    </div>
  );
}
