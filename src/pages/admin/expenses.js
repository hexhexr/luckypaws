// src/pages/admin/expenses.js
import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { db, auth as firebaseAuth } from '../../lib/firebaseClient';
import { onSnapshot, collection, query, orderBy, addDoc, doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import DataTable from '../../components/DataTable';
import EditExpenseModal from '../../components/EditExpenseModal';

const formatCurrency = (amount) => {
    const numAmount = parseFloat(amount);
    return isNaN(numAmount) ? '$0.00' : `$${numAmount.toFixed(2)}`;
};

const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    if (isNaN(date.getTime())) return 'Invalid Date';
    return date.toLocaleDateString();
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

    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [editingExpense, setEditingExpense] = useState(null);

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
                body: JSON.stringify({ ...newExpense, date: new Date(newExpense.date) })
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

    const handleEditExpense = (expense) => {
        setEditingExpense(expense);
    };

    const handleSaveExpense = async (updatedExpense) => {
        try {
            const adminIdToken = await firebaseAuth.currentUser.getIdToken(true);
            const res = await fetch('/api/admin/expenses/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminIdToken}` },
                body: JSON.stringify(updatedExpense)
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to save expense.');
            setEditingExpense(null);
            alert('Expense updated successfully!');
        } catch (err) {
            setError(err.message);
        }
    };

    const handleDeleteExpense = async (expenseId) => {
        if (window.confirm("Are you sure you want to delete this expense? This action cannot be undone.")) {
            try {
                const adminIdToken = await firebaseAuth.currentUser.getIdToken(true);
                const res = await fetch('/api/admin/expenses/delete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminIdToken}` },
                    body: JSON.stringify({ id: expenseId })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message || 'Failed to delete expense.');
                alert('Expense deleted successfully!');
            } catch (err) {
                setError(err.message);
            }
        }
    };
    
    const logout = useCallback(async () => {
        await firebaseAuth.signOut();
        router.push('/admin');
    }, [router]);

    const filteredExpenses = useMemo(() => {
        return expenses.filter(expense => {
            const expenseDate = expense.date.toDate ? expense.date.toDate() : new Date(expense.date);
            const start = startDate ? new Date(startDate) : null;
            if(start) start.setHours(0, 0, 0, 0);
            const end = endDate ? new Date(endDate) : null;
            if(end) end.setHours(23, 59, 59, 999);
            
            if (start && expenseDate < start) return false;
            if (end && expenseDate > end) return false;
            return true;
        });
    }, [expenses, startDate, endDate]);

    const totalFilteredExpenses = useMemo(() => {
        return filteredExpenses.reduce((sum, expense) => sum + parseFloat(expense.amount || 0), 0);
    }, [filteredExpenses]);

    const columns = useMemo(() => [
        { header: 'Date', accessor: 'date', sortable: true, cell: (row) => formatDate(row.date) },
        { header: 'Category', accessor: 'category', sortable: true },
        { header: 'Description', accessor: 'description', sortable: true },
        { header: 'Amount', accessor: 'amount', sortable: true, cell: (row) => formatCurrency(row.amount) },
        { header: 'Recorded By', accessor: 'recordedBy', sortable: true },
        { header: 'Actions', accessor: 'actions', sortable: false, cell: (row) => (
            <div className="action-buttons">
                <button className="btn btn-info btn-small" onClick={() => handleEditExpense(row)}>Edit</button>
                <button className="btn btn-danger btn-small" onClick={() => handleDeleteExpense(row.id)}>Delete</button>
            </div>
        )}
    ], []);

    if (authLoading) return <div className="loading-screen">Authenticating...</div>;
    if (!isAdmin) return <div className="loading-screen">Access Denied.</div>;

    return (
        <>
            {editingExpense && (
                <EditExpenseModal
                    expense={editingExpense}
                    onClose={() => setEditingExpense(null)}
                    onSave={handleSaveExpense}
                />
            )}
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
                    
                    <div className="expenses-layout">
                        <div className="expense-form-column">
                            <section className="card">
                                <h2 className="card-header">Add New Expense</h2>
                                <div className="card-body">
                                    <form onSubmit={handleNewExpenseSubmit}>
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
                                            <textarea name="description" className="input" value={newExpense.description} onChange={handleNewExpenseChange} required placeholder="e.g., Monthly office rent" rows="3"></textarea>
                                        </div>
                                        <button type="submit" className="btn btn-primary btn-full-width" disabled={isSubmitting}>{isSubmitting ? 'Adding...' : 'Add Expense'}</button>
                                    </form>
                                </div>
                            </section>
                        </div>
                        <div className="expense-log-column">
                             <section className="card mb-lg">
                                <h2 className="card-header">Filter Expenses</h2>
                                <div className="card-body">
                                    <div className="form-grid">
                                        <div className="form-group">
                                            <label>From</label>
                                            <input type="date" className="input" value={startDate} onChange={e => setStartDate(e.target.value)} />
                                        </div>
                                        <div className="form-group">
                                            <label>To</label>
                                            <input type="date" className="input" value={endDate} onChange={e => setEndDate(e.target.value)} />
                                        </div>
                                    </div>
                                </div>
                            </section>
                            <section>
                                <div className="stat-card" style={{borderColor: 'var(--red-alert)', marginBottom: '1rem'}}>
                                    <h4 className="stat-card-title">Total (Filtered)</h4>
                                    <h2 className="stat-card-value">{formatCurrency(totalFilteredExpenses)}</h2>
                                </div>
                                {dataLoading ? <LoadingSkeleton /> : <DataTable columns={columns} data={filteredExpenses} defaultSortField="date" />}
                            </section>
                        </div>
                    </div>
                </main>
            </div>
            <style jsx>{`
                .expenses-layout {
                    display: grid;
                    grid-template-columns: 350px 1fr;
                    gap: var(--spacing-lg);
                }
                @media (max-width: 992px) {
                    .expenses-layout {
                        grid-template-columns: 1fr;
                    }
                }
            `}</style>
        </>
    );
}