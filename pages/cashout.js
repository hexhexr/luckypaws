// pages/cashout.js

import { useState } from "react";

export default function Cashout() {
  const [bolt11, setBolt11] = useState("");
  const [decodedAmount, setDecodedAmount] = useState(null);
  const [manualAmount, setManualAmount] = useState("");
  const [status, setStatus] = useState("");

  const decodeInvoice = async () => {
    setStatus("Decoding invoice...");
    setDecodedAmount(null);
    const res = await fetch("/api/decode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bolt11 }),
    });
    const data = await res.json();
    if (res.ok) {
      setDecodedAmount(data.amount);
      setStatus(`Invoice decoded. Amount: ${data.amount ? data.amount + " sats" : "none"}`);
    } else {
      setStatus("Failed to decode invoice: " + data.message);
    }
  };

  const sendPayment = async () => {
    setStatus("Sending payment...");

    const res = await fetch("/api/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bolt11,
        amount: decodedAmount ? null : parseInt(manualAmount),
      }),
    });

    const data = await res.json();
    if (res.ok) {
      setStatus(`✅ Payment sent! ${data.sentAmount} sats`);
    } else {
      setStatus("❌ Error: " + data.message);
    }
  };

  return (
    <div style={{ padding: "2rem", maxWidth: 600, margin: "auto" }}>
      <h2>Cashout via Lightning</h2>

      <label>Paste BOLT11 Invoice:</label>
      <textarea
        value={bolt11}
        onChange={(e) => setBolt11(e.target.value)}
        rows={4}
        style={{ width: "100%", marginBottom: "1rem" }}
      />

      <button onClick={decodeInvoice}>Check Invoice</button>

      {decodedAmount === null ? null : decodedAmount > 0 ? (
        <p>Invoice has fixed amount: <strong>{decodedAmount} sats</strong></p>
      ) : (
        <div>
          <label>Enter Amount (sats):</label>
          <input
            type="number"
            value={manualAmount}
            onChange={(e) => setManualAmount(e.target.value)}
            style={{ width: "100%", marginBottom: "1rem" }}
          />
        </div>
      )}

      <button onClick={sendPayment} style={{ marginTop: "1rem" }}>
        Send Payment
      </button>

      <p style={{ marginTop: "1rem" }}>{status}</p>
    </div>
  );
}
