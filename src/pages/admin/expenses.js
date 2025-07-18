// File: src/pages/admin/expenses.js
// Description: The main UI page for managing all expenses.

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { db, auth as firebaseAuth } from '../../lib/firebaseClient';
import { onSnapshot, collection, query, orderBy, doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import DataTable from '../../components/DataTable';
import EditExpenseModal from '../../components/EditExpenseModal';

const formatCurrencyValue = (amount, currency) => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount)) return 'N/A';
    try {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency }).format(numAmount);
    } catch (e) {
        return `${currency} ${numAmount.toFixed(2)}`;
    }
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
    const [error, setError] = useState('');
    
    const [expenses, setExpenses] = useState([]);
    const [partners, setPartners] = useState([]);
    const [newExpense, setNewExpense] = useState({ 
        date: new Date().toISOString().split('T')[0], 
        category: 'General', 
        amount: '', 
        description: '',
        paidByPartnerId: '',
        currency: 'USD'
    });
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

        const expensesQuery = query(collection(db, "expenses"), orderBy("date", "desc"));
        const expensesUnsubscribe = onSnapshot(expensesQuery, (snapshot) => {
            const expenseData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setExpenses(expenseData);
        }, (err) => {
            setError("Failed to load expense data.");
        });

        const partnersQuery = query(collection(db, "partners"), orderBy("name"));
        const partnersUnsubscribe = onSnapshot(partnersQuery, (snapshot) => {
            setPartners(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        return () => {
            expensesUnsubscribe();
            partnersUnsubscribe();
        };
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
            setNewExpense({ date: new Date().toISOString().split('T')[0], category: 'General', amount: '', description: '', paidByPartnerId: '', currency: 'USD' });
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

    const handleDeleteExpense = useCallback(async (expenseId) => {
        if (window.confirm('Are you sure you want to permanently delete this expense? This action cannot be undone.')) {
            setIsSubmitting(true);
            setError('');
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
            } finally {
                setIsSubmitting(false);
            }
        }
    }, []);
    
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

    const totalsByCurrency = useMemo(() => {
        return filteredExpenses.reduce((acc, expense) => {
            const currency = expense.currency || 'USD';
            const amount = parseFloat(expense.amount || 0);
            if (!acc[currency]) {
                acc[currency] = 0;
            }
            acc[currency] += amount;
            return acc;
        }, {});
    }, [filteredExpenses]);

    const partnerExpenseTotals = useMemo(() => {
        const partnerTotals = {};
        filteredExpenses.forEach(expense => {
            if (expense.paidByPartnerId) {
                const partnerId = expense.paidByPartnerId;
                const currency = expense.currency || 'USD';
                const amount = parseFloat(expense.amount || 0);

                if (!partnerTotals[partnerId]) {
                    partnerTotals[partnerId] = { name: expense.paidByPartnerName, totals: {} };
                }
                if (!partnerTotals[partnerId].totals[currency]) {
                    partnerTotals[partnerId].totals[currency] = 0;
                }
                partnerTotals[partnerId].totals[currency] += amount;
            }
        });
        return Object.values(partnerTotals);
    }, [filteredExpenses]);

    const columns = useMemo(() => [
        { header: 'Date', accessor: 'date', sortable: true, cell: (row) => formatDate(row.date) },
        { header: 'Category', accessor: 'category', sortable: true },
        { header: 'Description', accessor: 'description', sortable: true },
        { header: 'Paid By', accessor: 'paidByPartnerName', sortable: true, cell: (row) => row.paidByPartnerName || 'Office' },
        { header: 'Amount', accessor: 'amount', sortable: true, cell: (row) => formatCurrencyValue(row.amount, row.currency || 'USD') },
        { header: 'Actions', accessor: 'actions', sortable: false, cell: (row) => (
            <div className="action-buttons">
                <button className="btn btn-info btn-small" onClick={() => handleEditExpense(row)}>Edit</button>
                <button className="btn btn-danger btn-small" onClick={() => handleDeleteExpense(row.id)}>Delete</button>
            </div>
        )}
    ], [handleDeleteExpense]);

    if (authLoading) return <div className="loading-screen">Authenticating...</div>;

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
                            <li><a href="/admin/partners">Partners</a></li>
                            <li><a href="/admin/cashouts">Cashouts</a></li>
                            <li><a href="/admin/games">Games</a></li>
                            <li><a href="/admin/agents">Personnel</a></li>
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
                            <form onSubmit={handleNewExpenseSubmit}>
                                <div className="expense-form-grid">
                                    <div className="form-group">
                                        <label>Paid By</label>
                                        <select name="paidByPartnerId" className="select" value={newExpense.paidByPartnerId} onChange={handleNewExpenseChange}>
                                            <option value="">Office Account</option>
                                            {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                        </select>
                                    </div>
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
                                        <label>Currency</label>
                                        <select name="currency" className="select" value={newExpense.currency} onChange={handleNewExpenseChange} required>
                                            <option value="USD">USD</option>
                                            <option value="PKR">PKR</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label>Amount</label>
                                        <input type="number" step="0.01" name="amount" className="input" value={newExpense.amount} onChange={handleNewExpenseChange} required placeholder="e.g., 150.75"/>
                                    </div>
                                    <div className="form-group expense-form-description">
                                        <label>Description</label>
                                        <textarea name="description" className="input" value={newExpense.description} onChange={handleNewExpenseChange} required placeholder="Provide a detailed description..." rows="4"></textarea>
                                    </div>
                                    <div className="form-group expense-form-submit">
                                        <button type="submit" className="btn btn-primary btn-full-width" disabled={isSubmitting}>{isSubmitting ? 'Saving...' : 'Add Expense'}</button>
                                    </div>
                                </div>
                            </form>
                        </div>
                    </section>

                    <section className="card mb-lg">
                        <div className="card-header">
                            <h2>Expense Log & Totals</h2>
                        </div>
                        <div className="card-body">
                             <div className="filter-controls">
                                <div className="form-group">
                                    <label>Filter From</label>
                                    <input type="date" className="input" value={startDate} onChange={e => setStartDate(e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label>Filter To</label>
                                    <input type="date" className="input" value={endDate} onChange={e => setEndDate(e.target.value)} />
                                </div>
                            </div>
                            <div className="stats-grid">
                                {Object.entries(totalsByCurrency).map(([currency, total]) => (
                                    <div key={currency} className="stat-card" style={{borderColor: 'var(--red-alert)'}}>
                                        <h4 className="stat-card-title">Total ({currency})</h4>
                                        <h2 className="stat-card-value">{formatCurrencyValue(total, currency)}</h2>
                                    </div>
                                ))}
                            </div>
                             {partnerExpenseTotals.length > 0 && (
                                <div className="mt-lg">
                                    <h4>Expenses by Partner</h4>
                                    {partnerExpenseTotals.map(partner => (
                                        <div key={partner.name} className="stat-card" style={{borderColor: 'var(--primary-blue)', marginBottom: '1rem'}}>
                                            <h4 className="stat-card-title">{partner.name}</h4>
                                            {Object.entries(partner.totals).map(([currency, total]) => (
                                                <h3 key={currency} className="stat-card-value" style={{fontSize: '1.5rem'}}>
                                                    {formatCurrencyValue(total, currency)}
                                                </h3>
                                            ))}
                                        </div>
                                    ))}
                                </div>
                            )}
                            {authLoading ? <LoadingSkeleton /> : <DataTable columns={columns} data={filteredExpenses} defaultSortField="date" />}
                        </div>
                    </section>
                </main>
            </div>
        </>
    );
}
