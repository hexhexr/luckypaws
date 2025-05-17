import { useState, useEffect } from 'react';
import QRCode from 'react-qr-code';
import { db } from '../lib/firebaseClient';

export default function Home() {
  const [form, setForm] = useState({ username: '', game: '', amount: '', method: 'lightning' });
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(false);
  const [invoiceData, setInvoiceData] = useState(null);
  const [copied, setCopied] = useState(false);
  const [timer, setTimer] = useState(600);
  const [status, setStatus] = useState('idle');
  const [modal, setModal] = useState(null); // 'invoice' | 'receipt' | 'expired'

  useEffect(() => {
    const fetchGames = async () => {
      const snap = await db.collection('games').orderBy('name').get();
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setGames(list);
    };
    fetchGames();
  }, []);

  const handleChange = e => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setLoading(true);
    setCopied(false);
    setStatus('pending');
    setTimer(600);
    setModal(null);

    try {
      const res = await fetch('/api/create-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Invoice creation failed');

      const invoiceObj = {
        ...data,
        ...form,
        created: new Date().toISOString(),
      };
      setInvoiceData(invoiceObj);
      setModal('invoice');

      pollStatus(invoiceObj.orderId);
    } catch (err) {
      alert(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const pollStatus = orderId => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/check-status?id=${orderId}`);
        const data = await res.json();
        if (data?.status === 'paid') {
          setStatus('paid');
          clearInterval(interval);
          setModal('receipt');
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 2000);
  };

  useEffect(() => {
    if (modal !== 'invoice') return;
    const interval = setInterval(() => {
      setTimer(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          setModal('expired');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [modal]);

  const reset = () => {
    setForm({ username: '', game: '', amount: '', method: 'lightning' });
    setInvoiceData(null);
    setModal(null);
    setStatus('idle');
    setTimer(600);
  };

  const copyInvoice = () => {
    navigator.clipboard.writeText(invoiceData.invoice || invoiceData.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const shorten = str => str ? `${str.slice(0, 8)}...${str.slice(-6)}` : '';
  const formatTime = sec => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

  return (
    <div className="container mt-lg">
      <div className="card">
        <h2 className="card-header text-center">🎣 Lucky Paw’s Fishing Room</h2>
        <form onSubmit={handleSubmit}>
          <label>Username</label>
          <input className="input" name="username" value={form.username} onChange={handleChange} required />

          <label>Select Game</label>
          <select className="select" name="game" value={form.game} onChange={handleChange} required>
            <option value="">Select Game</option>
            {games.map(g => (
              <option key={g.id} value={g.name}>{g.name}</option>
            ))}
          </select>

          <label>Amount (USD)</label>
          <input className="input" type="number" name="amount" value={form.amount} onChange={handleChange} required />

          <label>Payment Method</label>
          <div className="radio-group">
            <label><input type="radio" name="method" value="lightning" checked={form.method === 'lightning'} onChange={handleChange} /> Lightning</label>
            <label><input type="radio" name="method" value="onchain" checked={form.method === 'onchain'} onChange={handleChange} /> On-chain</label>
          </div>

          <button className="btn btn-primary mt-md" type="submit" disabled={loading}>
            {loading ? 'Generating…' : 'Generate Invoice'}
          </button>
        </form>
      </div>

      {modal === 'invoice' && invoiceData && (
        <div className="modal-overlay">
          <div className="modal">
            <h2 className="receipt-header">Send Payment</h2>
            <div className="receipt-amounts">
              <p className="usd-amount">${invoiceData.amount}</p>
              <p className="btc-amount">{invoiceData.btc || '0.00000000'} BTC</p>
            </div>
            <p className="text-center">Expires in: <strong>{formatTime(timer)}</strong></p>
            <div className="qr-container">
              <QRCode value={invoiceData.invoice || invoiceData.address} size={140} />
            </div>
            <div className="scroll-box">{invoiceData.invoice || invoiceData.address}</div>
            <button className="btn btn-success mt-md" onClick={copyInvoice}>
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>
      )}

      {modal === 'expired' && (
        <div className="modal-overlay">
          <div className="modal">
            <h2 className="receipt-header" style={{ color: '#d32f2f' }}>⚠️ Invoice Expired</h2>
            <p>Your invoice expired. Please generate a new one to continue.</p>
            <button className="btn btn-primary mt-md" onClick={reset}>Generate New</button>
          </div>
        </div>
      )}

      {modal === 'receipt' && invoiceData && (
        <div className="modal-overlay">
          <div className="modal receipt-modal">
            <h2 className="receipt-header">✅ Payment Received</h2>
            <div className="receipt-amounts">
              <p className="usd-amount"><strong>${invoiceData.amount}</strong> USD</p>
              <p className="btc-amount">{invoiceData.btc || '0.00000000'} BTC</p>
            </div>
            <div className="receipt-details">
              <p><strong>Username:</strong> {invoiceData.username}</p>
              <p><strong>Game:</strong> {invoiceData.game}</p>
              <p><strong>Order ID:</strong> {invoiceData.orderId}</p>
              <p><strong>Short Invoice:</strong></p>
              <div className="scroll-box short-invoice">{shorten(invoiceData.invoice || invoiceData.address)}</div>
            </div>
            <button className="btn btn-primary mt-md" onClick={reset}>Done</button>
          </div>
        </div>
      )}
    </div>
  );
}
