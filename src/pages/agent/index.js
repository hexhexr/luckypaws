// src/pages/agent/index.js
import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import { db, auth } from '../../lib/firebaseClient';
import { onSnapshot, query, collection, where, orderBy, getDoc, doc, limit } from 'firebase/firestore';
import { useRouter } from 'next/router';
import { onAuthStateChanged } from 'firebase/auth';

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

    const [facebookName, setFacebookName] = useState('');
    const [generatedUsername, setGeneratedUsername] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [message, setMessage] = useState({ text: '', type: '' });
    
    const [last10AllDeposits, setLast10AllDeposits] = useState([]);
    const [depositsLoading, setDepositsLoading] = useState(true);

    const [customerUsername, setCustomerUsername] = useState('');
    const [limitCheckResult, setLimitCheckResult] = useState(null);
    const [isCheckingLimit, setIsCheckingLimit] = useState(false);

    useEffect(() => {
        const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
            if (!currentUser) { router.replace('/agent/login'); return; }
            const tokenResult = await currentUser.getIdTokenResult();
            if (!tokenResult.claims.agent) {
                await auth.signOut();
                router.replace('/agent/login?error=unauthorized');
                return;
            }
            setUser(currentUser);
            try {
                const userDocSnap = await getDoc(doc(db, 'users', currentUser.uid));
                if (userDocSnap.exists() && userDocSnap.data().agent) {
                    setAgentProfile(userDocSnap.data());
                } else { throw new Error("Agent profile not found."); }
            } catch (error) {
                await auth.signOut();
                router.replace('/agent/login?error=profile_fetch_failed');
            } finally { setLoading(false); }
        });
        return () => unsubscribeAuth();
    }, [router]);

    useEffect(() => {
        if (!user) return;
        setDepositsLoading(true);
        const depositsQuery = query(collection(db, 'orders'), where('status', '==', 'paid'), orderBy('created', 'desc'), limit(10));
        const unsubscribe = onSnapshot(depositsQuery, (snapshot) => {
            setLast10AllDeposits(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
            setDepositsLoading(false);
        }, (error) => {
            setMessage({ text: 'Error fetching live deposits.', type: 'error' });
            setDepositsLoading(false);
        });
        return () => unsubscribe();
    }, [user]);

    const handleGenerateUsername = async (e) => {
        e.preventDefault();
        if (!agentProfile?.pageCode) {
            setMessage({ text: 'Your Page Code is not configured. Please contact an admin.', type: 'error' });
            return;
        }
        setIsGenerating(true);
        setGeneratedUsername('');
        setMessage({ text: '', type: '' });

        try {
            const token = await user.getIdToken();
            const response = await fetch('/api/generate-username', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ facebookName, pageCode: agentProfile.pageCode }),
            });
            const data = await response.json();
            if (response.ok) {
                setGeneratedUsername(data.username);
                setMessage({ text: data.message, type: 'success' });
            } else { setMessage({ text: data.message, type: 'error' }); }
        } catch (error) { setMessage({ text: 'Client error generating username.', type: 'error' });
        } finally { setIsGenerating(false); }
    };

    const handleCheckLimit = async (e) => {
        e.preventDefault();
        if (!customerUsername.trim()) return;
        setIsCheckingLimit(true);
        setLimitCheckResult(null);
        setMessage({ text: '', type: '' });
        try {
            const token = await user.getIdToken();
            const res = await fetch(`/api/customer-cashout-limit?username=${customerUsername.trim()}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message);
            setLimitCheckResult(data);
        } catch(err) { setMessage({text: err.message, type: 'error'});
        } finally { setIsCheckingLimit(false); }
    };

    const handleLogout = useCallback(async () => {
        await auth.signOut();
        router.replace('/agent/login');
    }, [router]);

    if (loading) return <div className="loading-screen">Loading Agent Dashboard...</div>;
  
    return (
        <div className="admin-dashboard-container">
            <Head><title>Agent Dashboard</title></Head>
            <header className="admin-header">
                <h1>Agent: {agentProfile?.name}</h1>
                {agentProfile?.pageCode && <span className="stat-card" style={{padding: '8px', background: 'var(--primary-blue)', color: 'white', border: 'none'}}>Your Page Code: <strong>{agentProfile.pageCode}</strong></span>}
                <button onClick={handleLogout} className="btn btn-danger">Logout</button>
            </header>
            <main className="admin-main-content">
                {message.text && (<p className={`alert alert-${message.type} mb-lg`}>{message.text}</p>)}
                <div className="stats-grid">
                    <section className="card">
                        <h2 className="card-header">Username Generator</h2>
                        <div className="card-body">
                            <p className="text-center text-light">Your Page Code <strong>({agentProfile?.pageCode || 'N/A'})</strong> will be automatically used.</p>
                            <form onSubmit={handleGenerateUsername}>
                                <div className="form-group">
                                    <label htmlFor="facebookName">Customer's Facebook Name</label>
                                    <input type="text" id="facebookName" className="input" value={facebookName} onChange={e => setFacebookName(e.target.value)} required/>
                                </div>
                                <button type="submit" className="btn btn-primary" disabled={isGenerating || !agentProfile?.pageCode}>
                                    {isGenerating ? 'Generating...' : 'Generate Username'}
                                </button>
                            </form>
                            {generatedUsername && (<div className="alert alert-success mt-md">Generated: <strong>{generatedUsername}</strong></div>)}
                        </div>
                    </section>
                    <section className="card">
                        <h2 className="card-header">Check Customer Cashout Limit</h2>
                        <div className="card-body">
                            <form onSubmit={handleCheckLimit}>
                                <div className="form-group">
                                    <label htmlFor="customerUsername">Customer Username</label>
                                    <input type="text" id="customerUsername" className="input" value={customerUsername} onChange={e => setCustomerUsername(e.target.value)} required />
                                </div>
                                <button type="submit" className="btn btn-info" disabled={isCheckingLimit}>{isCheckingLimit ? 'Checking...' : 'Check Limit'}</button>
                            </form>
                            {limitCheckResult && (<div className="alert alert-info mt-md">
                                <p>User: <strong>{limitCheckResult.username}</strong></p>
                                <p>Remaining 24h Limit: <strong>${limitCheckResult.remainingLimit.toFixed(2)}</strong></p>
                            </div>)}
                        </div>
                    </section>
                </div>
                <section className="card table-card mt-xl">
                    <h2 className="card-header">Last 10 Customer Deposits (Live)</h2>
                    <div className="card-body">
                       {depositsLoading ? <LoadingSkeleton /> : (
                           <div className="table-responsive">
                               <table>
                                   <thead><tr><th>Time</th><th>Username</th><th>Amount (USD)</th></tr></thead>
                                   <tbody>
                                       {last10AllDeposits.length > 0 ? last10AllDeposits.map(deposit => (
                                           <tr key={deposit.id}>
                                               <td>{deposit.created?.toDate ? deposit.created.toDate().toLocaleString() : 'N/A'}</td>
                                               <td>{deposit.username}</td>
                                               <td>${parseFloat(deposit.amount).toFixed(2)}</td>
                                           </tr>
                                       )) : (<tr><td colSpan="3" className="text-center">No recent deposits.</td></tr>)}
                                   </tbody>
                               </table>
                           </div>
                       )}
                    </div>
                </section>
            </main>
        </div>
    );
}