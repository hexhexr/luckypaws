import { useState, useEffect, useCallback, useMemo } from 'react';
import Head from 'next/head';
import { db } from '../../lib/firebaseClient';

export default function AgentPage() {
  const [pageCode, setPageCode] = useState('');
  const [lockPageCode, setLockCodePage] = useState(false);
  const [isSavingPageCode, setIsSavingPageCode] = useState(false);
  const [facebookName, setFacebookName] = useState('');
  const [generatedUsername, setGeneratedUsername] = useState('');
  const [message, setMessage] = useState({ text: '', type: '' });
  const [isLoading, setIsLoading] = useState(false);

  const [customerUsername, setCustomerUsername] = useState('');
  const [cashoutLimitRemaining, setCashoutLimitRemaining] = useState(300);
  const [customerFinancialsLoading, setCustomerFinancialsLoading] = useState(false);

  const [last10AllDeposits, setLast10AllDeposits] = useState([]);
  const [allDepositsListener, setAllDepositsListener] = useState(null);

  const agentSettingsRef = useMemo(() => db?.collection('agentSettings').doc('pageCodeConfig'), [db]);

  const savePageCodeSettingsToFirebase = useCallback(async (codeToSave, lockState) => {
    if (!agentSettingsRef) return;
    setIsSavingPageCode(true);
    try {
      await agentSettingsRef.set({
        pageCode: lockState ? codeToSave : '',
        locked: lockState,
        updatedAt: new Date().toISOString(),
      });
      setMessage({
        text: lockState ? 'Page code locked and saved!' : 'Page code unlocked and cleared.',
        type: 'success',
      });
    } catch (error) {
      console.error('Error saving page code:', error);
      setMessage({ text: `Failed to save settings: ${error.message}`, type: 'error' });
    } finally {
      setIsSavingPageCode(false);
    }
  }, [agentSettingsRef]);

  useEffect(() => {
    if (!agentSettingsRef) return;
    const unsubscribe = agentSettingsRef.onSnapshot((doc) => {
      const data = doc.data();
      if (doc.exists && data.locked && data.pageCode) {
        setPageCode(data.pageCode);
        setLockCodePage(true);
        if (!isSavingPageCode) setMessage({ text: 'Page code loaded and locked.', type: 'success' });
      } else {
        setLockCodePage(false);
        setPageCode('');
      }
    }, (err) => {
      console.error(err);
      setMessage({ text: `Failed to load settings: ${err.message}`, type: 'error' });
    });
    return () => unsubscribe();
  }, [agentSettingsRef, isSavingPageCode]);

  const handleLockPageCodeChange = async (e) => {
    const newLock = e.target.checked;
    setLockCodePage(newLock);
    await savePageCodeSettingsToFirebase(pageCode, newLock);
  };

  const handlePageCodeBlur = async () => {
    if (lockPageCode && /^\d{4}$/.test(pageCode)) {
      await savePageCodeSettingsToFirebase(pageCode, true);
    }
  };

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
    if (!/^\d{4}$/.test(pageCode)) {
      setMessage({ text: 'Page Code must be a 4-digit number.', type: 'error' });
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/generate-username', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ facebookName, pageCode }),
      });
      const data = await res.json();
      if (res.ok) {
        setGeneratedUsername(data.username);
        setMessage({ text: data.message, type: 'success' });
      } else {
        setMessage({ text: data.message || 'Failed to generate.', type: 'error' });
      }
    } catch (err) {
      console.error(err);
      setMessage({ text: 'Network error. Try again.', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCustomerCashoutLimit = useCallback(async () => {
    if (!customerUsername.trim()) {
      setMessage({ text: 'Enter username to check.', type: 'error' });
      return;
    }
    setCustomerFinancialsLoading(true);
    setMessage({ text: '', type: '' });
    try {
      const res = await fetch(`/api/customer-cashout-limit?username=${encodeURIComponent(customerUsername)}`);
      const data = await res.json();
      if (res.ok) {
        setCashoutLimitRemaining(data.remainingLimit);
      } else {
        setCashoutLimitRemaining(300);
        setMessage({ text: `Error: ${data.message}`, type: 'error' });
      }
    } catch (err) {
      console.error(err);
      setCashoutLimitRemaining(300);
      setMessage({ text: 'Error checking limit.', type: 'error' });
    } finally {
      setCustomerFinancialsLoading(false);
    }
  }, [customerUsername]);

  useEffect(() => {
    if (!db) return;
    if (allDepositsListener) allDepositsListener();

    const unsub = db
      .collection('orders')
      .where('status', '==', 'paid')
      .orderBy('createdAt', 'desc')
      .limit(10)
      .onSnapshot(
        (snap) => {
          setLast10AllDeposits(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        },
        (err) => {
          console.error(err);
          setMessage({ text: 'Error loading live deposits.', type: 'error' });
        }
      );

    setAllDepositsListener(() => unsub);
    return () => unsub();
  }, [db, allDepositsListener]);

  return (
    <div style={{ padding: 20, fontFamily: 'Arial' }}>
      <Head>
        <title>Agent Tools</title>
      </Head>
      <h1>Agent Dashboard</h1>

      <section>
        <h2>Generate Username</h2>
        <form onSubmit={handleGenerateUsername}>
          <label>Page Code (4-digit):</label><br />
          <input value={pageCode} onChange={(e) => setPageCode(e.target.value)} onBlur={handlePageCodeBlur} disabled={isSavingPageCode} /><br />
          <label>
            <input type="checkbox" checked={lockPageCode} onChange={handleLockPageCodeChange} disabled={isSavingPageCode} />
            Lock Code
          </label><br /><br />
          <label>Facebook Name:</label><br />
          <input value={facebookName} onChange={(e) => setFacebookName(e.target.value)} /><br /><br />
          <button type="submit" disabled={isLoading}>
            {isLoading ? 'Generating...' : 'Generate'}
          </button>
        </form>
        {generatedUsername && <p><strong>Username:</strong> {generatedUsername}</p>}
        {message.text && <p style={{ color: message.type === 'error' ? 'red' : 'green' }}>{message.text}</p>}
      </section>

      <hr />

      <section>
        <h2>Cashout Tracker</h2>
        <input value={customerUsername} onChange={(e) => setCustomerUsername(e.target.value)} placeholder="Username" />
        <button onClick={fetchCustomerCashoutLimit} disabled={customerFinancialsLoading}>
          {customerFinancialsLoading ? 'Checking...' : 'Check Limit'}
        </button>
        <p>Remaining Limit: <strong>${cashoutLimitRemaining.toFixed(2)}</strong> / $300.00</p>
      </section>

      <hr />

      <section>
        <h2>Recent Deposits</h2>
        {last10AllDeposits.length === 0 ? (
          <p>No recent deposits.</p>
        ) : (
          <table border="1" cellPadding="5">
            <thead>
              <tr>
                <th>Username</th>
                <th>Amount</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {last10AllDeposits.map((d) => (
                <tr key={d.id}>
                  <td>{d.username}</td>
                  <td>${parseFloat(d.amount).toFixed(2)}</td>
                  <td>{new Date(d.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
