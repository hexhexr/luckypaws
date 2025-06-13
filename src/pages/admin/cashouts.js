// pages/admin/cashouts.js
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { db, auth as firebaseAuth } from '../../lib/firebaseClient';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, onSnapshot, collection, query, where, orderBy } from 'firebase/firestore';
import * as bolt11 from 'lightning-invoice';
import DataTable from '../../components/DataTable';

const formatSats = (sats) => new Intl.NumberFormat().format(sats);

const LoadingSkeleton = () => (
    <div className="loading-skeleton mt-md">
        <div className="skeleton-line" style={{ width: '95%' }}></div>
        <div className="skeleton-line" style={{ width: '85%' }}></div>
        <div className="skeleton-line" style={{ width: '90%' }}></div>
    </div>
);

export default function AdminCashouts() {
    const router = useRouter();
    const [isAdmin, setIsAdmin] = useState(false);
    const [authLoading, setAuthLoading] = useState(true);
    
    // --- FORM STATES ---
    const [username, setUsername] = useState('');
    const [destination, setDestination] = useState('');
    const [usdAmount, setUsdAmount] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [status, setStatus] = useState({ message: '', type: '' });
    const [isAmountless, setIsAmountless] = useState(false);
    const [isLnAddress, setIsLnAddress] = useState(false);
    const [liveQuote, setLiveQuote] = useState({ sats: 0, btcPrice: 0 });

    // --- HISTORY/DATA STATES ---
    const [history, setHistory] = useState([]);
    const [agentCashouts, setAgentCashouts] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(true);
    const [agentCashoutsLoading, setAgentCashoutsLoading] = useState(true);
    
    // --- Auth & Logout ---
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
            if (user) {
                try {
                    const userDocSnap = await getDoc(doc(db, 'users', user.uid));
                    if (userDocSnap.exists() && userDocSnap.data()?.isAdmin) {
                        setIsAdmin(true);
                    } else {
                        await firebaseAuth.signOut();
                        router.replace('/admin');
                    }
                } catch (e) {
                    await firebaseAuth.signOut();
                    router.replace('/admin');
                }
            } else {
                router.replace('/admin');
            }
            setAuthLoading(false);
        });
        return () => unsubscribe();
    }, [router]);

    const logout = useCallback(async () => {
        await firebaseAuth.signOut();
        router.push('/admin');
    }, [router]);

    // --- Load Customer Cashout History ---
    useEffect(() => {
        if (!isAdmin) return;
        setHistoryLoading(true);
        const q = query(collection(db, "cashouts"), orderBy("time", "desc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setHistory(data);
            setHistoryLoading(false);
        }, (err) => {
            console.error("History fetch error:", err);
            setStatus({ message: 'Failed to load cashout history.', type: 'error' });
            setHistoryLoading(false);
        });
        return () => unsubscribe();
    }, [isAdmin]);
    
    // --- Load Agent Cashout Requests ---
    useEffect(() => {
        if (!isAdmin) return;
        setAgentCashoutsLoading(true);
        const q = query(collection(db, "agentCashoutRequests"), where("status", "==", "pending"), orderBy("requestedAt", "desc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setAgentCashouts(data);
            setAgentCashoutsLoading(false);
        }, (err) => {
            console.error("Agent cashouts fetch error:", err);
            setStatus({ message: 'Failed to load agent cashout requests.', type: 'error' });
            setAgentCashoutsLoading(false);
        });
        return () => unsubscribe();
    }, [isAdmin]);

    // --- Price Quote ---
    const fetchQuote = useCallback(async (amount) => {
        if (!amount || isNaN(amount) || amount <= 0) {
            setLiveQuote({ sats: 0, btcPrice: 0 });
            return;
        }
        try {
            const adminIdToken = await firebaseAuth.currentUser.getIdToken();
            const res = await fetch(`/api/admin/cashouts/quote?amount=${amount}`, {
                headers: { 'Authorization': `Bearer ${adminIdToken}` }
            });
            const data = await res.json();
            if (res.ok) setLiveQuote({ sats: data.sats, btcPrice: data.btcPrice });
        } catch (error) {
            console.error("Quote fetch error:", error);
        }
    }, []);
    
    // --- Destination Parser ---
    useEffect(() => {
        setStatus({ message: '', type: '' });
        setIsAmountless(false);
        setIsLnAddress(false);
        const dest = destination.trim();

        if (!dest) return;

        if (dest.startsWith('lnbc')) {
            try {
                const decoded = bolt11.decode(dest);
                const sats = decoded.satoshis || (decoded.millisatoshis ? parseInt(decoded.millisatoshis) / 1000 : null);
                if (sats && sats > 0) {
                    const estimatedUsd = (sats / 100000000) * (liveQuote.btcPrice || 70000);
                    setUsdAmount(estimatedUsd.toFixed(2));
                    setStatus({ message: `Fixed amount invoice: ${formatSats(sats)} sats.`, type: 'info' });
                } else {
                    setIsAmountless(true);
                    setStatus({ message: 'Amountless invoice detected. Enter USD amount.', type: 'info' });
                }
            } catch (e) {
                setStatus({ message: 'Invalid Lightning Invoice. Check format.', type: 'error' });
            }
        } else if (dest.includes('@')) {
            setIsLnAddress(true);
            setStatus({ message: 'Lightning Address detected. Enter USD amount.', type: 'info' });
        } else {
            setStatus({ message: 'Not a valid Bolt11 invoice or Lightning Address.', type: 'error' });
        }
    }, [destination, liveQuote.btcPrice]);

    // --- Submit Handler ---
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!window.confirm(`Confirm cashout for ${username}?`)) return;

        setIsSending(true);
        setStatus({ message: 'Processing...', type: 'info' });

        try {
            const adminIdToken = await firebaseAuth.currentUser.getIdToken();
            const res = await fetch('/api/admin/cashouts/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminIdToken}` },
                body: JSON.stringify({
                    username,
                    destination,
                    usdAmount: (isAmountless || isLnAddress) ? usdAmount : null,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message);
            setStatus({ message: `Success! ${formatSats(data.details.amountSats)} sats sent.`, type: 'success' });
            setUsername('');
            setDestination('');
            setUsdAmount('');
        } catch (error) {
            setStatus({ message: `Error: ${error.message}`, type: 'error' });
        } finally {
            setIsSending(false);
        }
    };
    
    // --- Agent Cashout Action Handler ---
    const handleAgentCashoutAction = async (requestId, action) => {
        if (!window.confirm(`Are you sure you want to ${action} this request?`)) return;

        try {
            const adminIdToken = await firebaseAuth.currentUser.getIdToken();
            const res = await fetch(`/api/admin/agent-cashouts/${action}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminIdToken}` },
                body: JSON.stringify({ id: requestId })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message);
            alert(`Request ${action}ed successfully.`);
        } catch(err) {
            console.error(err);
            alert(`Failed to ${action} request.`);
        }
    };
    
    const customerHistoryColumns = useMemo(() => [
        { header: 'Time', accessor: 'time', sortable: true, cell: (row) => new Date(row.time).toLocaleString() },
        { header: 'Username', accessor: 'username', sortable: true },
        { header: 'Amount (USD)', accessor: 'amountUSD', sortable: true, cell: (row) => `$${row.amountUSD?.toFixed(2)}` },
        { header: 'Amount (Sats)', accessor: 'amountSats', sortable: true, cell: (row) => formatSats(row.amountSats) },
        { header: 'Status', accessor: 'status', sortable: true, cell: (row) => <span className={`status-badge status-${row.status}`}>{row.status}</span>},
        { header: 'Destination', accessor: 'destination', sortable: false, cell: (row) => <span title={row.destination}>{row.destination?.substring(0, 20)}...</span> },
    ], []);

    const agentRequestColumns = useMemo(() => [
        { header: 'Requested At', accessor: 'requestedAt', sortable: true, cell: (row) => row.requestedAt?.toDate().toLocaleString() },
        { header: 'Agent Name', accessor: 'agentName', sortable: true },
        { header: 'Amount', accessor: 'amount', sortable: true, cell: (row) => `$${row.amount?.toFixed(2)}` },
        { header: 'Actions', accessor: 'actions', sortable: false, cell: (row) => (
            <div className="action-buttons">
                <button className="btn btn-success btn-small" onClick={() => handleAgentCashoutAction(row.id, 'approve')}>Approve</button>
                <button className="btn btn-danger btn-small" onClick={() => handleAgentCashoutAction(row.id, 'reject')}>Reject</button>
            </div>
        )},
    ], []);

    if (authLoading) return <div className="loading-screen">Checking authentication...</div>;
    if (!isAdmin) return <div className="loading-screen">Access Denied.</div>;

    return (
        <div className="admin-dashboard-container">
            <Head><title>Admin - Cashouts</title></Head>
            <header className="admin-header">
                <h1>Lightning Cashouts</h1>
                <nav>
                    <ul className="admin-nav">
                         <li><a href="/admin/dashboard">Dashboard</a></li>
                         <li><a href="/admin/cashouts" className="active">Cashouts</a></li>
                         <li><a href="/admin/games">Games</a></li>
                         <li><a href="/admin/agents">Agents</a></li>
                         <li><a href="/admin/profit-loss">Profit/Loss</a></li>
                         <li><button onClick={logout} className="btn btn-secondary">Logout</button></li>
                    </ul>
                </nav>
            </header>
            <main className="admin-main-content">
                <div className="card">
                    <h2 className="card-header">💸 Send Customer Cashout</h2>
                    <div className="card-body">
                      <form onSubmit={handleSubmit} className="form-grid">
                          <div className="form-group">
                              <label>Username</label>
                              <input type="text" className="input" value={username} onChange={(e) => setUsername(e.target.value)} required />
                          </div>
                          <div className="form-group">
                              <label>Lightning Invoice or Address</label>
                              <input type="text" className="input" value={destination} onChange={(e) => setDestination(e.target.value)} required />
                          </div>
                          <div className="form-group">
                              <label>Amount (USD)</label>
                              <input type="number" step="0.01" className="input" value={usdAmount} onChange={(e) => setUsdAmount(e.target.value)} required={isAmountless || isLnAddress} disabled={!isAmountless && !isLnAddress} />
                          </div>
                          <div className="form-group form-full-width">
                            {(isAmountless || isLnAddress) && liveQuote.sats > 0 && (
                                <div className="alert alert-info">
                                    You will send approx. <strong>{formatSats(liveQuote.sats)} sats</strong>.
                                </div>
                            )}
                            <button type="submit" className="btn btn-primary" disabled={isSending}>
                                {isSending ? 'Sending...' : '⚡ Send Cashout'}
                            </button>
                          </div>
                      </form>
                      {status.message && <div className={`alert alert-${status.type} mt-md`}>{status.message}</div>}
                    </div>
                </div>
                
                <section className="mt-xl">
                    <h2>Agent Cashout Requests</h2>
                    {agentCashoutsLoading ? <LoadingSkeleton /> : <DataTable columns={agentRequestColumns} data={agentCashouts} defaultSortField="requestedAt" />}
                </section>

                <section className="mt-xl">
                    <h2>Customer Cashout History</h2>
                    {historyLoading ? <LoadingSkeleton /> : <DataTable columns={customerHistoryColumns} data={history} defaultSortField="time" />}
                </section>
            </main>
        </div>
    );
}