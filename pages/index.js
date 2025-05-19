import { useState, useEffect } from 'react';
import { db } from '../lib/firebaseClient';

export default function Home() {
  const [form, setForm] = useState({ username: '', game: '', amount: '', method: 'lightning' });
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(false);
  const [order, setOrder] = useState(null);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [showRedirectModal, setShowRedirectModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);

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
          setShowRedirectModal(false);
          setShowReceiptModal(true);
          clearInterval(interval);
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [order, status]);

  const handleSubmit = async e => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setShowReceiptModal(false);
    setShowRedirectModal(false);

    try {
      const res = await fetch('/api/create-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Payment failed');

      setOrder({
        ...data,
        ...form,
        created: new Date().toISOString(),
      });

      setStatus('pending');
      setShowRedirectModal(true);
    } catch (err) {
      console.error('Payment error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const resetAll = () => {
    setForm({ username: '', game: '', amount: '', method: 'lightning' });
    setOrder(null);
    setStatus('idle');
    setShowReceiptModal(false);
    setShowRedirectModal(false);
    setError('');
  };

  const shorten = str => (str?.length > 14 ? `${str.slice(0, 8)}…${str.slice(-6)}` : str || 'N/A');

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
                  onChange={e => setForm(prev => ({ ...prev, method: e.target.value }))}
                />
                Lightning
              </label>
            </div>

            <button className="btn btn-primary mt-md" type="submit" disabled={loading}>
              {loading ? 'Generating…' : 'Generate Payment Link'}
            </button>
          </form>

          {error && <div className="alert alert-danger mt-md">{error}</div>}
        </div>
      </div>

      {/* Hosted Payment Link Modal */}
      {showRedirectModal && order?.hostedUrl && (
        <div className="modal-overlay">
          <div className="modal">
            <h2 className="receipt-header">Pay Now</h2>
            <p>Click below to complete your payment via Speed.</p>
            <a href={order.hostedUrl} target="_blank" rel="noopener noreferrer" className="btn btn-success mt-md">
              Go to Payment Page
            </a>
            <button className="btn btn-primary mt-md" onClick={resetAll}>Cancel</button>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
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
              <p><strong>Order ID:</strong> {shorten(order.orderId)}</p>
              <p className="text-center mt-md"><em>📸 Please take a screenshot of this receipt and share it with admin as proof of payment.</em></p>
            </div>
            <button className="btn btn-primary mt-md" onClick={resetAll}>Done</button>
          </div>
        </div>
      )}
    </div>
  );
}
