// pages/agent/index.js
import { useState, useEffect, useCallback, useMemo } from 'react';
import Head from 'next/head';
import { db, auth } from '../../lib/firebaseClient'; // Import auth from firebaseClient
import { doc, onSnapshot, query, collection, where, orderBy, updateDoc, getDoc } from 'firebase/firestore'; // Import Firestore functions
import { useRouter } from 'next/router';

export default function AgentPage() {
  const router = useRouter();
  const [user, setUser] = useState(null); // Current authenticated user
  const [agentProfile, setAgentProfile] = useState(null); // Agent's profile from 'users' collection

  const [pageCode, setPageCode] = useState('');
  const [lockPageCode, setLockCodePage] = useState(false);
  const [isSavingPageCode, setIsSavingPageCode] = useState(false);
  const [facebookName, setFacebookName] = useState('');
  const [generatedUsername, setGeneratedUsername] = useState('');
  const [message, setMessage] = useState({ text: '', type: '' });
  const [isLoading, setIsLoading] = useState(false);

  const [customerUsername, setCustomerUsername] = useState('');
  const [cashoutLimitRemaining, setCashoutLimitRemaining] = useState(null); // Set to null initially
  const [customerFinancialsLoading, setCustomerFinancialsLoading] = useState(false);
  const [cashoutMessage, setCashoutMessage] = useState({ text: '', type: '' });

  const [last10AllDeposits, setLast10AllDeposits] = useState([]);
  // allDepositsListener state is not strictly needed if cleanup is handled by useEffect return

  // --- Firebase Document Reference for Agent Settings (assuming a single agent config for now) ---
  const agentSettingsRef = useMemo(() => {
    // This assumes a document 'pageCodeConfig' in the 'agentSettings' collection.
    // Make sure your Firestore rules allow access to this path.
    return doc(db, 'agentSettings', 'pageCodeConfig');
  }, []);

  // --- Authentication Protection & Agent Profile Fetch ---
  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged(async (currentUser) => {
      if (!currentUser) {
        // No user is logged in, redirect to agent login
        console.log('No user logged in, redirecting to /agent/login');
        router.replace('/agent/login');
        return;
      }

      setUser(currentUser); // Set the current Firebase Auth user

      // Fetch user role from Firestore
      try {
        const userDocRef = doc(db, 'users', currentUser.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists() && userDocSnap.data().role === 'agent') {
          setAgentProfile(userDocSnap.data());
          console.log('Agent user authenticated:', currentUser.email);
          // Only record login time if this is a fresh login, or if session persisted (handled by login page)
          // The login page already sends a record-login request on successful authentication.
          // This ensures the page is only accessed by authenticated agents.
        } else {
          // User is authenticated but not an agent
          console.warn('Authenticated user is not an agent. Signing out.');
          await auth.signOut();
          router.replace('/agent/login?error=unauthorized');
        }
      } catch (error) {
        console.error('Error fetching agent profile:', error);
        await auth.signOut(); // Sign out on error
        router.replace('/agent/login?error=profile_fetch_failed');
      }
    });

    return () => unsubscribeAuth(); // Clean up auth listener
  }, [router]);

  // --- Page Code Locking Logic ---
  useEffect(() => {
    if (!user) return; // Only run if user is authenticated

    const unsubscribe = onSnapshot(agentSettingsRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setPageCode(data.pageCode || '');
        setLockCodePage(data.locked || false);
        setMessage({ text: 'Page code settings loaded.', type: 'success' });
      } else {
        setMessage({ text: 'No page code settings found. Create one.', type: 'error' });
        setPageCode('');
        setLockCodePage(false);
      }
    }, (error) => {
      console.error('Error listening to page code settings:', error);
      setMessage({ text: 'Error fetching page code settings: ' + error.message, type: 'error' });
    });

    return () => unsubscribe(); // Clean up listener on component unmount
  }, [user, agentSettingsRef]); // Depend on user to ensure it runs after authentication

  const savePageCodeSettingsToFirebase = useCallback(async () => {
    setIsSavingPageCode(true);
    setMessage({ text: '', type: '' });
    try {
      // Only an admin should be able to update pageCodeConfig
      // The frontend button should ideally be hidden from agents, or API should check roles.
      // For now, it's accessible, but Firestore rules will prevent agent writes.
      await updateDoc(agentSettingsRef, {
        pageCode: pageCode,
        locked: lockPageCode,
        lastUpdated: new Date().toISOString(),
      });
      setMessage({ text: 'Page code settings saved successfully!', type: 'success' });
    } catch (error) {
      console.error('Error saving page code settings:', error);
      setMessage({ text: 'Failed to save page code settings. ' + error.message, type: 'error' });
    } finally {
      setIsSavingPageCode(false);
    }
  }, [pageCode, lockPageCode, agentSettingsRef]);

  // --- Username Generation Logic ---
  const handleGenerateUsername = async (e) => {
    e.preventDefault();
    setGeneratedUsername('');
    setMessage({ text: '', type: '' });
    setIsLoading(true);

    if (!facebookName.trim() || !pageCode.trim()) {
      setMessage({ text: 'Please enter Facebook Name and Page Code.', type: 'error' });
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/generate-username', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ facebookName, pageCode }),
      });

      const data = await response.json();

      if (response.ok) {
        setGeneratedUsername(data.username);
        setMessage({ text: data.message, type: 'success' });
      } else {
        setMessage({ text: data.message || 'Failed to generate username.', type: 'error' });
      }
    } catch (error) {
      console.error('Error generating username:', error);
      setMessage({ text: 'An unexpected error occurred while generating username.', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  // --- Customer Cashout Limit Logic ---
  const fetchCustomerCashoutLimit = async (e) => {
    e.preventDefault();
    setCashoutLimitRemaining(null);
    setCashoutMessage({ text: '', type: '' });
    setCustomerFinancialsLoading(true);

    if (!customerUsername.trim()) {
      setCashoutMessage({ text: 'Please enter a customer username.', type: 'error' });
      setCustomerFinancialsLoading(false);
      return;
    }

    try {
      const response = await fetch(`/api/customer-cashout-limit?username=${encodeURIComponent(customerUsername.trim())}`);
      const data = await response.json();

      if (response.ok) {
        setCashoutLimitRemaining(data.remainingLimit);
        setCashoutMessage({
          text: `Limit for ${data.username}: $${data.remainingLimit.toFixed(2)} (Total cashed out: $${data.totalCashoutsToday.toFixed(2)})`,
          type: 'success'
        });
      } else {
        setCashoutMessage({ text: data.message || 'Failed to fetch cashout limit.', type: 'error' });
      }
    } catch (error) {
      console.error('Error fetching cashout limit:', error);
      setCashoutMessage({ text: 'An unexpected error occurred while fetching cashout limit.', type: 'error' });
    } finally {
      setCustomerFinancialsLoading(false);
    }
  };

  // --- Live Deposit Checker (Last 10 Deposits) ---
  useEffect(() => {
    if (!user) return; // Only run if user is authenticated

    // Query for last 10 paid deposits, ordered by creation time
    const depositsQuery = query(
      collection(db, 'orders'),
      where('status', '==', 'paid'),
      orderBy('createdAt', 'desc'), // Ensure 'createdAt' field exists and is indexed
      // limit(10) // Limit is optional for real-time listener if you want all, but useful for initial fetch
    );

    const unsubscribe = onSnapshot(depositsQuery, (snapshot) => {
      const deposits = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        deposits.push({
          id: doc.id,
          username: data.username,
          amount: parseFloat(data.amount || 0),
          createdAt: data.createdAt ? (data.createdAt.toDate ? data.createdAt.toDate().toISOString() : data.createdAt) : null, // Handle Firebase Timestamp or ISO string
        });
      });
      setLast10AllDeposits(deposits.slice(0, 10)); // Take only the last 10 from the fetched results
      setMessage({ text: 'Live deposits updated.', type: 'success' });
    }, (error) => {
      console.error('Error fetching live deposits:', error);
      setMessage({ text: 'Error fetching live deposits: ' + error.message, type: 'error' });
    });

    return () => unsubscribe(); // Clean up listener on component unmount
  }, [user]); // Depend on user to ensure it runs after authentication

  // --- Logout Functionality ---
  const handleLogout = async () => {
    if (user) {
      try {
        // Record logout time
        await fetch('/api/agent/record-logout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ agentId: user.uid }),
        });
        await auth.signOut(); // Sign out from Firebase
        console.log('User signed out.');
        router.replace('/agent/login'); // Redirect to login page
      } catch (error) {
        console.error('Error during logout:', error);
        setMessage({ text: 'Failed to log out: ' + error.message, type: 'error' });
      }
    }
  };


  // --- Styling (kept similar to original) ---
  const styles = {
    container: {
      minHeight: '100vh',
      padding: '0 0.5rem',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-start',
      alignItems: 'center',
      backgroundColor: '#f0f2f5',
      fontFamily: 'Inter, sans-serif',
      paddingTop: '2rem',
      paddingBottom: '2rem',
    },
    header: {
      width: '100%',
      maxWidth: '900px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '2rem',
      padding: '0 1rem',
    },
    main: {
      padding: '2rem',
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
      backgroundColor: '#ffffff',
      textAlign: 'center',
      maxWidth: '900px',
      width: '100%',
    },
    title: {
      fontSize: '2.5rem',
      marginBottom: '1.5rem',
      color: '#333',
    },
    section: {
      marginBottom: '2rem',
      border: '1px solid #eee',
      padding: '1.5rem',
      borderRadius: '8px',
      backgroundColor: '#fafafa',
    },
    sectionTitle: {
      fontSize: '1.8rem',
      marginBottom: '1rem',
      color: '#0070f3',
    },
    form: {
      display: 'flex',
      flexDirection: 'column',
      gap: '1rem',
      marginBottom: '1rem',
      alignItems: 'flex-start',
    },
    inputGroup: {
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-start',
      marginBottom: '0.5rem',
    },
    label: {
      marginBottom: '0.5rem',
      fontSize: '0.9rem',
      color: '#444',
    },
    input: {
      width: '100%',
      padding: '0.8rem',
      fontSize: '1rem',
      border: '1px solid #ddd',
      borderRadius: '4px',
    },
    button: {
      padding: '0.8rem 1.5rem',
      fontSize: '1rem',
      backgroundColor: '#0070f3',
      color: 'white',
      border: 'none',
      borderRadius: '4px',
      cursor: 'pointer',
      transition: 'background-color 0.2s ease-in-out',
      width: 'fit-content', // Adjusted to fit content
      alignSelf: 'flex-end', // Aligns button to the right within flex column
    },
    buttonSecondary: {
      backgroundColor: '#6c757d',
    },
    buttonDanger: {
      backgroundColor: '#dc3545',
    },
    buttonDisabled: {
      backgroundColor: '#cccccc',
      cursor: 'not-allowed',
    },
    successMessage: {
      color: '#28a745',
      fontSize: '0.95rem',
      marginTop: '1rem',
    },
    errorMessage: {
      color: '#dc3545',
      fontSize: '0.95rem',
      marginTop: '1rem',
    },
    infoMessage: {
      color: '#17a2b8',
      fontSize: '0.95rem',
      marginTop: '1rem',
    },
    depositsTable: {
      width: '100%',
      borderCollapse: 'collapse',
      marginTop: '1rem',
    },
    tableHeader: {
      borderBottom: '2px solid #ddd',
      padding: '10px',
      textAlign: 'left',
      backgroundColor: '#e9ecef',
    },
    tableCell: {
      borderBottom: '1px solid #eee',
      padding: '10px',
      textAlign: 'left',
    },
  };

  if (!user || !agentProfile) {
    // Optionally render a loading spinner or empty div until auth check is complete
    return (
      <div style={styles.container}>
        <Head><title>Loading Agent Page...</title></Head>
        <p>Loading agent dashboard...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <Head>
        <title>Agent Dashboard</title>
        <meta name="description" content="Agent dashboard for managing customers and orders" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div style={styles.header}>
        <h1 style={{ ...styles.title, marginBottom: 0 }}>Agent Dashboard</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {agentProfile && (
            <span style={{ fontSize: '1rem', color: '#555' }}>
              Welcome, {agentProfile.name || agentProfile.email}!
            </span>
          )}
          <button
            onClick={handleLogout}
            style={{ ...styles.button, ...styles.buttonDanger }}
          >
            Logout
          </button>
        </div>
      </div>

      <main style={styles.main}>
        {message.text && (
          <p style={message.type === 'success' ? styles.successMessage : styles.errorMessage}>
            {message.text}
          </p>
        )}

        {/* Page Code Locking Section */}
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>Page Code Management</h2>
          <form style={styles.form}>
            <div style={styles.inputGroup}>
              <label htmlFor="pageCode" style={styles.label}>Current Page Code:</label>
              <input
                type="text"
                id="pageCode"
                value={pageCode}
                onChange={(e) => setPageCode(e.target.value)}
                placeholder="Enter page code"
                style={styles.input}
                disabled={lockPageCode || isSavingPageCode}
              />
            </div>
            {lockPageCode && (
              <p style={styles.infoMessage}>
                This page code is locked by admin. You cannot change it.
              </p>
            )}
            {!lockPageCode && (
              <button
                type="button"
                onClick={savePageCodeSettingsToFirebase}
                style={isSavingPageCode ? { ...styles.button, ...styles.buttonDisabled } : styles.button}
                disabled={isSavingPageCode}
              >
                {isSavingPageCode ? 'Saving...' : 'Save Page Code'}
              </button>
            )}
            <p style={{ fontSize: '0.85rem', color: '#777', marginTop: '0.5rem' }}>
              *Page code can be locked by an admin from Firebase.
            </p>
          </form>
        </div>

        {/* Username Generation Section */}
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>Generate Customer Username</h2>
          <form onSubmit={handleGenerateUsername} style={styles.form}>
            <div style={styles.inputGroup}>
              <label htmlFor="facebookName" style={styles.label}>Customer Facebook Name:</label>
              <input
                type="text"
                id="facebookName"
                value={facebookName}
                onChange={(e) => setFacebookName(e.target.value)}
                placeholder="e.g., John Doe"
                required
                style={styles.input}
                disabled={isLoading}
              />
            </div>
            <p style={{ fontSize: '0.9rem', color: '#555', alignSelf: 'flex-start' }}>
              Page Code will be automatically used from the "Page Code Management" section above.
            </p>
            <button
              type="submit"
              style={isLoading ? { ...styles.button, ...styles.buttonDisabled } : styles.button}
              disabled={isLoading}
            >
              {isLoading ? 'Generating...' : 'Generate Username'}
            </button>
          </form>
          {generatedUsername && (
            <p style={styles.successMessage}>
              Generated Username: <strong>{generatedUsername}</strong>
            </p>
          )}
        </div>

        {/* Customer Cashout Limit Section */}
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>Check Customer Cashout Limit</h2>
          <form onSubmit={fetchCustomerCashoutLimit} style={styles.form}>
            <div style={styles.inputGroup}>
              <label htmlFor="customerUsername" style={styles.label}>Customer Username:</label>
              <input
                type="text"
                id="customerUsername"
                value={customerUsername}
                onChange={(e) => setCustomerUsername(e.target.value)}
                placeholder="Enter customer username"
                required
                style={styles.input}
                disabled={customerFinancialsLoading}
              />
            </div>
            <button
              type="submit"
              style={customerFinancialsLoading ? { ...styles.button, ...styles.buttonDisabled } : styles.button}
              disabled={customerFinancialsLoading}
            >
              {customerFinancialsLoading ? 'Checking...' : 'Check Cashout Limit'}
            </button>
          </form>
          {cashoutLimitRemaining !== null && (
            <p style={styles.infoMessage}>
              Remaining Limit: <strong>${cashoutLimitRemaining.toFixed(2)}</strong>
            </p>
          )}
          {cashoutMessage.text && (
            <p style={cashoutMessage.type === 'success' ? styles.successMessage : styles.errorMessage}>
              {cashoutMessage.text}
            </p>
          )}
        </div>

        {/* Live Deposit Checker Section */}
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>Live Deposit Checker (Last 10 Deposits)</h2>
          {last10AllDeposits.length === 0 ? (
            <p>No recent paid deposits found. {message.type === 'error' && message.text.includes('live deposits') ? `(${message.text})` : ''}</p>
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
                      <td style={styles.tableCell}>{deposit.createdAt ? new Date(deposit.createdAt).toLocaleString() : 'N/A'}</td>
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
