// pages/admin/customer/[username].js
import { useRouter } from 'next/router';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { db, auth as firebaseAuth } from '../../../lib/firebaseClient';
import { collection, query, where, getDocs, orderBy, getDoc, doc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import Head from 'next/head';
import DataTable from '../../../components/DataTable';

// FIX: Add the robust timestamp formatting function to prevent crashes.
const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'N/A';
    // Handle Firestore Timestamp objects
    if (typeof timestamp.toDate === 'function') {
        return timestamp.toDate().toLocaleString();
    }
    // Handle ISO strings or other date formats
    try {
        const date = new Date(timestamp);
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
        <div className="skeleton-line" style={{ width: '90%' }}></div>
        <div className="skeleton-line" style={{ width: '95%' }}></div>
    </div>
);

export default function CustomerProfile() {
    const router = useRouter();
    const { username } = router.query;
    
    const [authLoading, setAuthLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    
    const [transactions, setTransactions] = useState([]);
    const [dataLoading, setDataLoading] = useState(true);
    const [totals, setTotals] = useState({ deposits: 0, cashouts: 0, net: 0 });
    
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
            if (user) {
                const userDoc = await getDoc(doc(db, 'users', user.uid));
                if (userDoc.exists() && userDoc.data().isAdmin) {
                    setIsAdmin(true);
                } else {
                    router.replace('/admin');
                }
            } else {
                router.replace('/admin');
            }
            setAuthLoading(false);
        });
        return () => unsubscribe();
    }, [router]);
    
    const loadUserData = useCallback(async () => {
        if (!username || !isAdmin) return;
        setDataLoading(true);
        
        try {
            // Fetch Deposits (Paid Orders)
            const depositsQuery = query(collection(db, 'orders'), where('username', '==', username), where('status', '==', 'paid'));
            const depositsSnap = await getDocs(depositsQuery);
            const userDeposits = depositsSnap.docs.map(doc => ({
                id: doc.id,
                type: 'Deposit',
                amount: parseFloat(doc.data().amount || 0),
                time: doc.data().created,
                game: doc.data().game || 'N/A'
            }));
            
            // Fetch Cashouts
            const cashoutsQuery = query(collection(db, 'cashouts'), where('username', '==', username), where('status', '==', 'completed'));
            const cashoutsSnap = await getDocs(cashoutsQuery);
            const userCashouts = cashoutsSnap.docs.map(doc => ({
                id: doc.id,
                type: 'Cashout',
                amount: -parseFloat(doc.data().amountUSD || 0), // Negative for cashouts
                time: doc.data().time,
                game: 'N/A'
            }));
            
            const allTrans = [...userDeposits, ...userCashouts];
            setTransactions(allTrans);

            const totalDeposits = userDeposits.reduce((sum, t) => sum + t.amount, 0);
            const totalCashouts = userCashouts.reduce((sum, t) => sum - t.amount, 0); // amount is already negative
            
            setTotals({
                deposits: totalDeposits,
                cashouts: totalCashouts,
                net: totalDeposits - totalCashouts
            });

        } catch (err) {
            console.error('Error loading user data:', err);
        } finally {
            setDataLoading(false);
        }
    }, [username, isAdmin]);
    
    useEffect(() => {
        loadUserData();
    }, [loadUserData]);
    
    const logout = async () => {
        await firebaseAuth.signOut();
        router.replace('/admin');
    };
    
    const columns = useMemo(() => [
        // FIX: Use the safe timestamp function in the data table cell.
        { header: 'Time', accessor: 'time', sortable: true, cell: (row) => formatTimestamp(row.time) },
        { header: 'Type', accessor: 'type', sortable: true, cell: (row) => (
            <span className={row.type === 'Deposit' ? 'text-success' : 'text-danger'}>{row.type}</span>
        )},
        { header: 'Amount (USD)', accessor: 'amount', sortable: true, cell: (row) => `$${row.amount.toFixed(2)}`},
        { header: 'Game', accessor: 'game', sortable: true },
    ], []);

    if (authLoading) return <div className="loading-screen">Authenticating...</div>
    if (!isAdmin) return <div className="loading-screen">Access Denied.</div>
    
    return (
        <div className="admin-dashboard-container">
            <Head><title>Customer Profile - {username}</title></Head>
            <header className="admin-header">
                <h1>Customer Profile: {username}</h1>
                <nav>
                    <ul className="admin-nav">
                        <li><a href="/admin/dashboard">Dashboard</a></li>
                        <li><a href="/admin/profit-loss">Profit/Loss</a></li>
                        <li><button onClick={logout} className="btn btn-secondary">Logout</button></li>
                    </ul>
                </nav>
            </header>
            
            <main className="admin-main-content">
                <section className="stats-grid">
                    <div className="stat-card" style={{borderColor: 'var(--primary-green)'}}>
                        <h4 className="stat-card-title">Total Deposits</h4>
                        <h2 className="stat-card-value">${totals.deposits.toFixed(2)}</h2>
                    </div>
                     <div className="stat-card" style={{borderColor: 'var(--red-alert)'}}>
                        <h4 className="stat-card-title">Total Cashouts</h4>
                        <h2 className="stat-card-value">${totals.cashouts.toFixed(2)}</h2>
                    </div>
                     <div className="stat-card" style={{borderColor: totals.net >= 0 ? 'var(--primary-blue)' : 'var(--orange)'}}>
                        <h4 className="stat-card-title">Net P/L</h4>
                        <h2 className="stat-card-value">${totals.net.toFixed(2)}</h2>
                    </div>
                </section>
                
                <section className="mt-xl">
                    <h2>Transaction History</h2>
                    {dataLoading ? <LoadingSkeleton /> : <DataTable columns={columns} data={transactions} defaultSortField="time"/>}
                </section>
                
                <div className="text-center mt-xl">
                    <button className="btn btn-secondary" onClick={() => router.back()}>
                        ← Back to Previous Page
                    </button>
                </div>
            </main>
        </div>
    );
}