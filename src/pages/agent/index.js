// src/pages/agent/index.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import Head from 'next/head';
import { db, auth } from '../../lib/firebaseClient';
import { onSnapshot, query, collection, where, orderBy, getDoc, doc, limit } from 'firebase/firestore';
import { useRouter } from 'next/router';
import { onAuthStateChanged } from 'firebase/auth';

// --- Reusable Helper Components ---
const LoadingSpinner = () => <div className="text-center p-4">Loading...</div>;

const SectionCard = ({ title, children, onRefresh, isRefreshing }) => (
    <section className="bg-white shadow-md rounded-lg mb-6 overflow-hidden">
        <div className="flex justify-between items-center bg-gray-100 px-4 py-3 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
            {onRefresh && (
                <button onClick={onRefresh} disabled={isRefreshing} className="text-sm btn btn-secondary p-1 disabled:opacity-50">
                    {isRefreshing ? '...' : 'Refresh'}
                </button>
            )}
        </div>
        <div className="p-4">{children}</div>
    </section>
);

// --- Main Agent Dashboard Component ---
export default function AgentDashboard() {
    const router = useRouter();
    const [user, setUser] = useState(null);
    const [agentProfile, setAgentProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState({ text: '', type: '' });

    // --- State for All Features ---
    // Panel UI
    const [panelWidth, setPanelWidth] = useState(550);
    const [isResizing, setIsResizing] = useState(false);
    const [iframeUrl, setIframeUrl] = useState('https://luckypaws.vercel.app/games');
    const [urlInput, setUrlInput] = useState(iframeUrl);

    // Username Generator
    const [facebookName, setFacebookName] = useState('');
    const [manualPageCode, setManualPageCode] = useState(''); // Restored for manual input
    const [generatedUsername, setGeneratedUsername] = useState('');
    
    // Customer Management
    const [customers, setCustomers] = useState([]);

    // Limit Checker
    const [limitCheckResult, setLimitCheckResult] = useState(null);
    const [timeRemaining, setTimeRemaining] = useState('');
    const countdownIntervalRef = useRef();

    // Deposits & Agent Requests
    const [deposits, setDeposits] = useState([]);
    const [depositsLoading, setDepositsLoading] = useState(true);
    const [agentRequests, setAgentRequests] = useState([]);

    // --- Authentication & Profile Setup ---
    useEffect(() => {
        const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                const tokenResult = await currentUser.getIdTokenResult();
                if (tokenResult.claims.agent) {
                    setUser(currentUser);
                    const docSnap = await getDoc(doc(db, 'users', currentUser.uid));
                    if (docSnap.exists()) {
                        const profile = docSnap.data();
                        setAgentProfile(profile);
                        setManualPageCode(profile.pageCode || ''); // Set default for manual input
                    }
                    setLoading(false);
                } else { router.replace('/agent/login'); }
            } else { router.replace('/agent/login'); }
        });
        return () => unsubscribeAuth();
    }, [router]);

    // --- Data Fetching (Listeners & API Calls) ---
    const fetchDeposits = useCallback(async () => {
        if (!user) return;
        setDepositsLoading(true);
        try {
            const token = await user.getIdToken();
            const res = await fetch('/api/agent/deposits', { headers: { 'Authorization': `Bearer ${token}` }});
            const data = await res.json();
            if (!res.ok) throw new Error(data.message);
            setDeposits(data.deposits);
        } catch (err) { setMessage({ text: 'Failed to fetch deposits.', type: 'error' });
        } finally { setDepositsLoading(false); }
    }, [user]);

    useEffect(() => {
        if (!user) return;
        fetchDeposits(); // Initial fetch
        const unsubscribes = [
            onSnapshot(query(collection(db, 'customers'), where('managedByAgentId', '==', user.uid), orderBy("createdAt", "desc")), snap => setCustomers(snap.docs.map(d => ({id: d.id, ...d.data()})))),
            onSnapshot(query(collection(db, 'agentCashoutRequests'), where('agentId', '==', user.uid), orderBy('requestedAt', 'desc')), snap => setAgentRequests(snap.docs.map(d => ({id: d.id, ...d.data()})))),
        ];
        return () => unsubscribes.forEach(unsub => unsub());
    }, [user, fetchDeposits]);


    // --- UI Handlers ---
    const handleMouseDown = useCallback(() => setIsResizing(true), []);
    const handleMouseUp = useCallback(() => setIsResizing(false), []);
    const handleMouseMove = useCallback((e) => {
        if (isResizing) { setPanelWidth(Math.min(Math.max(e.clientX, 400), window.innerWidth - 300)); }
    }, [isResizing]);

    useEffect(() => {
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [handleMouseMove, handleMouseUp]);


    // --- Feature Handlers ---
    const handleApiRequest = async (endpoint, body, successMessage) => { /* ... (Unchanged) ... */ };
    
    const handleGenerateUsername = async (e) => {
        e.preventDefault();
        const pageCodeToUse = manualPageCode; // Use the value from the manual input
        const data = await handleApiRequest('/api/generate-username', { facebookName, pageCode: pageCodeToUse });
        if (data) setGeneratedUsername(data.username);
    };
    
    const handleAddCustomer = async (e) => {
        e.preventDefault();
        const { username, facebookName, facebookProfileLink } = e.target.elements;
        await handleApiRequest('/api/agent/customers/create', { username: username.value, facebookName: facebookName.value, facebookProfileLink: facebookProfileLink.value }, 'Customer added!');
        e.target.reset();
    };

    const handleCheckLimit = async (e) => {
        e.preventDefault();
        const { customerUsername } = e.target.elements;
        const token = await user.getIdToken();
        const res = await fetch(`/api/customer-cashout-limit?username=${customerUsername.value.trim()}`, { headers: { 'Authorization': `Bearer ${token}` }});
        const data = await res.json();
        if (!res.ok) { setMessage({text: data.message, type: 'error'}); } else { setLimitCheckResult(data); }
    };
    
    useEffect(() => {
        clearInterval(countdownIntervalRef.current);
        if (limitCheckResult?.windowResetsAt) {
            countdownIntervalRef.current = setInterval(() => {
                const diff = new Date(limitCheckResult.windowResetsAt) - new Date();
                if (diff <= 0) {
                    setTimeRemaining('Limit Reset!');
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

    if (loading) return <div className="fixed inset-0 flex items-center justify-center bg-gray-100"><LoadingSpinner /></div>;

    return (
        <>
            <Head><title>Agent Dashboard | Lucky Paws</title></Head>
            <div className="flex h-screen w-screen bg-gray-200 overflow-hidden" onMouseUp={handleMouseUp}>
                <aside className="h-full flex-shrink-0 bg-gray-50 flex flex-col" style={{ width: `${panelWidth}px` }}>
                    <header className="p-4 bg-gray-800 text-white flex justify-between items-center flex-shrink-0">
                        <div>
                            <h2 className="text-xl font-bold">{agentProfile?.name}</h2>
                            <p className="text-sm text-blue-300">Default Page Code: {agentProfile?.pageCode}</p>
                        </div>
                        <button onClick={() => auth.signOut()} className="bg-red-500 hover:bg-red-600 px-3 py-1 rounded">Logout</button>
                    </header>
                    
                    {message.text && <div className={`p-2 text-center text-sm ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{message.text}</div>}
                    
                    <div className="overflow-y-auto p-4 flex-grow">
                        <SectionCard title="Browser Control">
                            <form onSubmit={(e) => { e.preventDefault(); setIframeUrl(urlInput); }} className="flex gap-2"><input type="url" value={urlInput} onChange={e => setUrlInput(e.target.value)} className="input-field flex-grow" /><button type="submit" className="btn btn-secondary">Go</button></form>
                        </SectionCard>

                        <SectionCard title="Username Generator">
                            <form onSubmit={handleGenerateUsername} className="space-y-2">
                                <div><label>Customer's FB Name</label><input value={facebookName} onChange={e => setFacebookName(e.target.value)} required className="input-field" /></div>
                                <div><label>Page Code</label><input value={manualPageCode} onChange={e => setManualPageCode(e.target.value)} required pattern="\d{4}" className="input-field" /></div>
                                <button type="submit" className="btn btn-primary w-full">Generate</button>
                                {generatedUsername && <p className="alert alert-success mt-2">Generated: <strong>{generatedUsername}</strong></p>}
                            </form>
                        </SectionCard>
                        
                        <SectionCard title="Add New Customer">
                             <form onSubmit={handleAddCustomer} className="space-y-2">
                                <input name="username" required className="input-field" placeholder="Game Username"/><input name="facebookName" required className="input-field" placeholder="Facebook Name"/><input name="facebookProfileLink" type="url" required className="input-field" placeholder="Facebook Profile URL"/><button type="submit" className="btn btn-success w-full">Add Customer</button>
                            </form>
                        </SectionCard>
                        
                        <SectionCard title="Check Cashout Limit">
                             <form onSubmit={handleCheckLimit}><div className="flex gap-2"><input name="customerUsername" required className="input-field flex-grow" placeholder="Customer Username"/><button type="submit" className="btn btn-info">Check</button></div>
                                {limitCheckResult && (<div className="alert alert-info mt-2"><p>Limit for <strong>{limitCheckResult.username}</strong>: ${limitCheckResult.remainingLimit.toFixed(2)}</p><p><small>First cashout: {limitCheckResult.firstCashoutTimeInWindow ? new Date(limitCheckResult.firstCashoutTimeInWindow).toLocaleTimeString() : 'N/A'}</small></p>{limitCheckResult.windowResetsAt && <p><small>Resets in: <strong>{timeRemaining}</strong></small></p>}</div>)}
                            </form>
                        </SectionCard>
                        
                        <SectionCard title="Recent Deposits" onRefresh={fetchDeposits} isRefreshing={depositsLoading}>
                            <div className="max-h-48 overflow-y-auto">{depositsLoading ? <LoadingSpinner/> : deposits.map(dep => (<div key={dep.id} className="text-sm p-2 border-b"><p><strong>{dep.facebookName}</strong> ({dep.username})</p><p>Deposited ${dep.amount.toFixed(2)} for {dep.game}</p><p className="text-xs text-gray-500">{new Date(dep.created).toLocaleString()}</p></div>))}</div>
                        </SectionCard>

                        <SectionCard title="My Customers">
                            <div className="max-h-48 overflow-y-auto">{customers.map(c => (<div key={c.id} className="text-sm p-2 border-b"><p><strong>{c.facebookName}</strong> ({c.username})</p><a href={c.facebookProfileLink} target="_blank" rel="noopener noreferrer" className="text-blue-500 text-xs">View Profile</a></div>))}</div>
                        </SectionCard>

                        <SectionCard title="My Cashout Requests">
                            <div className="max-h-48 overflow-y-auto">{agentRequests.map(r => (<div key={r.id} className="text-sm p-2 border-b"><p>${r.amount} requested on {new Date(r.requestedAt.seconds * 1000).toLocaleDateString()}</p><p>Status: <span className={`font-bold status-${r.status}`}>{r.status}</span></p></div>))}</div>
                        </SectionCard>

                    </div>
                </aside>

                <div className="w-2 h-full cursor-col-resize bg-gray-300 hover:bg-blue-400" onMouseDown={handleMouseDown}></div>
                
                <main className="flex-grow h-full"><iframe src={iframeUrl} title="Main Content" className="w-full h-full border-0"></iframe></main>
            </div>
            <style jsx>{`
                .input-field { width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; margin-top: 4px; }
                .btn { padding: 8px 12px; border-radius: 4px; color: white; border: none; cursor: pointer; font-weight: 500;}
                .btn-primary { background-color: #3b82f6; } .btn-secondary { background-color: #6b7280; }
                .btn-info { background-color: #06b6d4; } .btn-success { background-color: #10b981; }
                .alert { padding: 8px; border-radius: 4px; margin-top: 8px; font-size: 0.9em;}
                .alert-success { background-color: #d1fae5; color: #065f46; } .alert-info { background-color: #cffafe; color: #0e7490; }
                .status-pending { color: #f59e0b; } .status-approved { color: #10b981; } .status-rejected { color: #ef4444; }
            `}</style>
        </>
    );
}