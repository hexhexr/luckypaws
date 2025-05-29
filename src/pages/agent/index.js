// pages/agent/index.js (Updated)
import { useState, useEffect, useCallback, useMemo } from 'react';
import Head from 'next/head';
import { db } from '../../lib/firebaseClient'; // Make sure this path is correct for client-side Firebase

export default function AgentPage() {
  const [pageCode, setPageCode] = useState('');
  const [lockPageCode, setLockPageCode] = useState(false);
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

  // Load page code from localStorage if locked
  useEffect(() => {
    if (localStorage.getItem('lockedPageCode')) {
      setPageCode(localStorage.getItem('lockedPageCode'));
      setLockPageCode(true);
    }
  }, []);

  // Save page code to localStorage if locked
  useEffect(() => {
    if (lockPageCode) {
      localStorage.setItem('lockedPageCode', pageCode);
    } else {
      localStorage.removeItem('lockedPageCode');
    }
  }, [lockPageCode, pageCode]);

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
        setMessage({ text: data.message || 'An unknown error occurred.', type: 'error' });
      }
    } catch (error) {
      console.error('Frontend error:', error);
      setMessage({ text: 'Network error. Please try again.', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCustomerCashoutLimit = useCallback(async () => {
    if (!customerUsername.trim()) {
      setCashoutLimitRemaining(300);
      return;
    }

    setCustomerFinancialsLoading(true);
    setMessage({ text: '', type: '' }); // Clear any previous messages from username generation

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
  }, [customerUsername]);

  // Effect to fetch cashout limit when customerUsername changes
  useEffect(() => {
    fetchCustomerCashoutLimit();
  }, [fetchCustomerCashoutLimit]);


  // Effect for GLOBAL Last 10 Deposits (live)
  useEffect(() => {
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
      },
      (error) => {
        console.error('Error fetching real-time deposits for all users:', error);
        setMessage({ text: 'Failed to load live deposits for all users.', type: 'error' });
      }
    );
    setAllDepositsListener(() => unsubscribe); // Store the unsubscribe function

    // Cleanup function to unsubscribe from listener when component unmounts
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []); // Empty dependency array means this runs once on mount and cleans up on unmount


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
          <h2 style={styles.sectionTitle}>Generate Username</h2> {/* Changed title */}
          <form onSubmit={handleGenerateUsername} style={styles.form}> {/* Changed handler */}
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
                disabled={lockPageCode || isLoading}
              />
              <div style={styles.checkboxGroup}>
                <input
                  type="checkbox"
                  id="lockPageCode"
                  checked={lockPageCode}
                  onChange={(e) => setLockPageCode(e.target.checked)}
                />
                <label htmlFor="lockPageCode" style={styles.label}>Lock Code</label>
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

          {generatedUsername && ( // Display single username
            <div style={styles.resultContainer}>
              <h3 style={styles.resultTitle}>Generated Username:</h3>
              <p style={styles.usernameDisplay}>{generatedUsername}</p>
            </div>
          )}
        </div>

        {/* Customer Financials Section (for selected customer) */}
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>Customer Cashout Tracker</h2> {/* Changed title */}
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
          </div>

          {customerFinancialsLoading ? (
            <p style={{...styles.successMessage, color: '#0070f3'}}>Loading customer data...</p>
          ) : (
            customerUsername.trim() && (
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
            <p>No recent deposits found.</p>
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