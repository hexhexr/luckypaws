import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { db } from '../lib/firebaseClient';

const QRCode = dynamic(() => import('qrcode.react'), { ssr: false });

// Utility functions
const formatTime = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
const shorten = (str) => str?.length > 14 ? `${str.slice(0, 8)}…${str.slice(-6)}` : str || 'N/A';

export default function PaymentInterface() {
  const [form, setForm] = useState({ 
    username: '', 
    game: '', 
    amount: '', 
    method: 'lightning' 
  });
  const [games, setGames] = useState([]);
  const [order, setOrder] = useState(null);
  const [status, setStatus] = useState({ state: 'idle', error: '' });
  const [uiState, setUiState] = useState({
    copied: false,
    showInvoice: false,
    showReceipt: false,
    showExpired: false
  });
  const [countdown, setCountdown] = useState(600);

  // Load games on mount
  useEffect(() => {
    const loadGames = async () => {
      try {
        const snapshot = await db.collection('games').orderBy('name').get();
        setGames(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } catch (error) {
        console.error('Failed loading games:', error);
        setStatus({ state: 'error', error: 'Failed to load games' });
      }
    };
    loadGames();
  }, []);

  // Payment status polling
  useEffect(() => {
    if (!order || status.state !== 'pending') return;
    
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/payments/${order.id}/status`);
        const data = await response.json();
        
        if (data.status === 'paid') {
          setStatus({ state: 'paid', error: '' });
          setUiState(prev => ({ ...prev, showInvoice: false, showReceipt: true }));
          clearInterval(pollInterval);
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [order, status.state]);

  // Invoice expiration countdown
  useEffect(() => {
    if (!uiState.showInvoice || !order?.expiresAt) return;

    const expirationTime = new Date(order.expiresAt).getTime();
    const timer = setInterval(() => {
      const remaining = Math.floor((expirationTime - Date.now()) / 1000);
      setCountdown(Math.max(0, remaining));

      if (remaining <= 0) {
        setUiState({ showInvoice: false, showExpired: true, showReceipt: false });
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [uiState.showInvoice, order?.expiresAt]);

  const handlePaymentCreation = async (e) => {
    e.preventDefault();
    setStatus({ state: 'loading', error: '' });
    setUiState({ showInvoice: false, showReceipt: false, showExpired: false });

    try {
      const response = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Payment creation failed');
      }

      const paymentData = await response.json();
      setOrder(paymentData);
      setStatus({ state: 'pending', error: '' });
      setUiState(prev => ({ ...prev, showInvoice: true }));
      setCountdown(600);
    } catch (error) {
      console.error('Payment error:', error);
      setStatus({ state: 'error', error: error.message });
    }
  };

  const copyInvoice = async () => {
    try {
      await navigator.clipboard.writeText(order.paymentRequest);
      setUiState(prev => ({ ...prev, copied: true }));
      setTimeout(() => setUiState(prev => ({ ...prev, copied: false })), 2000);
    } catch (error) {
      console.error('Copy failed:', error);
      setStatus({ state: 'error', error: 'Failed to copy invoice' });
    }
  };

  return (
    <div className="payment-container">
      <div className="payment-card">
        <h1 className="payment-header">🎣 Lucky Paw’s Fishing Room</h1>
        
        <form onSubmit={handlePaymentCreation}>
          {/* Form fields */}
          <div className="form-group">
            <label>Username</label>
            <input
              value={form.username}
              onChange={(e) => setForm(prev => ({ ...prev, username: e.target.value }))}
              required
            />
          </div>

          {/* Game selection */}
          <div className="form-group">
            <label>Game</label>
            <select
              value={form.game}
              onChange={(e) => setForm(prev => ({ ...prev, game: e.target.value }))}
              required
            >
              <option value="">Select a game</option>
              {games.map(game => (
                <option key={game.id} value={game.id}>
                  {game.name}
                </option>
              ))}
            </select>
          </div>

          {/* Amount input */}
          <div className="form-group">
            <label>Amount (USD)</label>
            <input
              type="number"
              min="1"
              value={form.amount}
              onChange={(e) => setForm(prev => ({ ...prev, amount: e.target.value }))}
              required
            />
          </div>

          {/* Payment method */}
          <div className="form-group">
            <label>Payment Method</label>
            <div className="radio-group">
              <label>
                <input
                  type="radio"
                  value="lightning"
                  checked={form.method === 'lightning'}
                  onChange={(e) => setForm(prev => ({ ...prev, method: e.target.value }))}
                />
                Lightning Network
              </label>
            </div>
          </div>

          <button 
            type="submit" 
            disabled={status.state === 'loading'}
            className="submit-button"
          >
            {status.state === 'loading' ? 'Processing...' : 'Create Payment'}
          </button>
        </form>

        {status.state === 'error' && (
          <div className="error-message">{status.error}</div>
        )}
      </div>

      {/* Payment Modals */}
      {uiState.showInvoice && order?.paymentRequest && (
        <div className="modal">
          <div className="modal-content">
            <h2>Payment Request</h2>
            <div className="qr-container">
              <QRCode value={order.paymentRequest} size={200} />
              <p className="timer">Expires in: {formatTime(countdown)}</p>
              <button onClick={copyInvoice} className="copy-button">
                {uiState.copied ? 'Copied!' : 'Copy Invoice'}
              </button>
            </div>
          </div>
        </div>
      )}

      {uiState.showReceipt && (
        <div className="modal">
          <div className="modal-content success">
            <h2>Payment Received! 🎉</h2>
            <div className="receipt-details">
              <p>Amount: ${order.amount} USD</p>
              <p>Transaction ID: {shorten(order.id)}</p>
            </div>
          </div>
        </div>
      )}

      {uiState.showExpired && (
        <div className="modal">
          <div className="modal-content warning">
            <h2>Invoice Expired ⚠️</h2>
            <p>Please generate a new payment request.</p>
          </div>
        </div>
      )}
    </div>
  );
}