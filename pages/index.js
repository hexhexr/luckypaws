import { useEffect, useState } from 'react';
import { db } from '../lib/firebaseClient';
import QRCode from 'qrcode.react';

export default function Home() {
  const [form, setForm] = useState({ username: '', game: '', amount: '', method: 'lightning' });
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(false);
  const [invoice, setInvoice] = useState('');
  const [address, setAddress] = useState('');
  const [btc, setBtc] = useState('');
  const [orderId, setOrderId] = useState(null);
  const [status, setStatus] = useState('pending');
  const [copied, setCopied] = useState(false);
  const [timer, setTimer] = useState(600);
  const [expired, setExpired] = useState(false);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    const loadGames = async () => {
      try {
        const snap = await db.collection('games').orderBy('name').get();
        const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setGames(list);
        if (list.length > 0) {
          setForm(prev => ({ ...prev, game: list[0].name }));
        }
      } catch {
        setGames([]);
      }
    };
    loadGames();
  }, []);

  useEffect(() => {
    const savedOrder = JSON.parse(localStorage.getItem('active_order'));
    if (savedOrder?.orderId) {
      setOrderId(savedOrder.orderId);
      setInvoice(savedOrder.invoice);
      setAddress(savedOrder.address);
      setBtc(savedOrder.btc);
      setForm(prev => ({ ...prev, method: savedOrder.method }));
      setShowModal(true);
      checkStatus(savedOrder.orderId);
    }
  }, []);

  useEffect(() => {
    if (!showModal || status === 'paid') return;
    const countdown = setInterval(() => {
      setTimer(prev => {
        if (prev <= 1) {
          clearInterval(countdown);
          setExpired(true);
          setShowModal(false);
          localStorage.removeItem('active_order');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(countdown);
  }, [showModal, status]);

  const handleChange = e => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setLoading(true);
    setInvoice('');
    setAddress('');
    setStatus('pending');
    setOrderId(null);
    setExpired(false);
    setTimer(600);
    setShowModal(false);

    try {
      const res = await fetch('/api/create-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to create invoice');

      setInvoice(data.invoice);
      setAddress(data.address);
      setBtc(data.btc);
      setOrderId(data.orderId);
      setShowModal(true);
      localStorage.setItem(
        'active_order',
        JSON.stringify({
          orderId: data.orderId,
          invoice: data.invoice,
          address: data.address,
          btc: data.btc,
          method: form.method,
        })
      );
      checkStatus(data.orderId);
    } catch (err) {
      alert(err.message || 'Error creating invoice');
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
    setInvoice('');
    setAddress('');
    setOrderId(null);
    setStatus('pending');
    setTimer(600);
    setExpired(false);
    setShowModal(false);
    localStorage.removeItem('active_order');
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(form.method === 'lightning' ? invoice : address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const formatTime = () => `${Math.floor(timer / 60)}:${timer % 60 < 10 ? '0' : ''}${timer % 60}`;

  return (
    <div className="container mt-lg">
      <div className="card" style={{ maxWidth: '500px', margin: '0 auto' }}>
        <h2 className="text-center">🎮 Lucky Paw's Fishing Room</h2>
        <form onSubmit={handleSubmit}>
          <label>Username</label>
          <input className="input" name="username" value={form.username} onChange={handleChange} required />
          <label>Game Name</label>
          <select className="select" name="game" value={form.game} onChange={handleChange} required>
            <option value="" disabled>Select Game</option>
            {games.map(g => (
              <option key={g.id} value={g.name}>{g.name}</option>
            ))}
          </select>
          <label>Amount (USD)</label>
          <input className="input" name="amount" type="number" value={form.amount} onChange={handleChange} required />
          <label>Payment Method</label>
          <select className="select" name="method" value={form.method} onChange={handleChange}>
            <option value="lightning">⚡ Lightning</option>
            <option value="onchain">₿ On-chain</option>
          </select>
          <button className="btn btn-primary mt-md" type="submit" disabled={loading}>
            {loading ? 'Generating...' : 'Generate Invoice'}
          </button>
        </form>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3 className="text-center">💸 Complete Your Payment</h3>
            <p><strong>Amount:</strong> ${form.amount} | {btc || '0.00000000'} BTC</p>
            <div className="text-center mt-sm">
              <QRCode value={form.method === 'lightning' ? invoice : address} size={180} />
              <p className="mt-sm scroll-box">{form.method === 'lightning' ? invoice : address}</p>
              <button className="btn btn-secondary btn-sm mt-sm" onClick={handleCopy}>
                📋 {copied ? 'Copied!' : 'Copy'}
              </button>
              <div className="mt-sm" style={{ fontSize: '0.9rem', color: '#666' }}>
                ⏳ Expires in {formatTime()}
              </div>
            </div>
            <div className="mt-md text-center">
              {status === 'paid' ? (
                <p className="alert alert-success">✅ Payment confirmed! Redirecting…</p>
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
