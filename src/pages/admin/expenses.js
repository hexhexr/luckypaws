// File: src/pages/admin/expenses.js
// Description: The "Add New Expense" form is now collapsible to save space.

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { db, auth as firebaseAuth } from '../../lib/firebaseClient';
import { onSnapshot, collection, query, orderBy } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import DataTable from '../../components/DataTable';
import EditExpenseModal from '../../components/EditExpenseModal';
import SubExpenseDetail from '../../components/SubExpenseDetail';
import SubExpenseSummary from '../../components/SubExpenseSummary';
import ImageViewerModal from '../../components/ImageViewerModal';

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
        currency: 'USD',
        receipt: null,
        isFinalized: false
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [editingExpense, setEditingExpense] = useState(null);
    const [viewingReceipt, setViewingReceipt] = useState(null);
    const [showAddSubExpenseForms, setShowAddSubExpenseForms] = useState({});
    const [showAddExpenseForm, setShowAddExpenseForm] = useState(false); // State for collapsible form

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
            if (user) {
                try {
                    const idTokenResult = await user.getIdTokenResult(true);
                    if (idTokenResult.claims.admin) setIsAdmin(true);
                    else router.replace('/admin');
                } catch (e) { router.replace('/admin'); }
            } else { router.replace('/admin'); }
            setAuthLoading(false);
        });
        return () => unsubscribe();
    }, [router]);

    useEffect(() => {
        if (!isAdmin) return;
        const expensesQuery = query(collection(db, "expenses"), orderBy("date", "desc"));
        const expensesUnsubscribe = onSnapshot(expensesQuery, (snapshot) => {
            setExpenses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }, (err) => setError("Failed to load expense data."));

        const partnersQuery = query(collection(db, "partners"), orderBy("name"));
        const partnersUnsubscribe = onSnapshot(partnersQuery, (snapshot) => {
            setPartners(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        return () => { expensesUnsubscribe(); partnersUnsubscribe(); };
    }, [isAdmin]);

    const handleNewExpenseChange = (e) => {
        const { name, value, type, checked, files } = e.target;
        if (type === 'checkbox') {
            setNewExpense(prev => ({ ...prev, [name]: checked }));
        } else {
            setNewExpense(prev => ({ ...prev, [name]: files ? files[0] : value }));
        }
    };

    const handleNewExpenseSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError('');
        
        const formData = new FormData();
        Object.entries(newExpense).forEach(([key, value]) => {
            if (value) formData.append(key, value);
        });

        try {
            const adminIdToken = await firebaseAuth.currentUser.getIdToken(true);
            const res = await fetch('/api/admin/expenses/add', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${adminIdToken}` },
                body: formData
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message);
            
            setNewExpense({ date: new Date().toISOString().split('T')[0], category: 'General', amount: '', description: '', paidByPartnerId: '', currency: 'USD', receipt: null, isFinalized: false });
            if(e.target) e.target.reset();
            setShowAddExpenseForm(false); // Hide form after successful submission

        } catch (err) {
            setError(err.message);
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleEditExpense = (expense) => setEditingExpense(expense);

    const handleSaveExpense = async (updatedExpense, newReceipt) => {
        try {
            const adminIdToken = await firebaseAuth.currentUser.getIdToken(true);
            const formData = new FormData();
            
            for (const key in updatedExpense) {
                formData.append(key, updatedExpense[key]);
            }
            if (newReceipt) {
                formData.append('receipt', newReceipt);
            }

            const res = await fetch('/api/admin/expenses/update', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${adminIdToken}` },
                body: formData,
            });
            if (!res.ok) throw new Error((await res.json()).message);
            setEditingExpense(null);
        } catch (err) {
            setError(err.message);
        }
    };

    const handleDeleteExpense = useCallback(async (expenseId) => {
        if (window.confirm('Are you sure you want to permanently delete this expense?')) {
            try {
                const adminIdToken = await firebaseAuth.currentUser.getIdToken(true);
                const res = await fetch('/api/admin/expenses/delete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminIdToken}` },
                    body: JSON.stringify({ id: expenseId })
                });
                if (!res.ok) throw new Error((await res.json()).message);
            } catch (err) {
                setError(err.message);
            }
        }
    }, []);
    
    const logout = useCallback(() => { firebaseAuth.signOut().then(() => router.push('/admin')); }, [router]);

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
            acc[currency] = (acc[currency] || 0) + amount;
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

    const toggleAddSubExpenseForm = (expenseId) => {
        setShowAddSubExpenseForms(prev => ({ ...prev, [expenseId]: !prev[expenseId] }));
    };

    const columns = useMemo(() => [
        { header: 'Date', accessor: 'date', sortable: true, cell: (row) => formatDate(row.date) },
        { header: 'Category', accessor: 'category', sortable: true },
        { header: 'Description', accessor: 'description', sortable: true },
        { header: 'Paid By', accessor: 'paidByPartnerName', sortable: true, cell: (row) => row.paidByPartnerName || 'Office' },
        { header: 'Amount', accessor: 'amount', sortable: true, cell: (row) => formatCurrencyValue(row.amount, row.currency || 'USD') },
        { header: 'Status', accessor: 'isFinalized', sortable: true, cell: (row) => (
            row.isFinalized ? <span title="Finalized">🔒</span> : <span title="Open">✅</span>
        )},
        { header: 'Receipt', accessor: 'receiptUrl', sortable: false, cell: (row) => (
            row.receiptUrl ? 
            <button className="btn btn-secondary btn-xsmall" onClick={() => setViewingReceipt(row.receiptUrl)}>View</button> 
            : 'N/A'
        )},
        { header: 'Actions', accessor: 'actions', sortable: false, cell: (row) => (
            <div className="action-buttons">
                <button className="btn btn-success btn-small" onClick={() => toggleAddSubExpenseForm(row.id)} disabled={row.isFinalized}>
                    + Add
                </button>
                <button className="btn btn-info btn-small" onClick={() => handleEditExpense(row)}>Edit</button>
                <button className="btn btn-danger btn-small" onClick={() => handleDeleteExpense(row.id)}>Delete</button>
            </div>
        )}
    ], [handleDeleteExpense]);

    const renderRowSubComponent = useCallback(({ row }) => {
        if (row.original.isFinalized) {
            return null; // Don't render sub-component for finalized expenses
        }
        return (
            <td colSpan={columns.length} style={{ padding: '0', borderBottom: '2px solid var(--primary-blue)' }}>
                <SubExpenseSummary expense={row.original} />
                <SubExpenseDetail 
                    expense={row.original} 
                    showAddForm={!!showAddSubExpenseForms[row.original.id]}
                    onFormSubmitSuccess={() => toggleAddSubExpenseForm(row.original.id)}
                />
            </td>
        );
    }, [columns.length, showAddSubExpenseForms]);

    if (authLoading) return <div className="loading-screen">Authenticating...</div>;

    return (
        <>
            {editingExpense && <EditExpenseModal expense={editingExpense} onClose={() => setEditingExpense(null)} onSave={handleSaveExpense} />}
            {viewingReceipt && <ImageViewerModal imageUrl={viewingReceipt} onClose={() => setViewingReceipt(null)} />}
            
            <div className="admin-dashboard-container">
                <Head><title>Admin - Expenses</title></Head>
                <header className="admin-header">
                    <h1>Manage Expenses</h1>
                    <nav><ul className="admin-nav">
                        <li><a href="/admin/dashboard">Dashboard</a></li>
                        <li><a href="/admin/expenses">Expenses</a></li>
                        <li><a href="/admin/partners">Partners</a></li>
                        <li><a href="/admin/offers">Offers</a></li>
                        <li><a href="/admin/cashouts">Cashouts</a></li>
                        <li><a href="/admin/games">Games</a></li>
                        <li><a href="/admin/agents">Personnel</a></li>
                        <li><a href="/admin/profit-loss">Profit/Loss</a></li>
                        <li><button onClick={logout} className="btn btn-secondary">Logout</button></li>
                    </ul></nav>
                </header>
                <main className="admin-main-content">
                    {error && <div className="alert alert-danger mb-lg">{error}</div>}
                    
                    <div style={{ marginBottom: 'var(--spacing-md)' }}>
                        <button className="btn btn-primary" onClick={() => setShowAddExpenseForm(!showAddExpenseForm)}>
                            {showAddExpenseForm ? 'Hide Form' : 'Add New Expense'}
                        </button>
                    </div>

                    {showAddExpenseForm && (
                        <section className="card mb-md">
                            <h2 className="card-header">Add New Expense</h2>
                            <div className="card-body">
                                <form onSubmit={handleNewExpenseSubmit}>
                                    <div className="expense-form-grid">
                                        <div className="form-group"><label>Paid By</label><select name="paidByPartnerId" className="select" value={newExpense.paidByPartnerId} onChange={handleNewExpenseChange}><option value="">Office Account</option>{partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
                                        <div className="form-group"><label>Date</label><input type="date" name="date" className="input" value={newExpense.date} onChange={handleNewExpenseChange} required /></div>
                                        <div className="form-group"><label>Category</label><select name="category" className="select" value={newExpense.category} onChange={handleNewExpenseChange} required><option>General</option><option>Salary</option><option>Wages</option></select></div>
                                        <div className="form-group"><label>Currency</label><select name="currency" className="select" value={newExpense.currency} onChange={handleNewExpenseChange} required><option value="USD">USD</option><option value="PKR">PKR</option></select></div>
                                        <div className="form-group"><label>Amount</label><input type="number" step="0.01" name="amount" className="input" value={newExpense.amount} onChange={handleNewExpenseChange} required /></div>
                                        <div className="form-group"><label>Receipt (Optional)</label><input type="file" name="receipt" className="input" accept="image/*" onChange={handleNewExpenseChange} /></div>
                                        <div className="form-group expense-form-description"><label>Description</label><textarea name="description" className="input" value={newExpense.description} onChange={handleNewExpenseChange} required rows="2"></textarea></div>
                                        <div className="form-group"><label><input type="checkbox" name="isFinalized" checked={newExpense.isFinalized} onChange={handleNewExpenseChange} /> Finalize Expense</label></div>
                                        <div className="form-group expense-form-submit"><button type="submit" className="btn btn-primary btn-full-width" disabled={isSubmitting}>{isSubmitting ? 'Saving...' : 'Add Expense'}</button></div>
                                    </div>
                                </form>
                            </div>
                        </section>
                    )}
                    
                    <section className="card">
                        <h2 className="card-header">Expense Log & Summaries</h2>
                        <div className="card-body">
                            <div className="filter-controls">
                                <div className="form-group"><label>Filter From</label><input type="date" className="input" value={startDate} onChange={e => setStartDate(e.target.value)} /></div>
                                <div className="form-group"><label>Filter To</label><input type="date" className="input" value={endDate} onChange={e => setEndDate(e.target.value)} /></div>
                            </div>
                            
                            <h4 style={{ marginTop: 'var(--spacing-md)' }}>Total Expenses (by Currency)</h4>
                            <div className="stats-grid">
                                {Object.entries(totalsByCurrency).map(([currency, total]) => (
                                    <div key={currency} className="stat-card" style={{borderColor: 'var(--red-alert)'}}>
                                        <h4 className="stat-card-title">Total ({currency})</h4>
                                        <h2 className="stat-card-value">{formatCurrencyValue(total, currency)}</h2>
                                    </div>
                                ))}
                            </div>

                            {partnerExpenseTotals.length > 0 && (
                                <div className="mt-md">
                                    <h4>Expenses by Partner</h4>
                                    <div className="stats-grid">
                                        {partnerExpenseTotals.map(partner => (
                                            <div key={partner.name} className="stat-card" style={{borderColor: 'var(--primary-blue)'}}>
                                                <h4 className="stat-card-title">{partner.name}</h4>
                                                {Object.entries(partner.totals).map(([currency, total]) => (
                                                    <h3 key={currency} className="stat-card-value" style={{fontSize: '1.5rem'}}>
                                                        {formatCurrencyValue(total, currency)}
                                                    </h3>
                                                ))}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {authLoading ? <LoadingSkeleton /> : <DataTable columns={columns} data={filteredExpenses} defaultSortField="date" renderRowSubComponent={renderRowSubComponent} />}
                        </div>
                    </section>
                </main>
            </div>
        </>
    );
}