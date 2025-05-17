import { useEffect, useState } from 'react';
import { db } from '../lib/firebaseClient';
import QRCode from 'qrcode.react';

export default function Home() {
  const [form, setForm] = useState({ username: '', game: '', amount: '', method: 'lightning' });
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(false);
  const [invoice, setInvoice] = useState(null);
  const [orderId, setOrderId] = useState(null);
  const [status, setStatus] = useState('pending');
  const [btc, setBtc] = useState('');
  const [copied, setCopied] = useState(false);
  const [timer, setTimer] = useState(600);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    const loadGames = async () => {
      const snap = await db.collection('games').orderBy('name').get();
      const list = snap.docs.map(doc => doc.data().name);
      setGames(list);
      if (list.length > 0) {
        setForm(prev => ({ ...prev, game: list[0] }));
      }
    };
    loadGames();
  }, []);

  useEffect(() => {
    const savedOrderId = localStorage.getItem('active_order');
    if (savedOrderId) {
      setOrderId(savedOrderId);
      checkStatus(savedOrderId);
    }
  }, []);

  useEffect(() => {
    if (!invoice || status === 'paid') return;
    const countdown = setInterval(() => {
      setTimer(prev => {
        if (prev <= 1) {
          clearInterval(countdown);
          setExpired(true);
          localStorage.removeItem('active_order');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(countdown);
  }, [invoice, status]);

  const handleChange = e => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setLoading(true);
    setInvoice(null);
    setStatus('pending');
    setOrderId(null);
    setExpired(false);
    setTimer(600);

    try {
      const res = await fetch('/api/create-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to create invoice');

      setInvoice(data);
      setBtc(data.btc);
      setOrderId(data.orderId);
      localStorage.setItem('active_order', data.orderId);
      checkStatus(data.orderId);
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const checkStatus = async id => {
    db.collection('orders').doc(id).onSnapshot(doc => {
      const data = doc.data();
      if (data?.status === 'paid') {
        setStatus('paid');
        setTimeout(() => {
          localStorage.removeItem('active_order');
          window.location.href = `/receipt?id=${id}`;
        }, 1000);
      }
    });
  };

  const closeModal = () => {
    setInvoice(null);
    setOrderId(null);
    setStatus('pending');
    setExpired(false);
    setTimer(600);
    localStorage.removeItem('active_order');
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const getPaymentString = () => {
    return form.method === 'lightning' ? invoice?.invoice : invoice?.address;
  };

  const formatTime = () => {
    const min = Math.floor(timer / 60);
    const sec = timer % 60;
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
  };

  return (
    <div className="container mt-lg">
      <div className="card" style={{ maxWidth: '500px', margin: '0 auto' }}>
        <h2 className="text-center">🎮 Lucky Paw's Fishing Room</h2>
        <form onSubmit={handleSubmit}>
          <label>Username</label>
          <input className="input" name="username" value={form.username} onChange={handleChange} required />

          <label>Game Name</label>
          {games.length > 0 ? (
            <select
              className="input"
              name="game"
              value={form.game}
              onChange={handleChange}
              required
            >
              {games.map((g, i) => (
                <option key={i} value={g}>{g}</option>
              ))}
            </select>
          ) : (
            <p className="alert alert-warning">⚠️ No games found. Please add some games from admin panel.</p>
          )}

          <label>Amount (USD)</label>
          <input className="input" name="amount" type="number" value={form.amount} onChange={handleChange} required />

          <label>Payment Method</label>
          <select className="input" name="method" value={form.method} onChange={handleChange}>
            <option value="lightning">⚡ Lightning</option>
            <option value="onchain">₿ On-chain</option>
          </select>

          <button className="btn btn-primary mt-md" type="submit" disabled={loading}>
            {loading ? 'Generating...' : 'Generate Invoice'}
          </button>
        </form>
      </div>

      {invoice && (
        <div className="modal-overlay">
          <div className="modal">
            <h3 className="text-center">💸 Complete Your Payment</h3>
            <p><strong>Amount:</strong> ${form.amount} | {btc} BTC</p>

            <div className="text-center mt-sm">
              <QRCode value={getPaymentString()} size={180} />
              <p className="mt-sm scroll-box">{getPaymentString()}</p>
              <button className="btn btn-secondary btn-sm mt-sm" onClick={() => handleCopy(getPaymentString())}>
                📋 {copied ? 'Copied!' : 'Copy'}
              </button>
              <div className="mt-sm" style={{ fontSize: '0.9rem', color: '#666' }}>
                ⏳ Expires in {formatTime()}
              </div>
            </div>

            <div className="mt-md text-center">
              {status === 'paid' ? (
                <p className="alert alert-success">✅ Payment confirmed! Redirecting...</p>
              ) : expired ? (
                <p className="alert alert-danger">❌ Invoice expired. Please generate a new one.</p>
              ) : (
                <p className="alert alert-warning" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span className="loader"></span>&nbsp; Waiting for payment confirmation...
                </p>
              )}
              <button className="btn btn-danger mt-sm" onClick={closeModal}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
