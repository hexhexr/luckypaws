import React, { useState } from 'react';
import axios from 'axios';
import QRCode from 'react-qr-code';

export default function Home() {
  const [amount, setAmount] = useState('');
  const [username, setUsername] = useState('');
  const [invoiceData, setInvoiceData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    setInvoiceData(null);

    if (!amount || !username) {
      setError('Please fill out all fields.');
      setLoading(false);
      return;
    }

    try {
      const res = await axios.post('/api/createInvoice', {
        amount: parseFloat(amount),
        username: username.trim(),
      });

      if (res.data && res.data.invoice) {
        setInvoiceData(res.data);
        // Reset form only after success
        setAmount('');
        setUsername('');
      } else {
        setError('Invoice creation failed. Try again.');
      }
    } catch (err) {
      setError('Error generating invoice. Please try again.');
    }

    setLoading(false);
  };

  return (
    <div className="container">
      <div className="card">
        <h2 className="card-header">Generate Lightning Invoice</h2>

        <form onSubmit={handleSubmit}>
          {error && <div className="alert alert-danger">{error}</div>}

          <input
            type="number"
            className="input"
            placeholder="Enter amount in USD"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            min="0.01"
            step="0.01"
          />

          <input
            type="text"
            className="input"
            placeholder="Facebook username (e.g. lucky.paw123)"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />

          {/* Payment Method is Lightning-only */}
          <div className="radio-group">
            <label>
              <input type="radio" checked readOnly />
              Lightning (⚡)
            </label>
          </div>

          <button type="submit" className="btn btn-primary mt-md" disabled={loading}>
            {loading ? 'Generating...' : 'Generate Invoice'}
          </button>
        </form>

        {invoiceData && (
          <div className="modal-overlay">
            <div className="modal">
              <h3 className="receipt-header">Payment Invoice</h3>
              <div className="qr-container">
                <QRCode value={invoiceData.invoice} size={180} />
                <div className="qr-text">{invoiceData.invoice}</div>
              </div>
              <div className="mt-md">
                <button onClick={() => setInvoiceData(null)} className="btn btn-danger">
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
