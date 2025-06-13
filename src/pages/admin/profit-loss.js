// pages/admin/profit-loss.js
import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { db, auth as firebaseAuth } from '../../lib/firebaseClient';
import { doc, getDoc, onSnapshot, collection, query, orderBy, addDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import DataTable from '../../components/DataTable';

const formatCurrency = (amount) => {
    const numAmount = parseFloat(amount);
    return isNaN(numAmount) ? '$0.00' : `$${numAmount.toFixed(2)}`;
};

const LoadingSkeleton = () => (
    <div className="loading-skeleton mt-md">
        {[...Array(5)].map((_, i) => <div key={i} className="skeleton-line" style={{ width: `${90 - i*5}%`}}></div>)}
    </div>
);

export default function AdminProfitLoss() {
    const router = useRouter();
    const [authLoading, setAuthLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const [dataLoading, setDataLoading] = useState(true);
    const [error, setError] = useState('');
    const [allTransactions, setAllTransactions] = useState([]);
    const [manualTx, setManualTx] = useState({ username: '', amount: '', description: '', type: 'cashout' });
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Corrected Authentication Check
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
            if (user) {
                // User is signed in, check if they are an admin.
                const userDocRef = doc(db, 'users', user.uid);
                const userDocSnap = await getDoc(userDocRef);
                if (userDocSnap.exists() && userDocSnap.data()?.isAdmin) {
                    // User is an admin, allow them to stay.
                    setIsAdmin(true);
                    setAuthLoading(false);
                } else {
                    // User is not an admin, redirect.
                    router.replace('/admin');
                }
            } else {
                // No user is signed in, redirect to login.
                router.replace('/admin');
            }
        });

        return () => unsubscribe(); // Cleanup listener on unmount
    }, [router]);


    // Data Fetching
    useEffect(() => {
        if (!isAdmin) return;
        setDataLoading(true);
        const q = query(collection(db, "profitLoss"), orderBy("time", "desc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setAllTransactions(data);
            setDataLoading(false);
        }, (err) => {
            setError("Failed to load profit/loss data.");
            setDataLoading(false);
        });
        return () => unsubscribe();
    }, [isAdmin]);

    const userProfitLossData = useMemo(() => {
        const userMap = {};
        allTransactions.forEach(t => {
            const username = t.username || 'Unknown';
            if (!userMap[username]) {
                userMap[username] = { username, totalDeposits: 0, totalCashout: 0, net: 0 };
            }
            const amount = parseFloat(t.amountUSD || t.amount || 0);
            if (t.type.includes('deposit')) {
                userMap[username].totalDeposits += amount;
            } else if (t.type.includes('cashout')) {
                userMap[username].totalCashout += amount;
            }
        });
        return Object.values(userMap).map(u => ({
            ...u,
            net: u.totalDeposits - u.totalCashout,
            profitMargin: u.totalDeposits > 0 ? (((u.totalDeposits - u.totalCashout) / u.totalDeposits) * 100).toFixed(2) : 0,
        }));
    }, [allTransactions]);

    const handleManualTxSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError('');
        try {
            const adminIdToken = await firebaseAuth.currentUser.getIdToken();
            const res = await fetch('/api/admin/cashouts/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminIdToken}` },
                body: JSON.stringify({
                    username: manualTx.username,
                    amount: manualTx.amount,
                    description: `Manual ${manualTx.type}: ${manualTx.description}`
                })
            });
            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.message || 'Failed to add transaction.');
            }
            setManualTx({ username: '', amount: '', description: '', type: 'cashout' });
            alert('Transaction added successfully!');
        } catch (err) {
            setError(err.message);
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const logout = useCallback(async () => {
        await firebaseAuth.signOut();
        router.push('/admin');
    }, [router]);

    const columns = useMemo(() => [
        { header: 'Username', accessor: 'username', sortable: true },
        { header: 'Total Deposits', accessor: 'totalDeposits', sortable: true, cell: (row) => formatCurrency(row.totalDeposits) },
        { header: 'Total Cashouts', accessor: 'totalCashout', sortable: true, cell: (row) => formatCurrency(row.totalCashout) },
        { header: 'Net P/L', accessor: 'net', sortable: true, cell: (row) => <span className={row.net >= 0 ? 'text-success' : 'text-danger'}>{formatCurrency(row.net)}</span> },
        { header: 'Profit Margin (%)', accessor: 'profitMargin', sortable: true, cell: (row) => `${row.profitMargin}%` },
        { header: 'Actions', accessor: 'actions', sortable: false, cell: (row) => <button className="btn btn-link" onClick={() => router.push(`/admin/customer/${row.username}`)}>View</button>}
    ], [router]);
    
    if (authLoading) return <div className="loading-screen">Checking authentication...</div>
    if (!isAdmin) return <div className="loading-screen">Access Denied.</div>;

    return (
        <div className="admin-dashboard-container">
            <Head><title>Admin - Profit/Loss</title></Head>
            <header className="admin-header">
                <h1>Profit & Loss</h1>
                <nav>
                    <ul className="admin-nav">
                        <li><a href="/admin/dashboard">Dashboard</a></li>
                        <li><a href="/admin/cashouts">Cashouts</a></li>
                        <li><a href="/admin/games">Games</a></li>
                        <li><a href="/admin/agents">Agents</a></li>
                        <li><a href="/admin/profit-loss" className="active">Profit/Loss</a></li>
                        <li><button onClick={logout} className="btn btn-secondary">Logout</button></li>
                    </ul>
                </nav>
            </header>
            <main className="admin-main-content">
                {error && <div className="alert alert-danger mb-lg">{error}</div>}

                <section className="card mb-lg">
                    <h2 className="card-header">Add Manual Transaction</h2>
                    <div className="card-body">
                        <form onSubmit={handleManualTxSubmit} className="form-grid">
                            <div className="form-group">
                                <label>Username</label>
                                <input type="text" className="input" value={manualTx.username} onChange={e => setManualTx({...manualTx, username: e.target.value})} required />
                            </div>
                            <div className="form-group">
                                <label>Amount (USD)</label>
                                <input type="number" step="0.01" className="input" value={manualTx.amount} onChange={e => setManualTx({...manualTx, amount: e.target.value})} required />
                            </div>
                             <div className="form-group">
                                <label>Description</label>
                                <input type="text" className="input" value={manualTx.description} onChange={e => setManualTx({...manualTx, description: e.target.value})} />
                            </div>
                            <div className="form-group form-full-width">
                                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>{isSubmitting ? 'Adding...' : 'Add Transaction'}</button>
                            </div>
                        </form>
                    </div>
                </section>

                <section>
                    <h2>User Profit/Loss Overview</h2>
                    {dataLoading ? <LoadingSkeleton /> : <DataTable columns={columns} data={userProfitLossData} defaultSortField="net" />}
                </section>
            </main>
        </div>
    );
}