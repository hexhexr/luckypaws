// src/pages/agent/index.js
import { useState, useEffect, useCallback, useMemo } from 'react';
import Head from 'next/head';
import { db, auth } from '../../lib/firebaseClient';
import { onSnapshot, query, collection, where, orderBy, updateDoc, getDoc, doc } from 'firebase/firestore';
import { useRouter } from 'next/router';
import { onAuthStateChanged } from 'firebase/auth';
import DataTable from '../../components/DataTable';

const LoadingSkeleton = () => (
    <div className="loading-skeleton mt-md">
        {[...Array(3)].map((_, i) => <div key={i} className="skeleton-line" style={{ width: `${95 - i*10}%`}}></div>)}
    </div>
);

export default function AgentPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [agentProfile, setAgentProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const [pageCode, setPageCode] = useState('');
  const [lockPageCode, setLockPageCode] = useState(false);
  const [facebookName, setFacebookName] = useState('');
  const [generatedUsername, setGeneratedUsername] = useState('');
  const [message, setMessage] = useState({ text: '', type: '' });
  
  const [last10AllDeposits, setLast10AllDeposits] = useState([]);
  const [depositsLoading, setDepositsLoading] = useState(true);

  // Authentication & Profile Fetch
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.replace('/agent/login');
        return;
      }
      setUser(currentUser);
      try {
        const userDocSnap = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDocSnap.exists() && userDocSnap.data().agent) {
          setAgentProfile(userDocSnap.data());
        } else {
          await auth.signOut();
          router.replace('/agent/login?error=unauthorized');
        }
      } catch (error) {
        await auth.signOut();
        router.replace('/agent/login?error=profile_fetch_failed');
      } finally {
          setLoading(false);
      }
    });
    return () => unsubscribeAuth();
  }, [router]);
  
  // Fetch Page Code Settings
  useEffect(() => {
    if (!user) return;
    const agentSettingsRef = doc(db, 'agentSettings', 'pageCodeConfig');
    const unsubscribe = onSnapshot(agentSettingsRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setPageCode(data.pageCode || '');
        setLockPageCode(data.locked || false);
      }
    }, (error) => {
      setMessage({ text: 'Error fetching page code settings.', type: 'error' });
    });
    return () => unsubscribe();
  }, [user]);

  // Live Deposit Checker
  useEffect(() => {
    if (!user) return;
    setDepositsLoading(true);
    const depositsQuery = query(collection(db, 'orders'), where('status', '==', 'paid'), orderBy('created', 'desc'), limit(10));
    const unsubscribe = onSnapshot(depositsQuery, (snapshot) => {
      const deposits = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setLast10AllDeposits(deposits);
      setDepositsLoading(false);
    }, (error) => {
      setMessage({ text: 'Error fetching live deposits.', type: 'error' });
      setDepositsLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  const handleGenerateUsername = async (e) => {
    e.preventDefault();
    setGeneratedUsername('');
    setMessage({ text: '', type: '' });

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
        setMessage({ text: data.message, type: 'error' });
      }
    } catch (error) {
      setMessage({ text: 'Error generating username.', type: 'error' });
    }
  };

  const handleLogout = async () => {
    await auth.signOut();
    router.replace('/agent/login');
  };

  const depositColumns = useMemo(() => [
    { header: 'Time', accessor: 'created', cell: (row) => row.created?.toDate().toLocaleString() },
    { header: 'Username', accessor: 'username' },
    { header: 'Amount (USD)', accessor: 'amount', cell: (row) => `$${parseFloat(row.amount).toFixed(2)}` }
  ], []);

  if (loading) {
    return <div className="loading-screen">Loading Agent Dashboard...</div>;
  }
  
  return (
    <div className="admin-dashboard-container">
      <Head>
        <title>Agent Dashboard</title>
      </Head>
      <header className="admin-header">
        <h1>Agent Dashboard ({agentProfile?.name})</h1>
        <button onClick={handleLogout} className="btn btn-danger">Logout</button>
      </header>

      <main className="admin-main-content">
        {message.text && (
          <p className={`alert alert-${message.type} mb-lg`}>{message.text}</p>
        )}

        <div className="grid md:grid-cols-2 gap-lg">
            <section className="card">
                <h2 className="card-header">Username Generator</h2>
                <div className="card-body">
                    <form onSubmit={handleGenerateUsername} className="space-y-md">
                        <div className="form-group">
                            <label>Page Code</label>
                            <input type="text" className="input" value={pageCode} readOnly disabled />
                        </div>
                         <div className="form-group">
                            <label htmlFor="facebookName">Customer Facebook Name</label>
                            <input
                              type="text"
                              id="facebookName"
                              className="input"
                              value={facebookName}
                              onChange={(e) => setFacebookName(e.target.value)}
                              required
                            />
                        </div>
                        <button type="submit" className="btn btn-primary">Generate Username</button>
                    </form>
                    {generatedUsername && (
                        <div className="alert alert-success mt-md">
                            Generated Username: <strong>{generatedUsername}</strong>
                        </div>
                    )}
                </div>
            </section>
            
            <section className="card">
                <h2 className="card-header">Live Deposit Checker</h2>
                <div className="card-body">
                   {depositsLoading ? <LoadingSkeleton /> : <DataTable columns={depositColumns} data={last10AllDeposits} defaultSortField="created" />}
                </div>
            </section>
        </div>
      </main>
    </div>
  );
}