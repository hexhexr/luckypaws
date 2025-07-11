import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { db, auth as firebaseAuth } from '../../lib/firebaseClient';
import { doc, getDoc, collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import QRCodeLib from 'qrcode';

// Helper to format Sats
const formatSats = (sats) => new Intl.NumberFormat().format(sats);

// --- A simple modal component to display the QR code ---
const QRCodeModal = ({ invoice, onClose, onMarkAsPaid }) => {
    const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');

    useEffect(() => {
        if (invoice) {
            QRCodeLib.toDataURL(invoice, { width: 300, margin: 2, color: { dark: "#000", light: "#FFF" } })
                .then(setQrCodeDataUrl)
                .catch(err => console.error('Failed to generate QR code:', err));
        }
    }, [invoice]);

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
                <button onClick={onClose} className="modal-close-btn" aria-label="Close modal">&times;</button>
                <h2 className="modal-title">Scan to Pay</h2>
                <p style={{ color: 'var(--text-secondary)', marginTop: 0 }}>Scan with any Lightning Wallet on your phone.</p>
                <div className="qr-container" style={{ margin: '1rem 0' }}>
                    {qrCodeDataUrl ? <img src={qrCodeDataUrl} alt="Lightning Invoice QR Code" /> : <p>Loading QR Code...</p>}
                </div>
                <div style={{display: 'flex', gap: '1rem', marginTop: '1.5rem'}}>
                    <button onClick={onMarkAsPaid} className="btn btn-success" style={{width: '100%'}}>I Have Paid</button>
                    <button onClick={onClose} className="btn btn-secondary" style={{width: '100%'}}>Close</button>
                </div>
            </div>
        </div>
    );
};

export default function AdminCashouts() {
    const router = useRouter();

    const [authLoading, setAuthLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);

    // --- States for Direct Cashout Form (Preserved) ---
    const [username, setUsername] = useState('');
    const [destination, setDestination] = useState('');
    const [usdAmount, setUsdAmount] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [status, setStatus] = useState({ message: '', type: '' });
    const [isAmountless, setIsAmountless] = useState(false);
    const [isLnAddress, setIsLnAddress] = useState(false);
    const [liveQuote, setLiveQuote] = useState({ sats: 0, btcPrice: 0 });

    // --- States for Direct Cashout History (Preserved) ---
    const [history, setHistory] = useState([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(true);

    // --- States for Agent Cashout Requests (New) ---
    const [agentRequests, setAgentRequests] = useState([]);
    const [isLoadingAgentRequests, setIsLoadingAgentRequests] = useState(true);
    const [agentRequestError, setAgentRequestError] = useState('');
    const [selectedRequest, setSelectedRequest] = useState(null); // For the QR Code modal

    // --- Auth & Logout (Preserved) ---
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
                    console.error("Auth check error:", e);
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

    // --- Load Agent Cashout Requests (New) ---
    useEffect(() => {
        if (!isAdmin) return;
        setIsLoadingAgentRequests(true);
        const q = query(collection(db, 'agentCashoutRequests'), orderBy('requestedAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setAgentRequests(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
            setIsLoadingAgentRequests(false);
        }, (err) => {
            setAgentRequestError("Failed to load agent cashout requests.");
            setIsLoadingAgentRequests(false);
        });
        return () => unsubscribe();
    }, [isAdmin]);
    
    // --- Mark Agent Request as Paid Manually (New) ---
    const markRequestAsPaid = async (requestId) => {
        if (!requestId) return;
        try {
            const token = await firebaseAuth.currentUser.getIdToken();
            await fetch('/api/admin/cashouts/update-status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({
                    requestId: requestId,
                    paymentPreimage: 'N/A (Paid Manually via QR)',
                })
            });
            alert('Request marked as paid!');
            setSelectedRequest(null); // Close the modal
        } catch (error) {
            console.error("Failed to mark request as paid:", error);
            alert(`Failed to mark as paid: ${error.message}`);
        }
    };

    // --- Load Direct Cashout History (Preserved) ---
    const loadHistory = useCallback(async () => {
        setIsLoadingHistory(true);
        try {
            const adminIdToken = await firebaseAuth.currentUser.getIdToken();
            const res = await fetch('/api/admin/cashouts/history', {
                headers: { 'Authorization': `Bearer ${adminIdToken}` }
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || 'Failed to load');
            }
            const data = await res.json();
            setHistory(data.sort((a, b) => {
                const timeA = a.time?.seconds ? new Date(a.time.seconds * 1000) : new Date(a.time);
                const timeB = b.time?.seconds ? new Date(b.time.seconds * 1000) : new Date(b.time);
                return timeB - timeA;
            }));
        } catch (err) {
            setStatus({ message: 'Failed to load cashout history. ' + err.message, type: 'error' });
        } finally {
            setIsLoadingHistory(false);
        }
    }, []);

    useEffect(() => {
        if (isAdmin) {
            loadHistory();
            const interval = setInterval(loadHistory, 15000); // Refresh every 15s
            return () => clearInterval(interval);
        }
    }, [isAdmin, loadHistory]);

    // --- Real-time Price Quote Logic (Preserved with fix) ---
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
            if (res.ok) {
                setLiveQuote({ sats: data.sats, btcPrice: data.btcPrice });
            }
        } catch (error) {
            console.error("Quote fetch error:", error);
        }
    }, []);

    // --- Destination Parser Logic (Preserved) ---
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
                    const estimatedUsd = (sats / 100000000) * (liveQuote.btcPrice || 60000);
                    setUsdAmount(estimatedUsd.toFixed(2));
                    setIsAmountless(false);
                    setIsLnAddress(false);
                    setStatus({ message: `Fixed amount invoice detected: ${formatSats(sats)} sats.`, type: 'info' });
                } else {
                    setIsAmountless(true);
                    setStatus({ message: 'Amountless invoice detected. Please enter the USD amount.', type: 'info' });
                }
            } catch (e) {
                setStatus({ message: `Failed to decode invoice: ${e.message}. Please check the format.`, type: 'error' });
                setUsdAmount('');
                setIsAmountless(false);
            }
        } else if (dest.includes('@') && dest.split('@').length === 2 && dest.split('@')[1].includes('.')) {
            setIsLnAddress(true);
            setStatus({ message: 'Lightning Address detected. Please enter the USD amount.', type: 'info' });
        } else {
            setStatus({ message: 'Not a valid Bolt11 invoice (lnbc...) or Lightning Address (user@domain.com).', type: 'error' });
        }
    }, [destination, liveQuote.btcPrice]);

    // --- Handle amount change for live quote (Preserved) ---
    useEffect(() => {
        if (isAmountless || isLnAddress) {
            const handler = setTimeout(() => {
                if (parseFloat(usdAmount) > 0) {
                    fetchQuote(usdAmount);
                }
            }, 500); // Debounce
            return () => clearTimeout(handler);
        }
    }, [usdAmount, isAmountless, isLnAddress, fetchQuote]);

    // --- SUBMIT HANDLER FOR DIRECT CASHOUTS (Preserved) ---
    const handleSubmit = async (e) => {
        e.preventDefault();
        setStatus({ message: '', type: '' });
        if (!username || !destination) {
            setStatus({ message: 'Username and Destination are required.', type: 'error' });
            return;
        }
        if ((isAmountless || isLnAddress) && (!usdAmount || parseFloat(usdAmount) <= 0)) {
            setStatus({ message: 'A positive USD amount is required for this type of cashout.', type: 'error' });
            return;
        }
        const confirmMessage = `Are you sure you want to send a cashout for ${username}?`;
        if (!window.confirm(confirmMessage)) {
            setStatus({ message: 'Cashout cancelled.', type: 'info' });
            return;
        }
        setIsSending(true);
        setStatus({ message: 'Processing... Please do not close this window.', type: 'info' });
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
            setStatus({ message: `Success! ${data.details.amountSats ? formatSats(data.details.amountSats) : ''} sats sent. Tx ID: ${data.details.paymentGatewayId}`, type: 'success' });
            setUsername('');
            setDestination('');
            setUsdAmount('');
            loadHistory();
        } catch (error) {
            setStatus({ message: `Error: ${error.message}`, type: 'error' });
        } finally {
            setIsSending(false);
        }
    };

    if (authLoading) {
        return <div style={{ textAlign: 'center', marginTop: '50px' }}>Authenticating...</div>;
    }
    if (!isAdmin) {
        return <div style={{ textAlign: 'center', marginTop: '50px' }}>Access Denied.</div>;
    }

    return (
        <div className="admin-dashboard-container">
            {selectedRequest && (
                <QRCodeModal
                    invoice={selectedRequest.address}
                    onClose={() => setSelectedRequest(null)}
                    onMarkAsPaid={() => markRequestAsPaid(selectedRequest.id)}
                />
            )}
            <Head>
                <title>Admin - Cashouts</title>
            </Head>
            <header className="admin-header">
                <h1>Lightning Cashouts</h1>
                <nav>
                    <ul className="admin-nav">
                        <li><a href="/admin/dashboard">Dashboard</a></li>
                        <li><a href="/admin/cashouts" className="active">Cashouts</a></li>
                        <li><a href="/admin/games">Games</a></li>
	      <li><a href="/admin/expenses">Expenses</a></li>
                        <li><a href="/admin/agents">Agents</a></li>
                        <li><a href="/admin/profit-loss">Profit/Loss</a></li>
                        <li><button onClick={logout} className="btn btn-secondary">Logout</button></li>
                    </ul>
                </nav>
            </header>
            <main className="admin-main-content">
                <div className="card mb-lg">
                    <h3>Agent Cashout Requests</h3>
                    {agentRequestError && <div className="alert alert-danger">{agentRequestError}</div>}
                    {isLoadingAgentRequests ? <p>Loading agent requests...</p> : agentRequests.length === 0 ? <p>No pending agent requests.</p> : (
                        <div className="table-responsive">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Agent</th>
                                        <th>Username</th>
                                        <th>FB Name</th>
                                        <th>Amount</th>
                                        <th>Address</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {agentRequests.map((req) => (
                                        <tr key={req.id}>
                                            <td>{req.agentName}</td>
                                            <td>{req.username}</td>
                                            <td>{req.facebookName}</td>
                                            <td>${req.amount ? req.amount.toFixed(2) : '0.00'}</td>
                                            <td title={req.address}>{req.address ? req.address.substring(0, 25) + '...' : 'N/A'}</td>
                                            <td><span className={`status-badge status-${req.status}`}>{req.status}</span></td>
                                            <td>
                                                {req.status === 'pending' && (
                                                    <div className="action-buttons">
                                                        <button onClick={() => setSelectedRequest(req)} className="btn btn-success btn-small">Approve & Pay</button>
                                                        <button onClick={() => alert("Reject functionality to be implemented")} className="btn btn-danger btn-small">Reject</button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
                <div className="card">
                    <h3>💸 Send Direct Lightning Cashout</h3>
                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label>Username</label>
                            <input className="input" type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g., player123" required />
                        </div>
                        <div className="form-group">
                            <label>Lightning Invoice or Address</label>
                            <input className="input" type="text" value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Paste lnbc... invoice or user@example.com" required />
                        </div>
                        <div className="form-group">
                            <label>Amount (USD)</label>
                            <input className="input" type="number" step="0.01" min="0.01" value={usdAmount} onChange={(e) => setUsdAmount(e.target.value)} placeholder="e.g., 10.50" required={isAmountless || isLnAddress} disabled={!isAmountless && !isLnAddress} />
                        </div>
                        {(isAmountless || isLnAddress) && liveQuote.sats > 0 && (
                            <div className="alert alert-info">
                                You will send approximately <strong>{formatSats(liveQuote.sats)} sats</strong>.
                                <small> (Current Rate: ~${new Intl.NumberFormat().format(liveQuote.btcPrice)}/BTC)</small>
                            </div>
                        )}
                        <button type="submit" className="btn btn-success" disabled={isSending}>
                            {isSending ? 'Processing...' : '⚡ Send Cashout'}
                        </button>
                        {status.message && (
                            <p className={`alert ${status.type === 'success' ? 'alert-success' : status.type === 'error' ? 'alert-danger' : 'alert-info'} mt-md`}>
                                {status.message}
                            </p>
                        )}
                    </form>
                </div>
                <div className="card mt-lg">
                    <h3>💰 Lightning Cashout History</h3>
                    {isLoadingHistory ? <p>Loading history...</p> : history.length === 0 ? <p>No cashouts recorded yet.</p> : (
                        <div className="table-responsive">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Username</th>
                                        <th>Destination</th>
                                        <th>Amount</th>
                                        <th>Status</th>
                                        <th>Time</th>
                                        <th>Gateway ID</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {history.map((tx) => (
                                        <tr key={tx.id}>
                                            <td>{tx.username}</td>
                                            <td title={tx.destination}>{tx.destination ? tx.destination.substring(0, 25) + '...' : 'N/A'}</td>
                                            <td>{tx.amountUSD ? `$${tx.amountUSD.toFixed(2)}` : ''} ({tx.amountSats ? formatSats(tx.amountSats) + ' sats' : 'N/A'})</td>
                                            <td><span className={`status-badge status-${tx.status}`}>{tx.status}</span></td>
                                            <td>{tx.time?.seconds ? new Date(tx.time.seconds * 1000).toLocaleString() : new Date(tx.time).toLocaleString()}</td>
                                            <td>
                                                {tx.paymentGatewayId ? (
                                                    <a href={`https://mempool.space/tx/${tx.paymentGatewayId}`} target="_blank" rel="noopener noreferrer" title={tx.paymentGatewayId}>
                                                        {tx.paymentGatewayId.substring(0, 15)}...
                                                    </a>
                                                ) : 'N/A'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}