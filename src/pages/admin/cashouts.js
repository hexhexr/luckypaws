// pages/admin/cashouts.js
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { db, auth as firebaseAuth } from '../../lib/firebaseClient';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, onSnapshot, collection, query, orderBy } from 'firebase/firestore';
import DataTable from '../../components/DataTable';

const formatSats = (sats) => sats ? new Intl.NumberFormat().format(sats) : '0';

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
    
    const [username, setUsername] = useState('');
    const [destination, setDestination] = useState('');
    const [usdAmount, setUsdAmount] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [status, setStatus] = useState({ message: '', type: '' });
    const [isAmountless, setIsAmountless] = useState(false);
    const [isLnAddress, setIsLnAddress] = useState(false);
    const [isDecoding, setIsDecoding] = useState(false);

    const [history, setHistory] = useState([]);
    const [agentCashouts, setAgentCashouts] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(true);
    const [agentCashoutsLoading, setAgentCashoutsLoading] = useState(true);
    
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
            if (user) {
                const userDocSnap = await getDoc(doc(db, 'users', user.uid));
                if (userDocSnap.exists() && userDocSnap.data()?.isAdmin) {
                    setIsAdmin(true);
                } else { router.replace('/admin'); }
            } else { router.replace('/admin'); }
            setAuthLoading(false);
        });
        return () => unsubscribe();
    }, [router]);

    const logout = useCallback(async () => {
        await firebaseAuth.signOut();
        router.push('/admin');
    }, [router]);

    useEffect(() => {
        if (!isAdmin) return;
        
        const historyQuery = query(collection(db, "cashouts"), orderBy("time", "desc"));
        const unsubHistory = onSnapshot(historyQuery, (snapshot) => {
            setHistory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setHistoryLoading(false);
        }, (err) => setStatus({ message: 'Failed to load cashout history.', type: 'error' }));

        // BUG FIX: The field name is 'requestedAt', not 'time'.
        const agentQuery = query(collection(db, "agentCashoutRequests"), orderBy("requestedAt", "desc"));
        const unsubAgent = onSnapshot(agentQuery, (snapshot) => {
            setAgentCashouts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setAgentCashoutsLoading(false);
        }, (err) => setStatus({ message: 'Failed to load agent requests.', type: 'error' }));

        return () => { unsubHistory(); unsubAgent(); };
    }, [isAdmin]);

    // Destination parser logic remains the same...
    useEffect(() => {
        const dest = destination.trim();
        setStatus({ message: '', type: '' });
        setUsdAmount('');
        setIsAmountless(false);
        setIsLnAddress(false);
        if (!dest) return;
        if (dest.includes('@')) {
             setIsLnAddress(true);
             setStatus({ message: 'Lightning Address detected. Enter USD amount.', type: 'info' });
             return;
        }
        if (dest.startsWith('lnbc')) {
            setIsDecoding(true);
            const decodeInvoice = async () => {
                try {
                    const token = await firebaseAuth.currentUser.getIdToken();
                    const res = await fetch('/api/decode', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                        body: JSON.stringify({ bolt11: dest }),
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.message || 'Decode failed');
                    const sats = data.amount;
                    if (sats > 0) {
                        // To estimate USD, we need a price. This is complex, so we just show sats.
                        setStatus({ message: `Fixed amount invoice detected: ${formatSats(sats)} sats. Enter this amount in USD equivalent to proceed.`, type: 'info' });
                    } else {
                        setIsAmountless(true);
                        setStatus({ message: 'Amountless invoice detected. Enter desired USD amount.', type: 'info' });
                    }
                } catch (e) {
                    setStatus({ message: `Invalid Lightning Invoice: ${e.message}`, type: 'error' });
                } finally { setIsDecoding(false); }
            };
            decodeInvoice();
        }
    }, [destination]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!window.confirm(`Confirm cashout for ${username} of $${usdAmount}?`)) return;
        setIsSending(true);
        setStatus({ message: 'Processing...', type: 'info' });
        try {
            const adminIdToken = await firebaseAuth.currentUser.getIdToken();
            const res = await fetch('/api/admin/cashouts/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminIdToken}` },
                body: JSON.stringify({ username, destination, usdAmount }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message);
            setStatus({ message: data.message, type: 'success' });
            setUsername(''); setDestination(''); setUsdAmount('');
        } catch (error) {
            setStatus({ message: `Error: ${error.message}`, type: 'error' });
        } finally { setIsSending(false); }
    };
    
    // NEW FEATURE: Handlers for approving/rejecting agent requests
    const handleRequestUpdate = async (requestId, newStatus) => {
        if (!window.confirm(`Are you sure you want to ${newStatus} this request?`)) return;
        try {
            const adminIdToken = await firebaseAuth.currentUser.getIdToken();
            const res = await fetch('/api/admin/agents/update-request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminIdToken}` },
                body: JSON.stringify({ requestId, status: newStatus }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message);
            setStatus({ message: `Request ${newStatus} successfully.`, type: 'success' });
        } catch (err) {
            setStatus({ message: `Error: ${err.message}`, type: 'error' });
        }
    };

    const customerHistoryColumns = useMemo(() => [
        { header: 'Time', accessor: 'time', sortable: true, cell: (row) => row.time?.toDate ? new Date(row.time.toDate()).toLocaleString() : new Date(row.time).toLocaleString() },
        { header: 'Username', accessor: 'username', sortable: true },
        { header: 'Amount (USD)', accessor: 'amountUSD', sortable: true, cell: (row) => `$${row.amountUSD?.toFixed(2)}` },
        { header: 'Status', accessor: 'status', sortable: true, cell: (row) => <span className={`status-badge status-${row.status}`}>{row.status}</span>},
        { header: 'Destination', accessor: 'destination', sortable: false, cell: (row) => <span title={row.destination}>{row.destination?.substring(0, 20)}...</span> },
    ], []);

    const agentRequestColumns = useMemo(() => [
        { header: 'Requested At', accessor: 'requestedAt', sortable: true, cell: (row) => row.requestedAt?.toDate().toLocaleString() },
        { header: 'Agent Name', accessor: 'agentName', sortable: true },
        { header: 'Amount', accessor: 'amount', sortable: true, cell: (row) => `$${row.amount?.toFixed(2)}` },
        { header: 'Status', accessor: 'status', sortable: true, cell: (row) => <span className={`status-badge status-${row.status}`}>{row.status}</span>},
        { header: 'Actions', accessor: 'actions', sortable: false, cell: (row) => (
             row.status === 'pending' && <div className="action-buttons">
                <button className="btn btn-success btn-xsmall" onClick={() => handleRequestUpdate(row.id, 'approved')}>Approve</button>
                <button className="btn btn-danger btn-xsmall" onClick={() => handleRequestUpdate(row.id, 'rejected')}>Reject</button>
            </div>
        )},
    ], []);

    if (authLoading) return <div className="loading-screen">Checking authentication...</div>;
    if (!isAdmin) return <div className="loading-screen">Access Denied.</div>;

    return (
        <div className="admin-dashboard-container">
            <Head><title>Admin - Cashouts</title></Head>
            <header className="admin-header"><h1>Lightning Cashouts</h1><nav><ul className="admin-nav">
                <li><a href="/admin/dashboard">Dashboard</a></li>
                <li><a href="/admin/cashouts" className="active">Cashouts</a></li>
                <li><a href="/admin/games">Games</a></li>
                <li><a href="/admin/agents">Agents</a></li>
                <li><a href="/admin/profit-loss">Profit/Loss</a></li>
                <li><button onClick={logout} className="btn btn-secondary">Logout</button></li>
            </ul></nav></header>
            <main className="admin-main-content">
                <div className="card">
                    <h2 className="card-header">💸 Send Customer Cashout</h2>
                    <div className="card-body">
                      <form onSubmit={handleSubmit} className="form-grid">
                          <div className="form-group"><label>Username</label><input type="text" className="input" value={username} onChange={(e) => setUsername(e.target.value)} required /></div>
                          <div className="form-group"><label>Lightning Invoice or Address</label><input type="text" className="input" value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="lnbc... or user@domain.com" required /></div>
                          <div className="form-group"><label>Amount (USD)</label><input type="number" step="0.01" min="0.01" className="input" value={usdAmount} onChange={(e) => setUsdAmount(e.target.value)} required placeholder="e.g., 10.50" disabled={isDecoding} /></div>
                          <div className="form-group form-full-width">
                            <button type="submit" className="btn btn-primary" disabled={isSending || isDecoding}>
                                {isDecoding ? 'Decoding Invoice...' : (isSending ? 'Sending...' : '⚡ Send Cashout')}
                            </button>
                          </div>
                      </form>
                      {status.message && <div className={`alert alert-${status.type} mt-md`}>{status.message}</div>}
                    </div>
                </div>
                
                <section className="card mt-xl">
                    <h2 className="card-header">Agent Cashout Requests</h2>
                    <div className="card-body">
                        {agentCashoutsLoading ? <LoadingSkeleton /> : <DataTable columns={agentRequestColumns} data={agentCashouts} defaultSortField="requestedAt" />}
                    </div>
                </section>

                <section className="card mt-xl">
                    <h2 className="card-header">Customer Cashout History</h2>
                     <div className="card-body">
                        {historyLoading ? <LoadingSkeleton /> : <DataTable columns={customerHistoryColumns} data={history} defaultSortField="time" />}
                    </div>
                </section>
            </main>
        </div>
    );
}