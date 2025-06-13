// src/pages/agent/index.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import Head from 'next/head';
import { db, auth } from '../../lib/firebaseClient';
import { onSnapshot, query, collection, where, orderBy, getDoc, doc } from 'firebase/firestore';
import { useRouter } from 'next/router';
import { onAuthStateChanged } from 'firebase/auth';

// --- Helper Components ---
const LoadingSpinner = () => <div className="spinner"></div>;

const SectionCard = ({ title, children }) => (
    <section className="bg-white shadow-md rounded-lg mb-6 overflow-hidden">
        <h3 className="text-lg font-semibold text-gray-800 bg-gray-100 px-4 py-3 border-b border-gray-200">{title}</h3>
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

    // State for Panel UI
    const [panelWidth, setPanelWidth] = useState(500);
    const [isResizing, setIsResizing] = useState(false);
    const [iframeUrl, setIframeUrl] = useState('https://luckypaws.vercel.app/games');
    const [urlInput, setUrlInput] = useState(iframeUrl);

    // State for Features
    const [generatedUsername, setGeneratedUsername] = useState('');
    const [limitCheckResult, setLimitCheckResult] = useState(null);
    const [timeRemaining, setTimeRemaining] = useState('');
    const [deposits, setDeposits] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [agentRequests, setAgentRequests] = useState([]);

    // Refs for intervals
    const countdownIntervalRef = useRef();

    // --- Authentication and Profile Fetching ---
    useEffect(() => {
        const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                const tokenResult = await currentUser.getIdTokenResult();
                if (tokenResult.claims.agent) {
                    setUser(currentUser);
                    const docSnap = await getDoc(doc(db, 'users', currentUser.uid));
                    if (docSnap.exists()) setAgentProfile(docSnap.data());
                    setLoading(false);
                } else {
                    router.replace('/agent/login');
                }
            } else {
                router.replace('/agent/login');
            }
        });
        return () => unsubscribeAuth();
    }, [router]);

    // --- Data Fetching Listeners ---
    useEffect(() => {
        if (!user) return;
        const unsubscribes = [
            onSnapshot(query(collection(db, 'customers'), where('managedByAgentId', '==', user.uid)), snap => setCustomers(snap.docs.map(d => d.data()))),
            onSnapshot(query(collection(db, 'agentCashoutRequests'), where('agentId', '==', user.uid), orderBy('requestedAt', 'desc')), snap => setAgentRequests(snap.docs.map(d => d.data()))),
            onSnapshot(query(collection(db, 'orders'), where('status', '==', 'paid'), orderBy('created', 'desc'), limit(10)), snap => {
                 const depositsData = snap.docs.map(d => {
                     const data = d.data();
                     const facebookName = customers.find(c => c.username === data.username)?.facebookName || 'N/A';
                     return {...data, facebookName};
                 });
                 setDeposits(depositsData);
            }),
        ];
        return () => unsubscribes.forEach(unsub => unsub());
    }, [user, customers]); // Re-run if user or customers change (for facebookName enrichment)


    // --- UI Handlers (Panel Resizing) ---
    const handleMouseDown = useCallback(() => setIsResizing(true), []);
    const handleMouseUp = useCallback(() => setIsResizing(false), []);
    const handleMouseMove = useCallback((e) => {
        if (isResizing) {
            const newWidth = Math.min(Math.max(e.clientX, 350), window.innerWidth - 300);
            setPanelWidth(newWidth);
        }
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
    const handleApiRequest = async (endpoint, body, successMessage) => {
        setMessage({ text: '', type: '' });
        try {
            const token = await user.getIdToken();
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message);
            setMessage({ text: successMessage || data.message, type: 'success' });
            return data;
        } catch (err) {
            setMessage({ text: err.message, type: 'error' });
            return null;
        }
    };

    const handleGenerateUsername = async (e) => {
        e.preventDefault();
        const { facebookName } = e.target.elements;
        const data = await handleApiRequest(
            '/api/generate-username',
            { facebookName: facebookName.value, pageCode: agentProfile.pageCode },
            'Username generated!'
        );
        if (data) setGeneratedUsername(data.username);
    };
    
    const handleAddCustomer = async (e) => {
        e.preventDefault();
        const { username, facebookName, facebookProfileLink } = e.target.elements;
        await handleApiRequest(
            '/api/agent/customers/create',
            { username: username.value, facebookName: facebookName.value, facebookProfileLink: facebookProfileLink.value },
            'Customer added successfully!'
        );
        e.target.reset();
    };

    const handleCheckLimit = async (e) => {
        e.preventDefault();
        const { customerUsername } = e.target.elements;
        try {
            const token = await user.getIdToken();
            const res = await fetch(`/api/customer-cashout-limit?username=${customerUsername.value.trim()}`, { headers: { 'Authorization': `Bearer ${token}` }});
            const data = await res.json();
            if (!res.ok) throw new Error(data.message);
            setLimitCheckResult(data);
        } catch(err) { setMessage({text: err.message, type: 'error'}); }
    };
    
    useEffect(() => {
        clearInterval(countdownIntervalRef.current);
        if (limitCheckResult?.windowResetsAt) {
            countdownIntervalRef.current = setInterval(() => {
                const now = new Date();
                const resetTime = new Date(limitCheckResult.windowResetsAt);
                const diff = resetTime - now;
                if (diff <= 0) {
                    setTimeRemaining('Limit has reset!');
                    clearInterval(countdownIntervalRef.current);
                } else {
                    const h = Math.floor(diff / (1000 * 60 * 60)).toString().padStart(2, '0');
                    const m = Math.floor((diff / 1000 / 60) % 60).toString().padStart(2, '0');
                    const s = Math.floor((diff / 1000) % 60).toString().padStart(2, '0');
                    setTimeRemaining(`${h}:${m}:${s}`);
                }
            }, 1000);
        }
        return () => clearInterval(countdownIntervalRef.current);
    }, [limitCheckResult]);

    if (loading) return <div className="fixed inset-0 flex items-center justify-center bg-gray-100"><LoadingSpinner /></div>;

    return (
        <>
            <Head><title>Agent Dashboard</title></Head>
            <div className="flex h-screen w-screen bg-gray-200" onMouseUp={handleMouseUp}>
                {/* --- RESIZABLE AGENT PANEL --- */}
                <aside className="h-full flex-shrink-0 bg-gray-50 flex flex-col" style={{ width: `${panelWidth}px` }}>
                    <header className="p-4 bg-gray-800 text-white flex justify-between items-center flex-shrink-0">
                        <div>
                            <h2 className="text-xl font-bold">{agentProfile?.name}</h2>
                            <p className="text-sm text-blue-300">Page Code: {agentProfile?.pageCode}</p>
                        </div>
                        <button onClick={() => auth.signOut()} className="bg-red-500 hover:bg-red-600 px-3 py-1 rounded">Logout</button>
                    </header>
                    
                    {message.text && (
                        <div className={`p-2 text-center text-sm ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {message.text}
                        </div>
                    )}
                    
                    <div className="overflow-y-auto p-4 flex-grow">
                        {/* --- IFrame Navigation --- */}
                        <SectionCard title="Browser Control">
                            <form onSubmit={(e) => { e.preventDefault(); setIframeUrl(urlInput); }} className="flex gap-2">
                                <input type="url" value={urlInput} onChange={e => setUrlInput(e.target.value)} className="input-field flex-grow" placeholder="Enter URL..." />
                                <button type="submit" className="btn btn-secondary">Go</button>
                            </form>
                            <div className="mt-2 flex flex-wrap gap-2">
                                <button onClick={() => setIframeUrl('/games')} className="btn btn-info btn-small">Game Links</button>
                            </div>
                        </SectionCard>
                        
                        {/* --- Agent Tools --- */}
                        <SectionCard title="Customer Tools">
                            <form onSubmit={handleGenerateUsername}>
                                <label>Username Generator</label>
                                <div className="flex gap-2">
                                    <input name="facebookName" required className="input-field flex-grow" placeholder="Customer's FB Name"/>
                                    <button type="submit" className="btn btn-primary">Generate</button>
                                </div>
                                {generatedUsername && <p className="alert alert-success mt-2">Generated: <strong>{generatedUsername}</strong></p>}
                            </form>
                            <hr className="my-4"/>
                             <form onSubmit={handleCheckLimit}>
                                <label>Check Cashout Limit</label>
                                <div className="flex gap-2">
                                     <input name="customerUsername" required className="input-field flex-grow" placeholder="Customer Username"/>
                                     <button type="submit" className="btn btn-info">Check</button>
                                </div>
                                {limitCheckResult && (
                                    <div className="alert alert-info mt-2">
                                        <p>Limit for <strong>{limitCheckResult.username}</strong>: ${limitCheckResult.remainingLimit.toFixed(2)}</p>
                                        <p><small>First cashout: {limitCheckResult.firstCashoutTimeInWindow ? new Date(limitCheckResult.firstCashoutTimeInWindow).toLocaleTimeString() : 'N/A'}</small></p>
                                        {limitCheckResult.windowResetsAt && <p><small>Resets in: <strong>{timeRemaining}</strong></small></p>}
                                    </div>
                                )}
                            </form>
                        </SectionCard>

                        <SectionCard title="Add New Customer">
                             <form onSubmit={handleAddCustomer} className="space-y-2">
                                <input name="username" required className="input-field" placeholder="Game Username"/>
                                <input name="facebookName" required className="input-field" placeholder="Facebook Name"/>
                                <input name="facebookProfileLink" type="url" required className="input-field" placeholder="Facebook Profile URL"/>
                                <button type="submit" className="btn btn-success w-full">Add Customer</button>
                            </form>
                        </SectionCard>
                        
                         {/* Other sections like Live Deposits, Customer List etc. would go here */}

                    </div>
                </aside>

                {/* --- RESIZE HANDLE --- */}
                <div className="w-2 h-full cursor-col-resize bg-gray-300 hover:bg-blue-400" onMouseDown={handleMouseDown}></div>

                {/* --- IFRAME CONTENT --- */}
                <main className="flex-grow h-full">
                    <iframe src={iframeUrl} className="w-full h-full border-0"></iframe>
                </main>
            </div>
            <style jsx>{`
                .input-field { width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; }
                .btn { padding: 8px 12px; border-radius: 4px; color: white; border: none; cursor: pointer; }
                .btn-primary { background-color: #3b82f6; }
                .btn-secondary { background-color: #6b7280; }
                .btn-info { background-color: #06b6d4; }
                .btn-success { background-color: #10b981; }
                .btn-small { font-size: 0.8rem; padding: 4px 8px; }
                .alert { padding: 8px; border-radius: 4px; margin-top: 8px; }
                .alert-success { background-color: #d1fae5; color: #065f46; }
                .alert-info { background-color: #cffafe; color: #0e7490; }
            `}</style>
        </>
    );
}