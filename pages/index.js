import React, { useState, useEffect, useRef } from 'react';
import { db } from '../lib/firebaseClient'; // Assuming this path is correct
import QRCodeLib from 'qrcode'; // Import the base qrcode library

// You will no longer need:
// import dynamic from 'next/dynamic';
// const QRCode = dynamic(() => import('qrcode.react'), { ssr: false });

// QRErrorBoundary class remains the same as you have it
class QRErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error: error };
  }
  componentDidCatch(error, errorInfo) {
    console.error("QR Code Generation/Display Error Caught by Boundary:", error, errorInfo);
    this.setState({ errorInfo: errorInfo });
  }
  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="alert alert-danger">
          <p>⚠️ Error displaying QR code.</p>
          <p>Please try copying the invoice text manually.</p>
          {this.state.error && <p style={{fontSize: 'small', marginTop: '10px'}}><strong>Error details:</strong> {this.state.error.toString()}</p>}
        </div>
      );
    }
    return this.props.children;
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
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState(''); // State for the QR code image data

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
          clearInterval(timerRef.current);
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 2000);
    return () => clearInterval(pollingRef.current);
  }, [order, status]);

  useEffect(() => {
    if (!modals.invoice || status !== 'pending') {
        clearInterval(timerRef.current);
        setQrCodeDataUrl(''); // Clear QR code if modal is not shown or status isn't pending
        return;
    }
    setCountdown(600);
    timerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          setStatus('expired');
          setModals({ invoice: false, receipt: false, expired: true });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [modals.invoice, status]);

  const resetModals = () => {
    setModals({ invoice: false, receipt: false, expired: false });
    setCopied(false);
    setQrCodeDataUrl(''); // Clear QR code on modal reset
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
    }).catch(err => {
        console.error('Failed to copy:', err);
        setError('Failed to copy invoice to clipboard.');
    });
  };

  const isValidQRValue = value =>
    typeof value === 'string' &&
    value.trim().length > 10 &&
    /^ln(bc|tb|bcrt)[0-9a-z]+$/i.test(value.trim());

  // Effect to generate QR Code Data URL when order.invoice changes and is valid
  useEffect(() => {
    if (order && order.invoice && isValidQRValue(order.invoice) && modals.invoice) {
      console.log('Generating QR Data URL for:', order.invoice);
      QRCodeLib.toDataURL(order.invoice, {
        errorCorrectionLevel: 'M', // Or 'L', 'Q', 'H'
        width: 180, // Desired width of the QR code image
        margin: 2, // Margin around the QR code
      })
      .then(url => {
        setQrCodeDataUrl(url);
      })
      .catch(err => {
        console.error('Failed to generate QR code data URL:', err);
        setQrCodeDataUrl(''); // Clear on error
        // The QRErrorBoundary in renderInvoiceModal will catch display issues or you can set a specific error state
        setError('Could not generate QR code image.'); // Set a general error
      });
    } else {
      setQrCodeDataUrl(''); // Clear if no valid invoice
    }
  }, [order, modals.invoice]); // Re-run when order or invoice modal visibility changes

  const handleSubmit = async e => {
    e.preventDefault();
    setLoading(true);
    setError('');
    resetModals();
    setQrCodeDataUrl(''); // Clear previous QR code

    try {
      const res = await fetch('/api/create-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok || !data.invoice) {
        throw new Error(data.message || 'Invoice generation failed. No invoice data received.');
      }
      if (typeof data.invoice !== 'string' || !isValidQRValue(data.invoice)) {
        console.error('Invalid invoice format received from API:', data.invoice);
        throw new Error('Received invalid invoice format from server.');
      }
      const newOrder = {
        ...form,
        invoice: data.invoice,
        orderId: data.orderId,
        btc: data.btcAmount || 'N/A',
        created: new Date().toISOString(),
        status: 'pending',
      };
      setOrder(newOrder); // This will trigger the useEffect for QR code generation
      setStatus('pending');
      setModals({ invoice: true, receipt: false, expired: false });
    } catch (err) {
      console.error('Handle submit error:', err);
      setError(err.message || 'An error occurred while generating the invoice.');
    } finally {
      setLoading(false);
    }
  };

  const shorten = str =>
    !str ? 'N/A' : str.length <= 14 ? str : `${str.slice(0, 8)}…${str.slice(-6)}`;

  const renderInvoiceModal = () => {
    if (!order || !modals.invoice) return null;
    const invoiceText = order.invoice || '';
    // The qrCodeDataUrl state will be used for the image
    console.log('Rendering invoice modal. Current QR Data URL state:', qrCodeDataUrl ? 'Exists' : 'Empty');

    return (
      <div className="modal-overlay" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) resetModals(); }}>
        <div className="modal">
          <button onClick={resetModals} className="modal-close-btn" aria-label="Close modal">&times;</button>
          <h2 className="receipt-header">Send Payment</h2>
          <div className="receipt-amounts">
            <p className="usd-amount">${order.amount ?? '0.00'} USD</p>
            <p className="btc-amount">{order.btc ?? '0.00000000'} BTC</p>
          </div>
          <p className="text-center">Expires in: <strong data-testid="countdown-timer">{formatTime(countdown)}</strong></p>

          <QRErrorBoundary 
            fallback={<p className="alert alert-danger mt-md">⚠️ Could not display QR code. Please copy the invoice text below.</p>}
          >
            <div className="qr-container mt-md">
              {qrCodeDataUrl ? (
                <img src={qrCodeDataUrl} alt="Lightning Invoice QR Code" style={{ width: 180, height: 180 }} />
              ) : (
                isValidQRValue(invoiceText) ? <p>Generating QR code...</p> : <p className="alert alert-warning">Invalid invoice data for QR.</p>
              )}
              {isValidQRValue(invoiceText) && (
                <p className="mt-sm qr-text" style={{wordBreak: 'break-all'}}>{invoiceText}</p>
              )}
            </div>
          </QRErrorBoundary>

          <button className="btn btn-success mt-md" onClick={copyToClipboard} disabled={!isValidQRValue(invoiceText)}>
            {copied ? 'Copied!' : 'Copy Invoice'}
          </button>
        </div>
      </div>
    );
  };

  // ... (rest of your Home component: form JSX, other modals)
  return (
    <div className="container mt-lg">
      <div className="card">
        <h1 className="card-header text-center">🎣 Lucky Paw’s Fishing Room</h1>
        <div className="card-body">
          <form onSubmit={handleSubmit}>
            <label htmlFor="username">Username</label>
            <input
              id="username"
              className="input"
              name="username"
              value={form.username}
              onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
              required
              placeholder="Your username"
            />
            <label htmlFor="game">Select Game</label>
            <select
              id="game"
              className="select"
              name="game"
              value={form.game}
              onChange={e => setForm(f => ({ ...f, game: e.target.value }))}
              required
            >
              <option value="" disabled>Select Game</option>
              {games.map(g => (
                <option key={g.id} value={g.name}>{g.name}</option>
              ))}
            </select>
            <label htmlFor="amount">Amount (USD)</label>
            <input
              id="amount"
              className="input"
              type="number"
              min="1"
              step="0.01"
              name="amount"
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
                  name="method"
                  value="lightning"
                  checked={form.method === 'lightning'}
                  onChange={e => setForm(f => ({ ...f, method: e.target.value }))}
                />
                Lightning
              </label>
            </div>
            <button className="btn btn-primary mt-md" type="submit" disabled={loading || !form.username || !form.game || !form.amount}>
              {loading ? 'Generating…' : 'Generate Invoice'}
            </button>
          </form>
          {error && <div className="alert alert-danger mt-md">{error}</div>}
        </div>
      </div>

      {modals.invoice && renderInvoiceModal()}

      {modals.expired && (
        <div className="modal-overlay" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) resetModals(); }}>
          <div className="modal">
            <button onClick={resetModals} className="modal-close-btn" aria-label="Close modal">&times;</button>
            <h2 className="receipt-header text-danger">⚠️ Invoice Expired</h2>
            <p>The invoice has expired. Please generate a new one.</p>
            <button className="btn btn-primary mt-md" onClick={() => { resetModals(); }}>Generate New</button>
          </div>
        </div>
      )}

      {modals.receipt && order && (
        <div className="modal-overlay" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) resetModals(); }}>
          <div className="modal receipt-modal">
            <button onClick={resetModals} className="modal-close-btn" aria-label="Close modal">&times;</button>
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
              <div className="scroll-box short-invoice" style={{wordBreak: 'break-all'}}>{shorten(order.invoice)}</div>
            </div>
            <button className="btn btn-primary mt-md" onClick={resetModals}>Done</button>
          </div>
        </div>
      )}
    </div>
  );
}