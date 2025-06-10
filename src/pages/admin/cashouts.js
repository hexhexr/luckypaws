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
  const [paymentGatewayId, setPaymentGatewayId] = useState('');


  // --- STATES FOR CASHOUT HISTORY ---
  const [cashoutHistory, setCashoutHistory] = useState([]);
  const [loadingCashoutHistory, setLoadingCashoutHistory] = useState(true);
  const [totalCashouts, setTotalCashouts] = useState(0);


  // Authentication check and Admin role verification
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
      if (user) {
        // Check if user's document exists and has isAdmin: true
        const userDocRef = doc(db, 'users', user.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists() && userDocSnap.data().isAdmin) {
          setIsAdmin(true);
          console.log("Firebase user is signed in and is an admin. Proceeding to dashboard.");
        } else {
          // Not an admin or isAdmin not true
          setIsAdmin(false);
          router.replace('/admin'); // Redirect to login
          console.log("Firebase user is signed in but not an admin. Redirecting...");
        }
      } else {
        // No user signed in
        setIsAdmin(false);
        router.replace('/admin'); // Redirect to login
        console.log("No Firebase user signed in. Showing login form.");
      }
      setLoading(false);
    });

    return () => unsubscribe(); // Cleanup subscription
  }, [router]);


  // Logout function
  const logout = useCallback(async () => {
    try {
      await firebaseAuth.signOut();
      localStorage.removeItem('admin_auth'); // Clear local storage flag
      router.push('/admin'); // Redirect to login page
    } catch (error) {
      console.error("Error logging out:", error);
      alert("Failed to log out.");
    }
  }, [router]);


  // Function to load cashout history
  const loadCashoutHistory = useCallback(async () => {
    if (!isAdmin) return; // Only fetch if admin is confirmed

    setLoadingCashoutHistory(true);
    try {
      // Listen for real-time updates to cashout history
      // IMPORTANT: Changed collection from 'cashouts' to 'profitLoss'
      const q = query(collection(db, 'profitLoss'), orderBy('time', 'desc'));

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const history = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          // Ensure time is a proper date string for display, handling Firestore Timestamp
          time: doc.data().time?.toDate ? doc.data().time.toDate().toISOString() : doc.data().time
        }));
        setCashoutHistory(history);
        setTotalCashouts(history.length);
      }, (error) => {
        console.error('Error listening to cashout history:', error);
        // Show error to user
      });

      return () => unsubscribe(); // Cleanup real-time listener on component unmount
    } catch (err) {
      console.error('Error loading cashout history:', err);
      // Show error to user if the initial setup fails
    } finally {
      setLoadingCashoutHistory(false);
    }
  }, [isAdmin]);


  // Effect to load history when admin status is confirmed
  useEffect(() => {
    if (isAdmin) {
      const unsubscribe = loadCashoutHistory(); // loadCashoutHistory returns unsubscribe function
      return () => {
        if (unsubscribe) unsubscribe(); // Cleanup listener
      };
    }
  }, [isAdmin, loadCashoutHistory]);


  // Function to send a cashout
  const handleSendCashout = useCallback(async (e) => {
    e.preventDefault();
    setIsSendingCashout(true);
    setCashoutStatus({ message: '', type: '' });

    if (!cashoutUsername || !cashoutDestination || !cashoutAmount) {
      setCashoutStatus({ message: 'Please fill in all fields.', type: 'error' });
      setIsSendingCashout(false);
      return;
    }

    try {
      let parsedInvoice;
      try {
        // Attempt to decode as Bolt11 invoice
        parsedInvoice = bolt11.decode(cashoutDestination);
        setIsLightningAddressDetected(false); // Reset if it was set
      } catch (invoiceErr) {
        // If not a Bolt11, check if it's a Lightning Address (simple regex for @ symbol)
        if (cashoutDestination.includes('@')) {
          setIsLightningAddressDetected(true);
          parsedInvoice = { // Create a mock invoice object for Lightning Address handling
            amount: 0, // Amount for Lightning Address is usually determined by the sender
            description: `Cashout to Lightning Address: ${cashoutDestination}`
          };
        } else {
          throw new Error('Invalid Lightning destination. Must be a Bolt11 invoice or Lightning Address.');
        }
      }

      // Determine BTC amount if invoice has an amount, otherwise it's amountless and amountUSD will be sent
      const btcAmountFromInvoice = parsedInvoice.amount ? parseFloat(parsedInvoice.amount) / 1000 : 0; // Convert millisatoshis to BTC

      // Add cashout request to Firestore
      // IMPORTANT: Changed collection from 'cashouts' to 'profitLoss'
      await addDoc(collection(db, 'profitLoss'), {
        username: cashoutUsername,
        destination: cashoutDestination,
        amountUSD: parseFloat(cashoutAmount),
        amountBTC: btcAmountFromInvoice, // Use BTC amount from invoice if present, else 0
        description: isLightningAddressDetected ? `Lightning Address cashout for ${cashoutAmount} USD` : `Lightning cashout for ${cashoutAmount} USD`,
        status: 'pending', // Initial status
        time: new Date(), // Use server timestamp when deploying to production for consistency
        type: isLightningAddressDetected ? 'cashout_lightning_address' : 'cashout_lightning',
        paymentGatewayId: paymentGatewayId || 'N/A' // Include paymentGatewayId
      });

      setCashoutStatus({ message: 'Cashout request added successfully!', type: 'success' });
      // Clear form
      setCashoutUsername('');
      setCashoutDestination('');
      setCashoutAmount('');
      setPaymentGatewayId('');
      setIsAmountlessInvoice(false);
      setIsLightningAddressDetected(false);

    } catch (error) {
      console.error('Error sending cashout:', error);
      setCashoutStatus({ message: `Error sending cashout: ${error.message}`, type: 'error' });
    } finally {
      setIsSendingCashout(false);
    }
  }, [cashoutUsername, cashoutDestination, cashoutAmount, paymentGatewayId, isAmountlessInvoice, isLightningAddressDetected]);


  const handleDestinationChange = useCallback((e) => {
    const value = e.target.value;
    setCashoutDestination(value);
    // Check if it's an amountless invoice or lightning address for UI adjustments
    try {
      const decoded = bolt11.decode(value);
      setIsAmountlessInvoice(!decoded.amount);
      setIsLightningAddressDetected(false);
    } catch (error) {
      setIsAmountlessInvoice(false); // Not a valid invoice
      setIsLightningAddressDetected(value.includes('@')); // Check for lightning address
    }
  }, []);

  if (loading) {
    return <div className="container mt-md text-center">Loading admin panel...</div>;
  }

  if (!isAdmin) {
    return <div className="container mt-md text-center alert alert-danger">Access Denied. Redirecting...</div>;
  }

  return (
    <div className="container mt-md">
      <Head>
        <title>Admin - Cashouts</title>
      </Head>
      <div className="card">
        <div className="admin-header">
          <h1 className="text-xl">💰 Cashout Management</h1>
          <button className="btn btn-secondary" onClick={logout}>Logout</button>
        </div>

        <section className="admin-section mt-lg">
          <h2 className="text-lg">Send New Cashout</h2>
          <form onSubmit={handleSendCashout} className="form-grid">
            <div className="form-group">
              <label htmlFor="cashoutUsername">Username:</label>
              <input
                id="cashoutUsername"
                className="input"
                type="text"
                value={cashoutUsername}
                onChange={(e) => setCashoutUsername(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="cashoutDestination">Lightning Invoice / Address:</label>
              <input
                id="cashoutDestination"
                className="input"
                type="text"
                value={cashoutDestination}
                onChange={handleDestinationChange}
                placeholder="lnbc1..., username@domain.com"
                required
              />
              {isLightningAddressDetected && (
                <small className="text-info mt-sm">Detected Lightning Address. Amount will be sent based on USD amount.</small>
              )}
              {isAmountlessInvoice && (
                <small className="text-info mt-sm">Detected Amountless Invoice. Amount will be sent based on USD amount.</small>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="cashoutAmount">USD Amount:</label>
              <input
                id="cashoutAmount"
                className="input"
                type="number"
                step="0.01"
                value={cashoutAmount}
                onChange={(e) => setCashoutAmount(e.target.value)}
                required
                min="0.01"
              />
            </div>

            <div className="form-group">
              <label htmlFor="paymentGatewayId">Payment Gateway ID (Optional):</label>
              <input
                id="paymentGatewayId"
                className="input"
                type="text"
                value={paymentGatewayId}
                onChange={(e) => setPaymentGatewayId(e.target.value)}
                placeholder="Optional ID for tracking"
              />
            </div>

            <button type="submit" className="btn btn-primary btn-block" disabled={isSendingCashout}>
              {isSendingCashout ? 'Sending...' : 'Send Cashout'}
            </button>
          </form>
          {cashoutStatus.message && (
            <div className={`alert mt-md ${cashoutStatus.type === 'error' ? 'alert-danger' : 'alert-success'}`}>
              {cashoutStatus.message}
            </div>
          )}
        </section>

        <section className="admin-section mt-lg">
          <h2 className="text-lg">Cashout History ({totalCashouts})</h2>
          {loadingCashoutHistory ? (
            <p>Loading cashout history...</p>
          ) : (
            <div className="table-responsive">
              <table className="table table-striped">
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
        </section>
      </div>
    </div>
  );
}