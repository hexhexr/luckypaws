// src/pages/admin/expenses.js
import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { db, auth as firebaseAuth } from '../../lib/firebaseClient';
import { onSnapshot, collection, query, orderBy, addDoc, doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import DataTable from '../../components/DataTable';
import EditExpenseModal from '../../components/EditExpenseModal'; // Import the new modal

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

    // State for date filters and editing
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
            const end = endDate ? new Date(endDate) : null;
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

    if (authLoading) return <div className="loading-screen">Checking authentication...</div>;
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
                            {/* ... other nav links */}
                        </ul>
                    </nav>
                </header>
                <main className="admin-main-content">
                    {error && <div className="alert alert-danger mb-lg">{error}</div>}

                    <section className="card mb-lg">
                        <h2 className="card-header">Add New Expense</h2>
                        {/* ... add expense form ... */}
                    </section>

                    <section>
                        <h2>Expense Log</h2>
                        {/* ... date filter ... */}
                        
                        <div className="stat-card" style={{borderColor: 'var(--red-alert)', marginBottom: '1rem'}}>
                            <h4 className="stat-card-title">Total Displayed Expenses</h4>
                            <h2 className="stat-card-value">{formatCurrency(totalFilteredExpenses)}</h2>
                        </div>
                        {dataLoading ? <LoadingSkeleton /> : <DataTable columns={columns} data={filteredExpenses} defaultSortField="date" />}
                    </section>
                </main>
            </div>
        </>
    );
}