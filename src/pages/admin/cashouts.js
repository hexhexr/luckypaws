// pages/admin/cashouts.js
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import * as bolt11 from 'lightning-invoice'; // Ensure this library is installed: npm install lightning-invoice
import Head from 'next/head'; // Import Head for page title

// Import Firebase client-side SDK elements
import { db, auth as firebaseAuth } from '../../lib/firebaseClient';
import { collection, query, orderBy, onSnapshot, addDoc, doc, getDoc, updateDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';


export default function AdminCashouts() {
  const router = useRouter();

  // --- AUTHENTICATION STATES ---
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  // --- STATES FOR CASHOUT FORM ---
  const [cashoutUsername, setCashoutUsername] = useState('');
  const [cashoutDestination, setCashoutDestination] = useState('');
  const [cashoutAmount, setCashoutAmount] = useState(''); // Amount in USD
  const [isSendingCashout, setIsSendingCashout] = useState(false);
  const [cashoutStatus, setCashoutStatus] = useState({ message: '', type: '' }); // type: 'success', 'error', 'info'
  const [isAmountlessInvoice, setIsAmountlessInvoice] = useState(false);
  const [isLightningAddressDetected, setIsLightningAddressDetected] = useState(false);
  const [isUSDAmountLocked, setIsUSDAmountLocked] = useState(false); // New state for locking USD amount

  // --- STATES FOR CASHOUT HISTORY ---
  const [cashoutHistory, setCashoutHistory] = useState([]);
  const [loadingCashoutHistory, setLoadingCashoutHistory] = useState(true);

  // --- AUTHENTICATION AND ROLE CHECK (Same as dashboard.js) ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
      if (user) {
        // User is signed in, now check their role in Firestore
        try {
          const userDocRef = doc(db, 'users', user.uid);
          const userDocSnap = await getDoc(userDocRef);

          if (userDocSnap.exists() && userDocSnap.data()?.isAdmin) {
            setIsAdmin(true);
            setLoading(false);
          } else {
            // User is signed in but not an admin
            console.log('User is not an admin. Redirecting.');
            await firebaseAuth.signOut(); // Sign them out
            router.replace('/admin');
          }
        } catch (e) {
          console.error("Error checking admin role:", e);
          await firebaseAuth.signOut(); // Sign out on error
          router.replace('/admin');
        }
      } else {
        // No user is signed in
        console.log('No user signed in. Redirecting to admin login.');
        router.replace('/admin');
      }
    });

    return () => unsubscribe(); // Clean up auth listener
  }, [router]);


  // --- LOGOUT FUNCTION (Same as dashboard.js) ---
  const logout = useCallback(async () => {
    try {
      await firebaseAuth.signOut();
      router.push('/admin');
    } catch (err) {
      console.error("Logout error:", err);
      alert('Failed to logout. Please try again.');
    }
  }, [router]);

  // --- CASHOUT HISTORY LOADING ---
  useEffect(() => {
    if (!isAdmin) return; // Only load history if user is confirmed admin

    setLoadingCashoutHistory(true);
    const cashoutsQuery = query(collection(db, 'cashouts'), orderBy('time', 'desc'));
    const unsubscribe = onSnapshot(cashoutsQuery, (snapshot) => {
      const history = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        time: doc.data().time?.toDate ? doc.data().time.toDate().toISOString() : doc.data().time // Convert Timestamp to ISO string if needed
      }));
      setCashoutHistory(history);
      setLoadingCashoutHistory(false);
    }, (error) => {
      console.error("Error fetching cashout history:", error);
      setCashoutStatus({ message: 'Error loading cashout history.', type: 'error' });
      setLoadingCashoutHistory(false);
    });

    return () => unsubscribe(); // Clean up listener
  }, [isAdmin]); // Depend on isAdmin

  // --- CASHOUT FORM LOGIC ---
  const handleDestinationChange = (e) => {
    const value = e.target.value;
    setCashoutDestination(value);

    // Detect Lightning Address (LNURL-pay) format
    const isLNAddress = value.includes('@');
    setIsLightningAddressDetected(isLNAddress);
    setIsAmountlessInvoice(false); // Reset for new destination

    // If it's a bolt11 invoice, parse it
    if (!isLNAddress && value.startsWith('lnbc')) {
      try {
        const decoded = bolt11.decode(value);
        if (decoded.millisatoshis) {
          const btcAmount = parseFloat(decoded.millisatoshis) / 1000 / 100_000_000; // Convert msats to BTC
          // For simplicity, let's assume a fixed BTC to USD rate or fetch one
          // For now, let's just update the BTC amount and lock USD
          // You'll need to implement your own BTC to USD conversion here
          const estimatedUSD = (btcAmount * 70000).toFixed(2); // Example: $70,000 per BTC
          setCashoutAmount(estimatedUSD);
          setIsUSDAmountLocked(true); // Lock the USD input
          setIsAmountlessInvoice(false);
        } else {
          setIsAmountlessInvoice(true); // Invoice without amount
          setIsUSDAmountLocked(false); // Unlock USD input if amountless
        }
      } catch (err) {
        console.error("Error decoding invoice:", err);
        setCashoutStatus({ message: 'Invalid Lightning Invoice.', type: 'error' });
        setIsAmountlessInvoice(false);
        setIsUSDAmountLocked(false);
      }
    } else {
      setIsUSDAmountLocked(false); // Unlock if not a bolt11 invoice
    }
  };

  const handleCashoutSubmit = async (e) => {
    e.preventDefault();
    setCashoutStatus({ message: '', type: '' }); // Clear previous status

    if (!cashoutUsername || !cashoutDestination || (!cashoutAmount && !isAmountlessInvoice)) {
      setCashoutStatus({ message: 'Please fill all required fields.', type: 'error' });
      return;
    }

    if (parseFloat(cashoutAmount) <= 0 && !isAmountlessInvoice) {
      setCashoutStatus({ message: 'Amount must be positive.', type: 'error' });
      return;
    }

    setIsSendingCashout(true);
    try {
      // Logic for sending cashout (via API route, as this should be server-side)
      // This part would typically call a Vercel API route that uses the Admin SDK
      // Example:
      const res = await fetch('/api/admin/processCashout', { // You'll need to create this API route
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // You might send the admin's ID token if your API needs to verify it server-side
          // 'Authorization': `Bearer ${await firebaseAuth.currentUser.getIdToken()}`
        },
        body: JSON.stringify({
          username: cashoutUsername,
          destination: cashoutDestination,
          amountUSD: isAmountlessInvoice ? null : parseFloat(cashoutAmount),
          isAmountlessInvoice: isAmountlessInvoice,
          isLightningAddress: isLightningAddressDetected,
          // Add any other necessary data like admin's UID for logging
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setCashoutStatus({ message: data.message || 'Cashout initiated successfully!', type: 'success' });
        setCashoutUsername('');
        setCashoutDestination('');
        setCashoutAmount('');
        setIsAmountlessInvoice(false);
        setIsLightningAddressDetected(false);
        setIsUSDAmountLocked(false);
      } else {
        setCashoutStatus({ message: data.error || 'Failed to initiate cashout.', type: 'error' });
      }
    } catch (err) {
      console.error("Error processing cashout:", err);
      setCashoutStatus({ message: `An unexpected error occurred: ${err.message}`, type: 'error' });
    } finally {
      setIsSendingCashout(false);
    }
  };

  // --- CONDITIONAL RENDERING FOR LOADING/ACCESS ---
  if (loading) {
    return (
      <div className="container mt-lg text-center">
        <p>Loading admin panel...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="container mt-lg text-center">
        <p>Access Denied. You are not authorized to view this page.</p>
      </div>
    );
  }

  // --- RENDER ADMIN CASHOUTS PAGE ---
  return (
    <div className="admin-cashouts-container">
      <Head>
        <title>Admin Cashouts</title>
      </Head>
      <header className="admin-header">
        <h1>Admin Cashouts</h1>
        <nav>
          <ul className="admin-nav">
            <li><a href="/admin/dashboard" className={router.pathname === "/admin/dashboard" ? "active" : ""}>Dashboard</a></li>
            <li><a href="/admin/cashouts" className={router.pathname === "/admin/cashouts" ? "active" : ""}>Cashouts</a></li>
            <li><a href="/admin/games" className={router.pathname === "/admin/games" ? "active" : ""}>Games</a></li>
            <li><a href="/admin/profit-loss" className={router.pathname === "/admin/profit-loss" ? "active" : ""}>Profit/Loss</a></li>
            <li><button onClick={logout} className="btn btn-secondary">Logout</button></li>
          </ul>
        </nav>
      </header>

      <div className="admin-main">
        <section className="cashout-form-section">
          <h2>Process New Cashout</h2>
          <div className="card">
            <form onSubmit={handleCashoutSubmit}>
              <label htmlFor="cashoutUsername">Username:</label>
              <input
                id="cashoutUsername"
                type="text"
                className="input"
                value={cashoutUsername}
                onChange={(e) => setCashoutUsername(e.target.value)}
                placeholder="User's Username"
                required
              />

              <label htmlFor="cashoutDestination">Lightning Invoice / Address:</label>
              <input
                id="cashoutDestination"
                type="text"
                className="input"
                value={cashoutDestination}
                onChange={handleDestinationChange}
                placeholder="lnbc... or user@domain.com"
                required
              />

              {isLightningAddressDetected && (
                <p className="form-info">Lightning Address detected. An invoice will be requested from the address.</p>
              )}

              <label htmlFor="cashoutAmount">Amount (USD):</label>
              <input
                id="cashoutAmount"
                type="number"
                step="0.01"
                className="input"
                value={cashoutAmount}
                onChange={(e) => setCashoutAmount(e.target.value)}
                placeholder="Amount in USD"
                required={!isAmountlessInvoice}
                disabled={isUSDAmountLocked || isAmountlessInvoice} // Disable if invoice has amount or is amountless
              />
              {isAmountlessInvoice && (
                <p className="form-info text-warning">Amountless invoice detected. USD amount will be determined by your system.</p>
              )}
              {isUSDAmountLocked && (
                <p className="form-info text-info">Amount locked by invoice.</p>
              )}


              <button className="btn btn-primary mt-md" type="submit" disabled={isSendingCashout}>
                {isSendingCashout ? 'Processing...' : 'Send Cashout'}
              </button>
            </form>
            {cashoutStatus.message && (
              <div className={`alert alert-${cashoutStatus.type} mt-md`}>
                {cashoutStatus.message}
              </div>
            )}
          </div>
        </section>

        <section className="cashout-history-section mt-lg">
          <h2>Cashout History</h2>
          <div className="card table-card">
            {loadingCashoutHistory ? (
              <p className="text-center">Loading cashout history...</p>
            ) : cashoutHistory.length === 0 ? (
              <p className="text-center">No cashout history found.</p>
            ) : (
              <div className="table-responsive">
                <table>
                  <thead>
                    <tr>
                      <th>Username</th>
                      <th>Destination</th>
                      <th>USD Amount</th>
                      <th>BTC Amount</th>
                      <th>Status</th>
                      <th>Time</th>
                      <th>Gateway ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cashoutHistory.map((cashout) => (
                      <tr key={cashout.id}>
                        <td>{cashout.username}</td>
                        <td>{cashout.destination.length > 30 ? `${cashout.destination.substring(0, 30)}...` : cashout.destination}</td>
                        <td>{cashout.amountUSD ? `$${parseFloat(cashout.amountUSD).toFixed(2)}` : 'N/A'}</td>
                        <td>{cashout.amountBTC ? parseFloat(cashout.amountBTC).toFixed(8) : 'N/A'}</td>
                        <td style={{
                          color: cashout.status === 'completed' ? 'green' :
                                 cashout.status === 'pending' ? '#ff9800' :
                                 '#d63031'
                        }}>
                          {cashout.status}
                        </td>
                        <td>{cashout.time ? new Date(cashout.time).toLocaleString() : 'N/A'}</td>
                        <td>{cashout.paymentGatewayId || 'N/A'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}