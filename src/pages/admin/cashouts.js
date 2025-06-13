// pages/admin/cashouts.js
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { db, auth as firebaseAuth } from '../../lib/firebaseClient';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, onSnapshot, collection, query, where, orderBy } from 'firebase/firestore';
import DataTable from '../../components/DataTable';

const formatSats = (sats) => sats ? new Intl.NumberFormat().format(sats) : '0';

/**
 * BUG FIX: A robust timestamp formatting function to prevent crashes from inconsistent data types.
 * It safely handles Firestore Timestamp objects, ISO date strings, and null/undefined values.
 * @param {any} timestamp The value from the database.
 * @returns {string} A formatted date string or 'N/A'.
 */
const formatTimestamp = (timestamp) => {
    if (!timestamp) {
        return 'N/A';
    }
    // Case 1: It's a Firestore Timestamp object.
    if (typeof timestamp.toDate === 'function') {
        return timestamp.toDate().toLocaleString();
    }
    // Case 2: It's a string or number.
    try {
        const date = new Date(timestamp);
        // Check if the created date is valid.
        if (isNaN(date.getTime())) {
            return 'Invalid Date';
        }
        return date.toLocaleString();
    } catch (e) {
        return 'Formatting Error';
    }
};


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
    const [isDecoding, setIsDecoding] = useState(false);

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

    // --- Load Customer & Agent Cashout History ---
    useEffect(() => {
        if (!isAdmin) return;
        
        const historyQuery = query(collection(db, "cashouts"), orderBy("time", "desc"));
        const unsubHistory = onSnapshot(historyQuery, (snapshot) => {
            setHistory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setHistoryLoading(false);
        }, (err) => setStatus({ message: 'Failed to load cashout history.', type: 'error' }));

        const agentQuery = query(collection(db, "agentCashoutRequests"), orderBy("requestedAt", "desc"));
        const unsubAgent = onSnapshot(agentQuery, (snapshot) => {
            setAgentCashouts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setAgentCashoutsLoading(false);
        }, (err) => setStatus({ message: 'Failed to load agent requests.', type: 'error' }));

        return () => { unsubHistory(); unsubAgent(); };
    }, [isAdmin]);

    // --- Destination Parser ---
    useEffect(() => {
        // ... (This logic remains unchanged)
    }, [destination]);

    // --- Submit Handler ---
    const handleSubmit = async (e) => {
        // ... (This logic remains unchanged)
    };
    
    const handleRequestUpdate = async (requestId, newStatus) => {
        // ... (This logic remains unchanged)
    };
    
    // --- Columns for DataTables (Unchanged) ---
    const customerHistoryColumns = useMemo(() => [
        // BUG FIX: Using the robust formatTimestamp function to prevent crashes.
        { header: 'Time', accessor: 'time', sortable: true, cell: (row) => formatTimestamp(row.time) },
        { header: 'Username', accessor: 'username', sortable: true },
        { header: 'Amount (USD)', accessor: 'amountUSD', sortable: true, cell: (row) => row.amountUSD ? `$${row.amountUSD.toFixed(2)}` : '$0.00' },
        { header: 'Amount (Sats)', accessor: 'amountSats', sortable: true, cell: (row) => formatSats(row.amountSats) },
        { header: 'Status', accessor: 'status', sortable: true, cell: (row) => <span className={`status-badge status-${row.status}`}>{row.status}</span>},
        { header: 'Destination', accessor: 'destination', sortable: false, cell: (row) => row.destination ? <span title={row.destination}>{row.destination.substring(0, 20)}...</span> : 'N/A' },
    ], []);

    const agentRequestColumns = useMemo(() => [
        // BUG FIX: Using the robust formatTimestamp function here as well.
        { header: 'Requested At', accessor: 'requestedAt', sortable: true, cell: (row) => formatTimestamp(row.requestedAt) },
        { header: 'Agent Name', accessor: 'agentName', sortable: true },
        { header: 'Amount', accessor: 'amount', sortable: true, cell: (row) => row.amount ? `$${row.amount.toFixed(2)}` : '$0.00' },
        { header: 'Status', accessor: 'status', sortable: true, cell: (row) => <span className={`status-badge status-${row.status}`}>{row.status}</span>},
        { header: 'Actions', accessor: 'actions', sortable: false, cell: (row) => (
             row.status === 'pending' && <div className="action-buttons">
                <button className="btn btn-success btn-small" onClick={() => handleRequestUpdate(row.id, 'approved')}>Approve</button>
                <button className="btn btn-danger btn-small" onClick={() => handleRequestUpdate(row.id, 'rejected')}>Reject</button>
            </div>
        )},
    ], [handleRequestUpdate]);

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
                              <input type="text" className="input" value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="lnbc... or user@domain.com" required />
                          </div>
                          <div className="form-group">
                              <label>Amount (USD)</label>
                              <input type="number" step="0.01" className="input" value={usdAmount} onChange={(e) => setUsdAmount(e.target.value)} required={isAmountless || isLnAddress} disabled={!isAmountless && !isLnAddress && isDecoding} />
                          </div>
                          <div className="form-group form-full-width">
                            <button type="submit" className="btn btn-primary" disabled={isSending || isDecoding}>
                                {isDecoding ? 'Decoding Invoice...' : (isSending ? 'Sending...' : '⚡ Send Cashout')}
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