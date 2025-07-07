// src/pages/admin/expenses.js
import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { db, auth as firebaseAuth } from '../../lib/firebaseClient';
import { onSnapshot, collection, query, orderBy, addDoc, doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import DataTable from '../../components/DataTable';

const formatCurrency = (amount) => {
    const numAmount = parseFloat(amount);
    return isNaN(numAmount) ? '$0.00' : `$${numAmount.toFixed(2)}`;
};

// Helper function to format date from Firestore Timestamp
const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    if (timestamp.toDate) { // Check if it's a Firestore Timestamp
        return timestamp.toDate().toLocaleDateString();
    }
    // Fallback for strings
    try {
        const date = new Date(timestamp);
        if (isNaN(date.getTime())) return 'Invalid Date';
        return date.toLocaleDateString();
    } catch(e) {
        return "N/A";
    }
};

const LoadingSkeleton = () => (
    <div className="loading-skeleton mt-md">
        {[...Array(5)].map((_, i) => <div key={i} className="skeleton-line" style={{ width: `${90 - i*5}%`}}></div>)}
    </div>
);

export default function AdminExpenses() {
    const router = useRouter();
    const [authLoading, setAuthLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const [dataLoading, setDataLoading] = useState(true);
    const [error, setError] = useState('');
    
    const [expenses, setExpenses] = useState([]);
    const [newExpense, setNewExpense] = useState({ date: new Date().toISOString().split('T')[0], category: 'General', amount: '', description: '' });
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
            if (user) {
                const userDocRef = doc(db, 'users', user.uid);
                const userDocSnap = await getDoc(userDocRef);
                if (userDocSnap.exists() && userDocSnap.data()?.isAdmin) {
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

    useEffect(() => {
        if (!isAdmin) return;
        setDataLoading(true);

        const expensesQuery = query(collection(db, "expenses"), orderBy("date", "desc"));
        const unsubscribe = onSnapshot(expensesQuery, (snapshot) => {
            setExpenses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setDataLoading(false);
        }, (err) => {
            setError("Failed to load expense data.");
            setDataLoading(false);
        });

        return () => unsubscribe();
    }, [isAdmin]);

    const handleNewExpenseChange = (e) => {
        const { name, value } = e.target;
        setNewExpense(prev => ({ ...prev, [name]: value }));
    };

    const handleNewExpenseSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError('');
        try {
            const adminIdToken = await firebaseAuth.currentUser.getIdToken(true);
            const res = await fetch('/api/admin/expenses/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminIdToken}` },
                body: JSON.stringify(newExpense)
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to add expense.');
            setNewExpense({ date: new Date().toISOString().split('T')[0], category: 'General', amount: '', description: '' });
            alert('Expense added successfully!');
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
        { header: 'Date', accessor: 'date', sortable: true, cell: (row) => formatDate(row.date) },
        { header: 'Category', accessor: 'category', sortable: true },
        { header: 'Description', accessor: 'description', sortable: true },
        { header: 'Amount', accessor: 'amount', sortable: true, cell: (row) => formatCurrency(row.amount) },
        { header: 'Recorded By', accessor: 'recordedBy', sortable: true },
    ], []);

    const totalExpenses = useMemo(() => {
        return expenses.reduce((sum, expense) => sum + parseFloat(expense.amount || 0), 0);
    }, [expenses]);
    
    if (authLoading) return <div className="loading-screen">Checking authentication...</div>;
    if (!isAdmin) return <div className="loading-screen">Access Denied.</div>;

    return (
        <div className="admin-dashboard-container">
            <Head><title>Admin - Expenses</title></Head>
            <header className="admin-header">
                <h1>Manage Expenses</h1>
                <nav>
                    <ul className="admin-nav">
                        <li><a href="/admin/dashboard">Dashboard</a></li>
                        <li><a href="/admin/expenses" className="active">Expenses</a></li>
                        <li><a href="/admin/cashouts">Cashouts</a></li>
                        <li><a href="/admin/games">Games</a></li>
                        <li><a href="/admin/agents">Agents</a></li>
                        <li><a href="/admin/profit-loss">Profit/Loss</a></li>
                        <li><button onClick={logout} className="btn btn-secondary">Logout</button></li>
                    </ul>
                </nav>
            </header>
            <main className="admin-main-content">
                {error && <div className="alert alert-danger mb-lg">{error}</div>}

                <section className="card mb-lg">
                    <h2 className="card-header">Add New Expense</h2>
                    <div className="card-body">
                        <form onSubmit={handleNewExpenseSubmit} className="form-grid">
                            <div className="form-group">
                                <label>Date</label>
                                <input type="date" name="date" className="input" value={newExpense.date} onChange={handleNewExpenseChange} required />
                            </div>
                            <div className="form-group">
                                <label>Category</label>
                                <select name="category" className="select" value={newExpense.category} onChange={handleNewExpenseChange} required>
                                    <option>General</option>
                                    <option>Salary</option>
                                    <option>Wages</option>
                                    <option>Office Supplies</option>
                                    <option>Rent</option>
                                    <option>Utilities</option>
                                    <option>Marketing</option>
                                    <option>Other</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Amount (USD)</label>
                                <input type="number" step="0.01" name="amount" className="input" value={newExpense.amount} onChange={handleNewExpenseChange} required placeholder="e.g., 150.75"/>
                            </div>
                             <div className="form-group">
                                <label>Description</label>
                                <input type="text" name="description" className="input" value={newExpense.description} onChange={handleNewExpenseChange} required placeholder="e.g., Monthly office rent"/>
                            </div>
                            <div className="form-group form-full-width">
                                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>{isSubmitting ? 'Adding...' : 'Add Expense'}</button>
                            </div>
                        </form>
                    </div>
                </section>

                <section>
                    <h2>Expense Log</h2>
                    <div className="stat-card" style={{borderColor: 'var(--red-alert)', marginBottom: '1rem'}}>
                        <h4 className="stat-card-title">Total Expenses</h4>
                        <h2 className="stat-card-value">{formatCurrency(totalExpenses)}</h2>
                    </div>
                    {dataLoading ? <LoadingSkeleton /> : <DataTable columns={columns} data={expenses} defaultSortField="date" />}
                </section>
            </main>
        </div>
    );
}