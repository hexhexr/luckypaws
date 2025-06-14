import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Head from 'next/head';
import { db, auth } from '../../lib/firebaseClient';
import { onSnapshot, query, collection, where, orderBy, getDoc, doc, limit } from 'firebase/firestore';
import { useRouter } from 'next/router';
import { onAuthStateChanged } from 'firebase/auth';

// --- Reusable Helper Components ---
const LoadingSpinner = () => <div className="loading-spinner">Loading...</div>;
const SectionCard = ({ title, children }) => (
    <section className="section-card">
        <div className="section-header"><h3>{title}</h3></div>
        <div className="section-content">{children}</div>
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
    const [customers, setCustomers] = useState([]);
    const [limitCheckResult, setLimitCheckResult] = useState(null);
    const [timeRemaining, setTimeRemaining] = useState('');
    const countdownIntervalRef = useRef();
    const [recentDeposits, setRecentDeposits] = useState([]);
    const [agentRequests, setAgentRequests] = useState([]);

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
            onSnapshot(query(collection(db, 'customers'), where('managedByAgentId', '==', user.uid), orderBy("createdAt", "desc")), snap => {
                setCustomers(snap.docs.map(d => ({id: d.id, ...d.data()})));
            }),
            onSnapshot(query(collection(db, 'orders'), where('status', '==', 'paid'), orderBy('created', 'desc'), limit(15)), snap => {
                setRecentDeposits(snap.docs.map(d => ({id: d.id, ...d.data()})));
            }),
            onSnapshot(query(collection(db, 'agentCashoutRequests'), where('agentId', '==', user.uid), orderBy('requestedAt', 'desc')), snap => {
                setAgentRequests(snap.docs.map(d => ({id: d.id, ...d.data()})));
            }),
        ];
        return () => unsubscribes.forEach(unsub => unsub());
    }, [user]);

    // --- Client-Side Data Enrichment for Deposits ---
    const enrichedDeposits = useMemo(() => {
        const customerMap = new Map(customers.map(c => [c.username, c.facebookName]));
        return recentDeposits.map(dep => ({
            ...dep,
            // FIX: Ensure amount is a number for calculations and formatting
            amount: parseFloat(dep.amount || 0),
            facebookName: customerMap.get(dep.username) || 'N/A'
        }));
    }, [customers, recentDeposits]);
    
    // --- UI and Feature Handlers ---
    
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
            <div className="agent-dashboard-full"> 
                <header className="panel-header">
                    <div><h2 className="agent-name">{agentProfile?.name}</h2><p className="page-code-display">Default Page Code: {agentProfile?.pageCode}</p></div>
                    <button onClick={() => auth.signOut()} className="btn btn-danger">Logout</button>
                </header>
                
                {message.text && <div className={`message-bar message-${message.type}`}>{message.text}</div>}
                
                <div className="panel-content">
                    <div className="card-group">
                        <SectionCard title="Username Generator"><form onSubmit={handleGenerateUsername} className="form-stack"><div><label htmlFor="facebookName">Customer's FB Name</label><input id="facebookName" value={facebookName} onChange={e => setFacebookName(e.target.value)} required className="input-field" /></div><div><label htmlFor="manualPageCode">Page Code</label><input id="manualPageCode" value={manualPageCode} onChange={e => setManualPageCode(e.target.value)} required pattern="\d{4}" className="input-field" /></div><button type="submit" className="btn btn-primary">Generate</button>{generatedUsername && <p className="alert alert-success">Generated: <strong>{generatedUsername}</strong></p>}</form></SectionCard>
                        <SectionCard title="Add New Customer"><form onSubmit={handleAddCustomer} className="form-stack"><input name="username" required className="input-field" placeholder="Game Username"/><input name="facebookName" required className="input-field" placeholder="Facebook Name"/><input name="facebookProfileLink" type="url" required className="input-field" placeholder="Facebook Profile URL"/><button type="submit" className="btn btn-success">Add Customer</button></form></SectionCard>
                        <SectionCard title="Check Cashout Limit"><form onSubmit={handleCheckLimit}><div className="form-row"><input name="customerUsername" required className="input-field" placeholder="Customer Username"/><button type="submit" className="btn btn-info">Check</button></div>{limitCheckResult && (<div className="alert alert-info"><p>Limit for <strong>{limitCheckResult.username}</strong>: ${limitCheckResult.remainingLimit.toFixed(2)}</p><p><small>First cashout: {limitCheckResult.firstCashoutTimeInWindow ? new Date(limitCheckResult.firstCashoutTimeInWindow).toLocaleTimeString() : 'N/A'}</small></p>{limitCheckResult.windowResetsAt && <p><small>Resets in: <strong>{timeRemaining}</strong></small></p>}</div>)}</form></SectionCard>
                    </div>
                    <div className="card-group">
                        <SectionCard title="Recent Deposits"><div className="list-container">{enrichedDeposits.map(dep => (<div key={dep.id} className="list-item"><p><strong>{dep.facebookName}</strong> ({dep.username})</p><p>Deposited ${dep.amount.toFixed(2)} for {dep.game}</p><p className="list-item-footer">{dep.created?.toDate ? dep.created.toDate().toLocaleString() : 'N/A'}</p></div>))}</div></SectionCard>
                        <SectionCard title="My Customers"><div className="list-container">{customers.map(c => (<div key={c.id} className="list-item"><p><strong>{c.facebookName}</strong> ({c.username})</p><a href={c.facebookProfileLink} target="_blank" rel="noopener noreferrer" className="link">View Profile</a></div>))}</div></SectionCard>
                        <SectionCard title="My Cashout Requests"><div className="list-container">{agentRequests.map(r => (<div key={r.id} className="list-item"><p>${parseFloat(r.amount || 0).toFixed(2)} requested on {r.requestedAt?.toDate ? r.requestedAt.toDate().toLocaleDateString() : 'N/A'}</p><p>Status: <span className={`status-${r.status}`}>{r.status}</span></p></div>))}</div></SectionCard>
                    </div>
                </div>
            </div>
            <style jsx>{`
                .agent-dashboard-full { 
                    display: flex; 
                    flex-direction: column;
                    min-height: 100vh; 
                    width: 100vw; 
                    background-color: #e5e7eb; 
                }
                .panel-header { display: flex; justify-content: space-between; align-items: center; padding: 1rem; background-color: #1f2937; color: white; flex-shrink: 0; }
                .agent-name { font-size: 1.25rem; font-weight: bold; }
                .page-code-display { font-size: 0.875rem; color: #93c5fd; }
                .panel-content { 
                    padding: 1rem; 
                    flex-grow: 1; 
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
                    gap: 1rem;
                }
                .card-group {
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                }
                .section-card { background-color: white; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06); border-radius: 0.5rem; overflow: hidden; }
                .section-header { display: flex; justify-content: space-between; align-items: center; background-color: #f3f4f6; padding: 0.75rem 1rem; border-bottom: 1px solid #e5e7eb; }
                .section-header h3 { font-size: 1.125rem; font-weight: 600; color: #111827; }
                .section-content { padding: 1rem; }
                .form-row { display: flex; gap: 0.5rem; align-items: flex-end; }
                .form-stack { display: flex; flex-direction: column; gap: 0.75rem; }
                .form-stack label { font-size: 0.875rem; font-weight: 500; color: #374151; }
                .input-field { width: 100%; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 0.25rem; font-size: 0.875rem; }
                .input-field:focus { outline: 2px solid #3b82f6; border-color: transparent; }
                .btn { padding: 0.5rem 0.75rem; border-radius: 0.25rem; color: white; border: none; cursor: pointer; font-weight: 500; }
                .btn-primary { background-color: #3b82f6; } .btn-secondary { background-color: #6b7280; }
                .btn-info { background-color: #06b6d4; } .btn-success { background-color: #10b981; } .btn-danger { background-color: #ef4444; }
                .list-container { max-height: 12rem; overflow-y: auto; font-size: 0.875rem; }
                .list-item { padding: 0.5rem; border-bottom: 1px solid #e5e7eb; }
                .list-item:last-child { border-bottom: none; }
                .list-item p { margin: 0; line-height: 1.4; }
                .list-item-footer { font-size: 0.75rem; color: #6b7280; }
                .link { color: #3b82f6; text-decoration: none; font-size: 0.75rem; }
                .link:hover { text-decoration: underline; }
                .message-bar { padding: 0.5rem; text-align: center; font-size: 0.875rem; }
                .message-success { background-color: #d1fae5; color: #065f46; }
                .message-error { background-color: #fee2e2; color: #991b1b; }
                .alert { padding: 0.75rem; margin-top: 0.5rem; border-radius: 0.25rem; font-size: 0.9em; }
                .alert-success { background-color: #d1fae5; color: #065f46; } .alert-info { background-color: #cffafe; color: #0e7490; }
                .status-pending { color: #f59e0b; font-weight: bold; } .status-approved { color: #10b981; font-weight: bold; } .status-rejected { color: #ef4444; font-weight: bold; }
                .loading-screen, .loading-spinner { text-align: center; padding: 2rem; font-size: 1.25rem; color: #4b5563; }
            `}</style>
        </>
    );
}