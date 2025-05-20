import React, { useState, useEffect, useRef } from 'react'; // Ensured React is imported for the class component
import dynamic from 'next/dynamic';
import { db } from '../lib/firebaseClient'; // Assuming this path is correct for your project structure

// Define the QRErrorBoundary component within the same file
class QRErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error: error };
  }

  componentDidCatch(error, errorInfo) {
    // You can also log the error to an error reporting service
    console.error("QR Code Component Error Caught by Boundary:", error, errorInfo);
    this.setState({ errorInfo: errorInfo }); // Store errorInfo if you want to display it
  }

  render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return this.props.fallback || (
        <div className="alert alert-danger">
          <p>⚠️ Error displaying QR code.</p>
          <p>Please try copying the invoice text manually.</p>
          {/* For debugging, you might want to show error details:
          {this.state.error && <p>Error: {this.state.error.toString()}</p>}
          {this.state.errorInfo && <details style={{ whiteSpace: 'pre-wrap' }}><summary>Details</summary>{this.state.errorInfo.componentStack}</details>}
          */}
        </div>
      );
    }
    return this.props.children;
  }
}

const QRCode = dynamic(() => import('qrcode.react'), { ssr: false });

export default function Home() {
  const [form, setForm] = useState({ username: '', game: '', amount: '', method: 'lightning' });
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(false);
  const [order, setOrder] = useState(null);
  const [status, setStatus] = useState('idle'); // 'idle', 'pending', 'paid', 'expired'
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [modals, setModals] = useState({ invoice: false, receipt: false, expired: false });
  const [countdown, setCountdown] = useState(600); // 10 minutes in seconds

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
        const res = await fetch(`/api/check-status?id=${order.orderId}`); // Ensure this API endpoint is correct
        const data = await res.json();
        if (data?.status === 'paid') {
          setStatus('paid');
          setOrder(prev => ({ ...prev, status: 'paid' })); // Update order status
          setModals({ invoice: false, receipt: true, expired: false });
          clearInterval(pollingRef.current);
          clearInterval(timerRef.current); // Also clear countdown timer
        }
      } catch (err) {
        console.error('Polling error:', err);
        // Optionally, set an error state here if polling fails multiple times
      }
    }, 2000); // Poll every 2 seconds

    return () => clearInterval(pollingRef.current);
  }, [order, status]);

  useEffect(() => {
    if (!modals.invoice || status !== 'pending') { // Ensure timer runs only when invoice modal is active and status is pending
        clearInterval(timerRef.current);
        return;
    }

    setCountdown(600); // Reset countdown when modal opens
    timerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          setStatus('expired'); // Set status to expired
          setModals({ invoice: false, receipt: false, expired: true });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [modals.invoice, status]); // Rerun effect if modal.invoice or status changes

  const resetModals = () => {
    setModals({ invoice: false, receipt: false, expired: false });
    setCopied(false);
    // setOrder(null); // Optionally reset order details
    // setStatus('idle'); // Optionally reset status
    // setError(''); // Optionally clear previous errors
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
    value.trim().length > 10 && // Basic length check
    /^ln(bc|tb|bcrt)[0-9a-z]+$/i.test(value.trim()); // Lightning invoice regex

  const handleSubmit = async e => {
    e.preventDefault();
    setLoading(true);
    setError('');
    resetModals(); // Reset any open modals and timers

    try {
      const res = await fetch('/api/create-payment', { // Ensure this API endpoint is correct
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (!res.ok || !data.invoice) { // Check if response is OK and invoice exists
        throw new Error(data.message || 'Invoice generation failed. No invoice data received.');
      }
      
      // Ensure the invoice from API is a string before proceeding
      if (typeof data.invoice !== 'string' || !isValidQRValue(data.invoice)) {
        console.error('Invalid invoice format received from API:', data.invoice);
        throw new Error('Received invalid invoice format from server.');
      }

      const newOrder = {
        ...form, // User form details
        invoice: data.invoice, // The invoice string for QR code and display
        orderId: data.orderId, // The ID for status checking
        btc: data.btcAmount || 'N/A', // Assuming API might send BTC amount
        created: new Date().toISOString(),
        status: 'pending', // Initial status
      };

      setOrder(newOrder);
      setStatus('pending');
      // Countdown reset is handled by the useEffect for modals.invoice
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
    if (!order || !modals.invoice) return null; // Ensure order and modal state are valid

    const qrValue = order.invoice || ''; // Fallback to empty string if invoice is somehow null/undefined
    
    // ✅ IMPORTANT: Keep this log active for debugging QR code issues
    console.log('Attempting to generate QR for invoice value:', qrValue); 

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

          {/* Use the internally defined QRErrorBoundary */}
          <QRErrorBoundary 
            fallback={<p className="alert alert-danger mt-md">⚠️ Could not display QR code. Please copy the invoice below.</p>}
          >
            {isValidQRValue(qrValue) ? (
              <div className="qr-container mt-md">
                <QRCode value={qrValue} size={180} level="M" /> {/* Added level prop for better error correction if needed */}
                <p className="mt-sm qr-text" style={{wordBreak: 'break-all'}}>{qrValue}</p>
              </div>
            ) : (
              // This case should ideally be rare if API validation for invoice is also done
              <p className="alert alert-warning mt-md">⚠️ Unable to generate QR code. Invalid invoice data. (Value was: "{qrValue}")</p>
            )}
          </QRErrorBoundary>

          <button className="btn btn-success mt-md" onClick={copyToClipboard} disabled={!isValidQRValue(qrValue)}>
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
              name="game" // Added name attribute for consistency
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
              min="1" // Min amount
              step="0.01" // For cents if applicable
              name="amount" // Added name attribute
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
                  name="method" // Added name attribute for radio group
                  value="lightning"
                  checked={form.method === 'lightning'}
                  onChange={e => setForm(f => ({ ...f, method: e.target.value }))}
                />
                Lightning
              </label>
              {/* Add other payment methods here if needed */}
            </div>
            <button className="btn btn-primary mt-md" type="submit" disabled={loading || !form.username || !form.game || !form.amount}>
              {loading ? 'Generating…' : 'Generate Invoice'}
            </button>
          </form>
          {error && <div className="alert alert-danger mt-md">{error}</div>}
        </div>
      </div>

      {/* Modals */}
      {modals.invoice && renderInvoiceModal()}

      {modals.expired && (
        <div className="modal-overlay" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) resetModals(); }}>
          <div className="modal">
            <button onClick={resetModals} className="modal-close-btn" aria-label="Close modal">&times;</button>
            <h2 className="receipt-header text-danger">⚠️ Invoice Expired</h2>
            <p>The invoice has expired. Please generate a new one.</p>
            <button className="btn btn-primary mt-md" onClick={() => { resetModals(); /* Optionally, trigger form submission again or clear form */ }}>Generate New</button>
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