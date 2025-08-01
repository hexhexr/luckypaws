import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Head from 'next/head';
import { db, auth } from '../../lib/firebaseClient';
import { onSnapshot, query, collection, where, orderBy, getDoc, doc, limit } from 'firebase/firestore';
import { useRouter } from 'next/router';
import { onAuthStateChanged } from 'firebase/auth';

// --- Reusable Helper Components ---
const LoadingSpinner = () => <div className="loading-spinner">Loading...</div>;
const SectionCard = ({ title, children }) => (
    <section className="card">
        <div className="card-header"><h3>{title}</h3></div>
        <div className="card-body">{children}</div>
    </section>
);

export default function AgentDashboard() {
    const router = useRouter();
    // --- State for All Features ---
    const [user, setUser] = useState(null);
    const [agentProfile, setAgentProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState({ text: '', type: '' });
    const [facebookName, setFacebookName] = useState('');
    const [manualPageCode, setManualPageCode] = useState('');
    const [generatedUsername, setGeneratedUsername] = useState('');
    const [limitCheckResult, setLimitCheckResult] = useState(null);
    const [timeRemaining, setTimeRemaining] = useState('');
    const countdownIntervalRef = useRef();
    const [recentDeposits, setRecentDeposits] = useState([]);
    const [agentRequests, setAgentRequests] = useState([]);

    // --- State for New Cashout Form ---
    const [cashoutForm, setCashoutForm] = useState({
        username: '',
        facebookName: '',
        cashoutAmount: '',
        cashoutAddress: ''
    });

    // --- Authentication & Profile Setup ---
    useEffect(() => {
        const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
            try {
                if (currentUser) {
                    const tokenResult = await currentUser.getIdTokenResult();
                    if (tokenResult.claims.agent) {
                        const docSnap = await getDoc(doc(db, 'users', currentUser.uid));
                        if (docSnap.exists()) {
                            const profile = docSnap.data();
                            setAgentProfile(profile);
                            setManualPageCode(profile.pageCode || '');
                            setUser(currentUser);
                        } else { throw new Error("Agent profile not found."); }
                    } else { await auth.signOut(); router.replace('/agent/login?error=unauthorized'); }
                } else { router.replace('/agent/login'); }
            } catch (error) {
                console.error("Auth failed:", error);
                await auth.signOut();
                router.replace('/agent/login?error=auth_failed');
            } finally {
                setLoading(false);
            }
        });
        return () => unsubscribeAuth();
    }, [router]);

    // --- Real-time Data Listeners for All Sections ---
    useEffect(() => {
        if (!user) return;
        const unsubscribes = [
            onSnapshot(query(collection(db, 'orders'), where('status', '==', 'paid'), orderBy('created', 'desc'), limit(10)), snap => {
                setRecentDeposits(snap.docs.map(d => ({id: d.id, ...d.data()})));
            }),
            onSnapshot(query(collection(db, 'agentCashoutRequests'), where('agentId', '==', user.uid), orderBy('requestedAt', 'desc')), snap => {
                setAgentRequests(snap.docs.map(d => ({id: d.id, ...d.data()})));
            }),
        ];
        return () => unsubscribes.forEach(unsub => unsub());
    }, [user]);

    const handleApiRequest = async (endpoint, body, successMessage) => {
        setMessage({ text: '', type: '' });
        try {
            const token = await user.getIdToken();
            const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(body), });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message);
            setMessage({ text: successMessage || data.message, type: 'success' });
            return data;
        } catch (err) {
            setMessage({ text: err.message, type: 'error' });
            return null;
        }
    };
    
    const handleGenerateUsername = async (e) => { e.preventDefault(); const data = await handleApiRequest('/api/generate-username', { facebookName, pageCode: manualPageCode }); if (data) setGeneratedUsername(data.username); };
    const handleAddCustomer = async (e) => { e.preventDefault(); const { username, facebookName, facebookProfileLink } = e.target.elements; await handleApiRequest('/api/agent/customers/create', { username: username.value, facebookName: facebookName.value, facebookProfileLink: facebookProfileLink.value }, 'Customer added!'); e.target.reset(); };
    const handleCheckLimit = async (e) => { e.preventDefault(); const { customerUsername } = e.target.elements; const token = await user.getIdToken(); const res = await fetch(`/api/customer-cashout-limit?username=${customerUsername.value.trim()}`, { headers: { 'Authorization': `Bearer ${token}` } }); const data = await res.json(); if (!res.ok) { setMessage({ text: data.message, type: 'error' }); } else { setLimitCheckResult(data); } };
    
    const handleCashoutRequestSubmit = async (e) => {
        e.preventDefault();
        await handleApiRequest('/api/agent/submit-cashout-request', cashoutForm, 'Cashout request submitted!');
        setCashoutForm({
            username: '',
            facebookName: '',
            cashoutAmount: '',
            cashoutAddress: ''
        });
    };

    useEffect(() => {
        clearInterval(countdownIntervalRef.current);
        if (limitCheckResult?.windowResetsAt) {
            countdownIntervalRef.current = setInterval(() => {
                const diff = new Date(limitCheckResult.windowResetsAt) - new Date();
                if (diff <= 0) {
                    setTimeRemaining('Limit Reset!');
                    setLimitCheckResult(prev => ({...prev, remainingLimit: 300}));
                    clearInterval(countdownIntervalRef.current);
                } else {
                    const h = Math.floor(diff / 36e5).toString().padStart(2, '0');
                    const m = Math.floor((diff % 36e5) / 6e4).toString().padStart(2, '0');
                    const s = Math.floor((diff % 6e4) / 1000).toString().padStart(2, '0');
                    setTimeRemaining(`${h}:${m}:${s}`);
                }
            }, 1000);
        }
        return () => clearInterval(countdownIntervalRef.current);
    }, [limitCheckResult]);

    if (loading) return <div className="loading-screen"><LoadingSpinner /></div>;

    return (
        <>
            <Head><title>Agent Dashboard | Lucky Paws</title></Head>
            <div className="agent-dashboard-full admin-dashboard-container"> 
                <header className="panel-header admin-header">
                    <div>
                        <h1 className="agent-name">{agentProfile?.name}</h1>
                        <p className="page-code-display">Default Page Code: {agentProfile?.pageCode}</p>
                    </div>
                    <button onClick={() => auth.signOut()} className="btn btn-danger">Logout</button>
                </header>
                
                {message.text && <div className={`alert alert-${message.type}`}>{message.text}</div>}
                
                <main className="panel-content admin-main-content">
                    <div className="stats-grid">
                        <SectionCard title="Username Generator"><form onSubmit={handleGenerateUsername} className="form-stack"><div><label htmlFor="facebookName">Customer's FB Name</label><input id="facebookName" value={facebookName} onChange={e => setFacebookName(e.target.value)} required className="input" /></div><div><label htmlFor="manualPageCode">Page Code</label><input id="manualPageCode" value={manualPageCode} onChange={e => setManualPageCode(e.target.value)} required pattern="\d{4}" className="input" /></div><button type="submit" className="btn btn-primary">Generate</button>{generatedUsername && <p className="alert alert-success">Generated: <strong>{generatedUsername}</strong></p>}</form></SectionCard>
                        <SectionCard title="Add New Customer"><form onSubmit={handleAddCustomer} className="form-stack"><input name="username" required className="input" placeholder="Game Username"/><input name="facebookName" required className="input" placeholder="Facebook Name"/><input name="facebookProfileLink" type="url" required className="input" placeholder="Facebook Profile URL"/><button type="submit" className="btn btn-success">Add Customer</button></form></SectionCard>
                        <SectionCard title="Check Cashout Limit"><form onSubmit={handleCheckLimit}><div className="form-grid" style={{gridTemplateColumns: '2fr 1fr'}}><input name="customerUsername" required className="input" placeholder="Customer Username"/><button type="submit" className="btn btn-info">Check</button></div>{limitCheckResult && (<div className="alert alert-info mt-md"><p>Limit for <strong>{limitCheckResult.username}</strong>: ${limitCheckResult.remainingLimit.toFixed(2)}</p><p><small>First cashout: {limitCheckResult.firstCashoutTimeInWindow ? new Date(limitCheckResult.firstCashoutTimeInWindow).toLocaleTimeString() : 'N/A'}</small></p>{limitCheckResult.windowResetsAt && <p><small>Resets in: <strong>{timeRemaining}</strong></small></p>}</div>)}</form></SectionCard>
                    </div>
                    <div className="stats-grid mt-lg">
                        <SectionCard title="Recent Deposits">
                            <div className="table-responsive">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Date/Time</th>
                                            <th>Username</th>
                                            <th>Facebook Name</th>
                                            <th>Game</th>
                                            <th>Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {recentDeposits.map(dep => (
                                            <tr key={dep.id}>
                                                <td>{dep.created?.toDate ? dep.created.toDate().toLocaleString() : 'N/A'}</td>
                                                <td>{dep.username}</td>
                                                <td>{dep.facebookName || 'N/A'}</td>
                                                <td>{dep.game}</td>
                                                <td>${parseFloat(dep.amount || 0).toFixed(2)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </SectionCard>
                        <SectionCard title="My Cashout Requests">
                            <form onSubmit={handleCashoutRequestSubmit} className="form-stack">
                                <input name="username" value={cashoutForm.username} onChange={e => setCashoutForm({...cashoutForm, username: e.target.value})} required className="input" placeholder="Game Username"/>
                                <input name="facebookName" value={cashoutForm.facebookName} onChange={e => setCashoutForm({...cashoutForm, facebookName: e.target.value})} required className="input" placeholder="Facebook Name"/>
                                <input name="cashoutAmount" value={cashoutForm.cashoutAmount} onChange={e => setCashoutForm({...cashoutForm, cashoutAmount: e.target.value})} required className="input" placeholder="Cashout Amount (USD)" type="number" step="0.01" />
                                <input name="cashoutAddress" value={cashoutForm.cashoutAddress} onChange={e => setCashoutForm({...cashoutForm, cashoutAddress: e.target.value})} required className="input" placeholder="Cashout Address (LN)"/>
                                <button type="submit" className="btn btn-success">Submit Request</button>
                            </form>
                            <div className="list-container" style={{marginTop: '1rem'}}>
                                {agentRequests.map(r => (
                                    <div key={r.id} className="list-item">
                                        <p>${parseFloat(r.amount || 0).toFixed(2)} for {r.username} requested on {r.requestedAt?.toDate ? r.requestedAt.toDate().toLocaleDateString() : 'N/A'}</p>
                                        <p>Status: <span className={`status-badge status-${r.status}`}>{r.status}</span></p>
                                    </div>
                                ))}
                            </div>
                        </SectionCard>
                    </div>
                </main>
            </div>
            <style jsx>{`
                .agent-name { 
                    font-size: 1.25rem; 
                    font-weight: bold; 
                    color: white;
                }
                .page-code-display { 
                    font-size: 0.875rem; 
                    color: #93c5fd;
                    margin: 0;
                }
                .form-stack { 
                    display: flex; 
                    flex-direction: column; 
                    gap: 0.75rem; 
                }
                .list-container { 
                    max-height: 15rem;
                    overflow-y: auto; 
                    font-size: 0.875rem; 
                }
                .list-item { 
                    padding: 0.75rem; 
                    border-bottom: 1px solid var(--border-subtle); 
                }
                .list-item:last-child { 
                    border-bottom: none; 
                }
                .list-item p { 
                    margin: 0; 
                    line-height: 1.4; 
                }
            `}</style>
        </>
    );
}