// pages/agent/index.js
import { useState, useEffect, useCallback, useMemo } from 'react';
import Head from 'next/head';
// Import db, but be aware it might be null during SSR/build phase if firebaseClient.js guards against it.
import { db } from '../../lib/firebaseClient'; // Ensure this path is correct for your Firebase client initialization

export default function AgentPage() {
  const [pageCode, setPageCode] = useState('');
  const [lockPageCode, setLockCodePage] = useState(false);
  const [isSavingPageCode, setIsSavingPageCode] = useState(false); // New state for saving page code to Firebase
  const [facebookName, setFacebookName] = useState('');
  const [generatedUsername, setGeneratedUsername] = useState(''); // Single username
  const [message, setMessage] = useState({ text: '', type: '' });
  const [isLoading, setIsLoading] = useState(false);

  // For selected customer financials
  const [customerUsername, setCustomerUsername] = useState('');
  const [cashoutLimitRemaining, setCashoutLimitRemaining] = useState(300); // Default to 300
  const [customerFinancialsLoading, setCustomerFinancialsLoading] = useState(false);

  // For global live deposits
  const [last10AllDeposits, setLast10AllDeposits] = useState([]);
  const [allDepositsListener, setAllDepositsListener] = useState(null); // Listener for all deposits


  // --- Firebase Page Code Locking Logic ---
  // Firebase Document Reference for Agent Settings (assuming a single agent config for now)
  const agentSettingsRef = db ? db.collection('agentSettings').doc('pageCodeConfig') : null;

  // Function to save page code settings to Firebase
  const savePageCodeSettingsToFirebase = useCallback(async (codeToSave, lockState) => {
    if (!agentSettingsRef) {
      console.warn('Firebase client (db) not initialized for saving agent settings.');
      setMessage({ text: 'Firebase is not ready to save settings.', type: 'error' });
      return;
    }
    setIsSavingPageCode(true);
    try {
      if (lockState) {
        await agentSettingsRef.set({
          pageCode: codeToSave,
          locked: true,
          updatedAt: new Date().toISOString()
        });
        setMessage({ text: 'Page code locked and saved to Firebase!', type: 'success' });
      } else {
        await agentSettingsRef.set({ // Or update to set locked: false if you want to keep the code but unlock
          pageCode: '', // Clear page code in Firebase if unlocked
          locked: false,
          updatedAt: new Date().toISOString()
        });
        setMessage({ text: 'Page code unlocked and cleared from Firebase.', type: 'success' });
      }
    } catch (error) {
      console.error('Error saving page code to Firebase:', error);
      setMessage({ text: `Failed to save page code settings: ${error.message}`, type: 'error' });
    } finally {
      setIsSavingPageCode(false);
    }
  }, [agentSettingsRef]);

  // Effect to load page code and lock status from Firebase on component mount
  useEffect(() => {
    if (!agentSettingsRef) {
      console.warn('Firebase client (db) not initialized for loading agent settings.');
      return;
    }

    const unsubscribe = agentSettingsRef.onSnapshot(
      (docSnapshot) => {
        if (docSnapshot.exists) {
          const data = docSnapshot.data();
          if (data.locked && data.pageCode) {
            setPageCode(data.pageCode);
            setLockCodePage(true);
            setMessage({ text: 'Page code loaded and locked from Firebase.', type: 'success' });
          } else {
            setLockCodePage(false);
            // Optionally clear pageCode if it was previously locked and then unlocked in Firebase
            // setPageCode(''); 
          }
        } else {
          // Document doesn't exist, so no locked page code
          setLockCodePage(false);
        }
      },
      (error) => {
        console.error('Error loading page code from Firebase:', error);
        setMessage({ text: `Failed to load page code settings: ${error.message}`, type: 'error' });
      }
    );

    return () => unsubscribe(); // Unsubscribe on component unmount
  }, [agentSettingsRef]);


  // Effect to save/update page code in Firebase when lock status changes or locked pageCode changes
  useEffect(() => {
    // Only save if Firebase is initialized and not currently saving
    if (db && !isSavingPageCode) {
      // If locked, save the current pageCode
      if (lockPageCode && pageCode.trim() !== '') {
        savePageCodeSettingsToFirebase(pageCode, true);
      } else if (!lockPageCode) {
        // If unlocked, clear the page code in Firebase
        savePageCodeSettingsToFirebase('', false);
      }
    }
  }, [lockPageCode, pageCode, db, isSavingPageCode, savePageCodeSettingsToFirebase]); // Added db and isSavingPageCode to dependencies


  const handleGenerateUsername = async (e) => {
    e.preventDefault();
    setMessage({ text: '', type: '' });
    setGeneratedUsername('');
    setIsLoading(true);

    if (!facebookName.trim()) {
      setMessage({ text: 'Please enter a Facebook name.', type: 'error' });
      setIsLoading(false);
      return;
    }
    if (!pageCode.trim()) {
      setMessage({ text: 'Please enter a Page Code.', type: 'error' });
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/generate-username', { // Changed to single username API
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ facebookName, pageCode }),
      });

      const data = await response.json();

      if (response.ok) {
        setGeneratedUsername(data.username);
        setMessage({ text: data.message, type: 'success' });
      } else {
        // Handle the 400/409 Conflict status specifically
        setMessage({ text: data.message || 'An unknown error occurred.', type: 'error' });
        setGeneratedUsername(data.username || ''); // Still show attempted username for context
      }
    } catch (error) {
      console.error('Frontend error:', error);
      setMessage({ text: 'Network error. Please try again.', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  // --- Customer Cashout Limit Logic (now with a button) ---
  const fetchCustomerCashoutLimit = useCallback(async () => {
    if (!customerUsername.trim()) {
      setMessage({ text: 'Please enter a customer username to check limit.', type: 'error' });
      setCashoutLimitRemaining(300); // Reset to default if no username
      return;
    }

    setCustomerFinancialsLoading(true);
    setMessage({ text: '', type: '' }); // Clear any previous messages

    try {
      const cashoutRes = await fetch(`/api/customer-cashout-limit?username=${encodeURIComponent(customerUsername)}`);
      const cashoutData = await cashoutRes.json();
      if (cashoutRes.ok) {
        setCashoutLimitRemaining(cashoutData.remainingLimit);
      } else {
        setMessage({ text: `Cashout limit error: ${cashoutData.message}`, type: 'error' });
        setCashoutLimitRemaining(300); // Reset to default on error
      }
    } catch (error) {
      console.error('Error fetching cashout limit:', error);
      setMessage({ text: 'Network error fetching cashout limit.', type: 'error' });
    } finally {
      setCustomerFinancialsLoading(false);
    }
  }, [customerUsername]); // Only depends on customerUsername now


  // Effect for GLOBAL Last 10 Deposits (live)
  useEffect(() => {
    // Ensure db is available before trying to use it
    if (!db) {
      console.warn('Firebase client (db) not initialized. This might be a server-side render or build environment. Live deposits will not load.');
      setMessage({ text: 'Failed to load live deposits for all users: Firebase not initialized.', type: 'error' });
      return;
    }

    // If an existing listener is active, unsubscribe it first
    if (allDepositsListener) {
      allDepositsListener();
    }

    const depositsRef = db
      .collection('orders')
      .where('status', '==', 'paid') // Only paid deposits
      .orderBy('createdAt', 'desc')
      .limit(10); // Get the last 10 for all users

    const unsubscribe = depositsRef.onSnapshot(
      (snapshot) => {
        const deposits = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setLast10AllDeposits(deposits);
        setMessage({ text: '', type: '' }); // Clear error if data loads successfully
      },
      (error) => {
        console.error('Error fetching real-time deposits for all users:', error);
        setMessage({ text: 'Failed to load live deposits for all users: Connection error.', type: 'error' });
      }
    );
    setAllDepositsListener(() => unsubscribe); // Store the unsubscribe function

    // Cleanup function to unsubscribe from listener when component unmounts
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [db]); // Dependency on `db` to re-run if it becomes available later


  const styles = useMemo(() => ({
    container: {
      minHeight: '100vh',
      padding: '0 0.5rem',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#f0f2f5',
      fontFamily: 'Arial, sans-serif',
      fontSize: '14px', // Smaller base font for extension
    },
    main: {
      padding: '1.5rem', // Smaller padding
      borderRadius: '8px',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)', // Lighter shadow
      backgroundColor: '#ffffff',
      textAlign: 'center',
      maxWidth: '400px', // Smaller max width
      width: '100%',
    },
    title: {
      fontSize: '1.5rem', // Smaller title
      marginBottom: '1rem',
      color: '#333',
    },
    description: {
      fontSize: '0.9rem',
      color: '#555',
      marginBottom: '1rem',
    },
    section: {
      border: '1px solid #e0e0e0',
      borderRadius: '6px',
      padding: '1rem',
      marginBottom: '1rem',
      backgroundColor: '#f9f9f9',
    },
    sectionTitle: {
      fontSize: '1.1rem',
      color: '#333',
      marginBottom: '0.8rem',
      borderBottom: '1px solid #eee',
      paddingBottom: '0.5rem',
    },
    form: {
      display: 'flex',
      flexDirection: 'column',
      gap: '0.8rem', // Smaller gap
      marginBottom: '1rem',
    },
    inputGroup: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-start',
    },
    label: {
      marginBottom: '0.4rem',
      fontSize: '0.85rem',
      color: '#444',
    },
    input: {
      width: '100%',
      padding: '0.6rem', // Smaller padding
      fontSize: '0.9rem',
      border: '1px solid #ddd',
      borderRadius: '4px',
    },
    checkboxGroup: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      justifyContent: 'flex-start',
    },
    button: {
      padding: '0.6rem 1rem', // Smaller padding
      fontSize: '0.9rem',
      backgroundColor: '#0070f3',
      color: 'white',
      border: 'none',
      borderRadius: '4px',
      cursor: 'pointer',
      transition: 'background-color 0.2s ease-in-out',
    },
    buttonDisabled: {
      backgroundColor: '#cccccc',
      cursor: 'not-allowed',
    },
    successMessage: {
      color: '#28a745',
      fontSize: '0.9rem',
      marginTop: '0.8rem',
    },
    errorMessage: {
      color: '#dc3545',
      fontSize: '0.9rem',
      marginTop: '0.8rem',
    },
    resultContainer: {
      marginTop: '1.5rem',
      padding: '1rem',
      border: '1px dashed #0070f3',
      borderRadius: '8px',
      backgroundColor: '#e6f2ff',
      textAlign: 'left',
    },
    resultTitle: {
      fontSize: '1.1rem',
      color: '#0070f3',
      marginBottom: '0.6rem',
    },
    usernameDisplay: { // For single username
      fontSize: '1.2rem',
      fontWeight: 'bold',
      color: '#333',
      wordBreak: 'break-all',
      textAlign: 'center',
      padding: '0.5rem',
      backgroundColor: '#fff',
      border: '1px solid #ccc',
      borderRadius: '4px',
    },
    financialsSummary: {
      display: 'flex',
      flexDirection: 'column',
      gap: '0.5rem',
      textAlign: 'left',
      fontSize: '0.9rem',
    },
    depositsTable: {
      width: '100%',
      borderCollapse: 'collapse',
      marginTop: '1rem',
    },
    tableHeader: {
      backgroundColor: '#e0e0e0',
      padding: '0.5rem',
      border: '1px solid #ccc',
      textAlign: 'left',
      fontSize: '0.8rem',
    },
    tableCell: {
      padding: '0.5rem',
      border: '1px solid #eee',
      textAlign: 'left',
      fontSize: '0.8rem',
    },
    textSuccess: { color: '#28a745' },
    textDanger: { color: '#dc3545' },
    textWarning: { color: '#ffc107' },
  }), []);

  return (
    <div style={styles.container}>
      <Head>
        <title>Agent Username & Customer Tracker</title>
        <meta name="description" content="Generate usernames and track customer financials for agents" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main style={styles.main}>
        <h1 style={styles.title}>Agent Tools</h1>

        {/* Username Generation Section */}
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>Generate Username</h2>
          <form onSubmit={handleGenerateUsername} style={styles.form}>
            <div style={styles.inputGroup}>
              <label htmlFor="pageCode" style={styles.label}>Page Code:</label>
              <input
                type="text"
                id="pageCode"
                value={pageCode}
                onChange={(e) => setPageCode(e.target.value)}
                placeholder="e.g., 7976"
                required
                style={styles.input}
                disabled={lockPageCode || isLoading || isSavingPageCode}
              />
              <div style={styles.checkboxGroup}>
                <input
                  type="checkbox"
                  id="lockPageCode"
                  checked={lockPageCode}
                  onChange={(e) => setLockCodePage(e.target.checked)} // Toggling this will trigger useEffect for saving
                  disabled={isSavingPageCode}
                />
                <label htmlFor="lockPageCode" style={styles.label}>Lock Code (Save to Firebase)</label>
                {isSavingPageCode && <span style={{fontSize: '0.8em', marginLeft: '0.5rem', color: '#0070f3'}}>Saving...</span>}
              </div>
            </div>

            <div style={styles.inputGroup}>
              <label htmlFor="facebookName" style={styles.label}>Customer Facebook Name:</label>
              <input
                type="text"
                id="facebookName"
                value={facebookName}
                onChange={(e) => setFacebookName(e.target.value)}
                placeholder="e.g., Mandi Lee"
                required
                style={styles.input}
                disabled={isLoading}
              />
            </div>

            <button type="submit" disabled={isLoading} style={isLoading ? { ...styles.button, ...styles.buttonDisabled } : styles.button}>
              {isLoading ? 'Generating...' : 'Generate Username'}
            </button>
          </form>

          {message.text && (
            <p style={message.type === 'success' ? styles.successMessage : styles.errorMessage}>
              {message.text}
            </p>
          )}

          {generatedUsername && (
            <div style={styles.resultContainer}>
              <h3 style={styles.resultTitle}>Generated Username:</h3>
              <p style={styles.usernameDisplay}>{generatedUsername}</p>
            </div>
          )}
        </div>

        {/* Customer Financials Section (for selected customer) */}
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>Customer Cashout Tracker</h2>
          <div style={styles.form}>
            <div style={styles.inputGroup}>
              <label htmlFor="customerUsername" style={styles.label}>Enter Customer Username:</label>
              <input
                type="text"
                id="customerUsername"
                value={customerUsername}
                onChange={(e) => setCustomerUsername(e.target.value)}
                placeholder="e.g., mandilee7976"
                style={styles.input}
                disabled={customerFinancialsLoading}
              />
            </div>
            <button
              type="button" // Important: not submit
              onClick={fetchCustomerCashoutLimit}
              disabled={customerFinancialsLoading || !customerUsername.trim()}
              style={customerFinancialsLoading || !customerUsername.trim() ? { ...styles.button, ...styles.buttonDisabled } : styles.button}
            >
              {customerFinancialsLoading ? 'Checking Limit...' : 'Check Cashout Limit'}
            </button>
          </div>

          {customerFinancialsLoading ? (
            <p style={{...styles.successMessage, color: '#0070f3'}}>Loading customer data...</p>
          ) : (
            customerUsername.trim() && ( // Only show if a username was entered
              <div style={styles.financialsSummary}>
                <p>24-hour Cashout Limit Remaining:
                  <strong style={{ color: cashoutLimitRemaining >= 100 ? styles.textSuccess.color : styles.textWarning.color }}>
                    ${cashoutLimitRemaining.toFixed(2)}
                  </strong> / $300.00
                </p>
              </div>
            )
          )}
        </div>

        {/* Live All Deposits Section */}
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>Live Deposit Checker (Last 10 Deposits)</h2>
          {last10AllDeposits.length === 0 ? (
            <p>No recent deposits found. {message.type === 'error' && message.text.includes('live deposits') ? `(${message.text})` : ''}</p>
          ) : (
            <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #eee', borderRadius: '4px' }}>
              <table style={styles.depositsTable}>
                <thead>
                  <tr>
                    <th style={styles.tableHeader}>Username</th>
                    <th style={styles.tableHeader}>Amount (USD)</th>
                    <th style={styles.tableHeader}>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {last10AllDeposits.map((deposit) => (
                    <tr key={deposit.id}>
                      <td style={styles.tableCell}>{deposit.username}</td>
                      <td style={styles.tableCell}>${Number(deposit.amount).toFixed(2)}</td>
                      <td style={styles.tableCell}>{new Date(deposit.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}