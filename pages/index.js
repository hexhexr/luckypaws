import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode.react';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase, ref, set, onValue } from 'firebase/database';
import app from '../firebaseConfig';

const IndexPage = () => {
  const [amount, setAmount] = useState('');
  const [invoice, setInvoice] = useState('');
  const [btcAmount, setBtcAmount] = useState('');
  const [orderId, setOrderId] = useState('');
  const [isPaid, setIsPaid] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [shortAddress, setShortAddress] = useState('');

  const handlePayment = async (e) => {
    e.preventDefault();
    const id = uuidv4();
    setOrderId(id);
    const response = await fetch('/api/createspeedinvoice', {
      method: 'POST',
      body: JSON.stringify({ amount, orderId: id, paymentMethod: 'lightning' }),
    });
    const data = await response.json();
    if (data.paymentAddress) {
      const db = getDatabase(app);
      set(ref(db, 'orders/' + id), {
        orderId: id,
        paymentAddress: data.paymentAddress,
        paymentId: data.paymentId,
        amount: amount,
        status: 'unpaid',
        createdAt: Date.now(),
        paidManually: false,
      });
      setInvoice(data.paymentAddress);
      setShortAddress(
        `${data.paymentAddress.slice(0, 6)}...${data.paymentAddress.slice(-6)}`
      );
      setShowInvoiceModal(true);
    }
  };

  useEffect(() => {
    if (orderId) {
      const db = getDatabase(app);
      const orderRef = ref(db, 'orders/' + orderId);
      const unsubscribe = onValue(orderRef, async (snapshot) => {
        const order = snapshot.val();
        if (order && order.status === 'paid') {
          const btcRes = await fetch(`/api/getbtcrate`);
          const btcData = await btcRes.json();
          const rate = btcData.btcRate;
          const btc = (parseFloat(order.amount) / rate).toFixed(8);
          setBtcAmount(btc);
          setIsPaid(true);
          setShowInvoiceModal(false);
          setShowReceiptModal(true);
        }
      });
      return () => unsubscribe();
    }
  }, [orderId]);

  return (
    <div className="container">
      <h1>Lucky Paw's Fishing Room</h1>
      <form onSubmit={handlePayment} className="payment-form">
        <label htmlFor="amount">Enter Amount (USD)</label>
        <input
          type="number"
          id="amount"
          required
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <button type="submit">Generate Invoice</button>
      </form>

      {/* Invoice Modal */}
      {showInvoiceModal && (
        <div className="modal">
          <div className="modal-content">
            <h2>Pay with Lightning</h2>
            {invoice && <QRCode value={invoice} size={200} />}
            <p className="invoice-text">{invoice}</p>
            <button onClick={() => navigator.clipboard.writeText(invoice)}>Copy Invoice</button>
            <button className="close-btn" onClick={() => setShowInvoiceModal(false)}>Close</button>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {showReceiptModal && isPaid && (
        <div className="modal receipt-modal">
          <div className="modal-content">
            <h2>Payment Received</h2>
            <div className="receipt-box">
              <p className="usd-amount">${amount} USD</p>
              <p className="btc-amount">{btcAmount} BTC</p>
              <div className="receipt-detail">
                <p><strong>Order ID:</strong> {orderId}</p>
                <p><strong>Invoice:</strong> {shortAddress}</p>
              </div>
            </div>
            <button onClick={() => window.location.reload()}>Done</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default IndexPage;
