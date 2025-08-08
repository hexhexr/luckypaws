// src/components/SubExpenseModal.js
import React from 'react';
import { useState, useEffect } from 'react';
import { db, auth as firebaseAuth } from '../lib/firebaseClient';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';

const formatCurrency = (amount, currency) => `$${parseFloat(amount || 0).toFixed(2)} ${currency}`;
const formatDate = (timestamp) => timestamp?.toDate ? timestamp.toDate().toLocaleDateString() : 'N/A';

export default function SubExpenseModal({ expense, onClose }) {
    const [subExpenses, setSubExpenses] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const [form, setForm] = useState({
        date: new Date().toISOString().split('T')[0],
        amount: '',
        description: '',
        receipt: null,
    });
    
    useEffect(() => {
        if (!expense) return;
        setIsLoading(true);
        const q = query(
            collection(db, "subExpenses"), 
            where("mainExpenseId", "==", expense.id), 
            orderBy("date", "desc")
        );
        const unsubscribe = onSnapshot(q, 
            (snapshot) => {
                setSubExpenses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
                setIsLoading(false);
            },
            (err) => {
                setError("Failed to load sub-expenses.");
                setIsLoading(false);
            }
        );
        return () => unsubscribe();
    }, [expense]);

    const handleFormChange = (e) => {
        const { name, value, files } = e.target;
        setForm(prev => ({ ...prev, [name]: files ? files[0] : value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.receipt) {
            setError("A receipt image is required.");
            return;
        }
        setIsSubmitting(true);
        setError('');

        const formData = new FormData();
        formData.append('mainExpenseId', expense.id);
        formData.append('date', form.date);
        formData.append('amount', form.amount);
        formData.append('description', form.description);
        formData.append('receipt', form.receipt);

        try {
            const token = await firebaseAuth.currentUser.getIdToken();
            const res = await fetch('/api/admin/expenses/add-sub-expense', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData,
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message);
            
            setForm({ date: new Date().toISOString().split('T')[0], amount: '', description: '', receipt: null });
            e.target.reset(); // Clear the file input
            
        } catch (err) {
            setError(err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const totalSubExpense = subExpenses.reduce((sum, se) => sum + parseFloat(se.amount || 0), 0);
    const remainingBudget = parseFloat(expense.amount || 0) - totalSubExpense;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" style={{width: '800px', maxWidth: '90%'}} onClick={(e) => e.stopPropagation()}>
                <button onClick={onClose} className="modal-close-btn">&times;</button>
                <h2 className="modal-title">Expense Details: {expense.description}</h2>
                
                <div className="stats-grid" style={{gridTemplateColumns: '1fr 1fr 1fr'}}>
                    <div className="stat-card" style={{borderColor: 'var(--primary-blue)'}}><h4 className="stat-card-title">Total Budget</h4><h2 className="stat-card-value">{formatCurrency(expense.amount, expense.currency)}</h2></div>
                    <div className="stat-card" style={{borderColor: 'var(--orange)'}}><h4 className="stat-card-title">Amount Spent</h4><h2 className="stat-card-value">{formatCurrency(totalSubExpense, expense.currency)}</h2></div>
                    <div className="stat-card" style={{borderColor: 'var(--primary-green)'}}><h4 className="stat-card-title">Remaining</h4><h2 className="stat-card-value">{formatCurrency(remainingBudget, expense.currency)}</h2></div>
                </div>

                <div className="form-grid" style={{alignItems: 'start', marginTop: 'var(--spacing-lg)'}}>
                    <div className="card">
                        <h3 className="card-header">Add Sub-Expense</h3>
                        <div className="card-body">
                            <form onSubmit={handleSubmit}>
                                <div className="form-group"><label>Date</label><input type="date" name="date" className="input" value={form.date} onChange={handleFormChange} required /></div>
                                <div className="form-group"><label>Amount ({expense.currency})</label><input type="number" step="0.01" name="amount" className="input" value={form.amount} onChange={handleFormChange} required /></div>
                                <div className="form-group"><label>Description</label><input type="text" name="description" className="input" value={form.description} onChange={handleFormChange} required /></div>
                                <div className="form-group"><label>Receipt Image</label><input type="file" name="receipt" className="input" accept="image/*" onChange={handleFormChange} required /></div>
                                <button type="submit" className="btn btn-primary btn-full-width" disabled={isSubmitting}>{isSubmitting ? 'Saving...' : 'Add Detail'}</button>
                                {error && <div className="alert alert-danger mt-md">{error}</div>}
                            </form>
                        </div>
                    </div>

                    <div className="card">
                        <h3 className="card-header">Transaction Log</h3>
                        <div className="card-body" style={{maxHeight: '400px', overflowY: 'auto'}}>
                            {isLoading ? <p>Loading...</p> : subExpenses.length === 0 ? <p>No sub-expenses recorded yet.</p> : (
                                <table>
                                    <thead><tr><th>Date</th><th>Description</th><th>Amount</th><th>Receipt</th></tr></thead>
                                    <tbody>
                                        {subExpenses.map(se => (
                                            <tr key={se.id}>
                                                <td>{formatDate(se.date)}</td>
                                                <td>{se.description}</td>
                                                <td>{formatCurrency(se.amount, expense.currency)}</td>
                                                <td><a href={se.receiptUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-xsmall">View</a></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}