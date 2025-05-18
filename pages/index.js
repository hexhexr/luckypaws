import { useState, useEffect } from 'react';
import { db } from '../lib/firebaseClient';
import { QRCode } from 'qrcode.react';

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
      setGames(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    };
    loadGames();
  }, []);

  const handleSubmit = async (e) => {
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
      
      setOrder({
        ...data,
        ...form,
        created: new Date().toISOString(),
        orderId: data.orderId || Date.now().toString()
      });
      
      setShowInvoiceModal(true);
      setStatus('pending');
      setCountdown(600);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Add safe copy function
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

  // Safe shorten function
  const shorten = (str) => {
    if (!str) return 'N/A';
    if (str.length <= 14) return str;
    return `${str.slice(0, 8)}…${str.slice(-6)}`;
  };

  // Modal rendering with safety checks
  const renderInvoiceModal = () => (
    <div className="modal-overlay">
      <div className="modal">
        <h2 className="receipt-header">Send Payment</h2>
        <div className="receipt-amounts">
          <p className="usd-amount">${order?.amount || '0.00'} USD</p>
          <p className="btc-amount">{order?.btc || '0.00000000'} BTC</p>
        </div>

        <p className="text-center">
          Expires in: <strong>{formatTime(countdown)}</strong>
        </p>

        {order?.invoice ? (
          <div className="qr-container mt-md">
            <QRCode value={order.invoice} size={180} />
            <p className="mt-sm qr-text">{order.invoice}</p>
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

  return (
    <div className="container mt-lg">
      {/* ... rest of your JSX ... */}
      {showInvoiceModal && renderInvoiceModal()}
      {/* ... other modals ... */}
    </div>
  );
}