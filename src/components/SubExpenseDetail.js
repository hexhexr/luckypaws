// src/components/SubExpenseDetail.js
import React, { useState, useEffect } from 'react';
import { db, auth as firebaseAuth } from '../lib/firebaseClient';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import ImageViewerModal from './ImageViewerModal';

const formatCurrency = (amount, currency) => `$${parseFloat(amount || 0).toFixed(2)} ${currency || 'USD'}`;
const formatDate = (timestamp) => timestamp?.toDate ? timestamp.toDate().toLocaleDateString() : 'N/A';

export default function SubExpenseDetail({ expense, showAddForm, onFormSubmitSuccess }) {
    const [subExpenses, setSubExpenses] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [viewingReceipt, setViewingReceipt] = useState(null);
    
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
                console.error("Firebase Error:", err);
                setError("Failed to load sub-expenses. Ensure Firestore index is created.");
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
        // REMOVED: Validation that required a receipt
        setIsSubmitting(true);
        setError('');

        const formData = new FormData();
        formData.append('mainExpenseId', expense.id);
        formData.append('date', form.date);
        formData.append('amount', form.amount);
        formData.append('description', form.description);
        if (form.receipt) { // Only append receipt if it exists
            formData.append('receipt', form.receipt);
        }

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
            if (e.target) e.target.reset();
            if (onFormSubmitSuccess) onFormSubmitSuccess();
            
        } catch (err) {
            setError(err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
            {viewingReceipt && <ImageViewerModal imageUrl={viewingReceipt} onClose={() => setViewingReceipt(null)} />}

            <div className="sub-expense-container">
                {showAddForm && (
                    <div className="card sub-expense-form-card">
                        <div className="card-body">
                            <form onSubmit={handleSubmit}>
                                <div className="form-grid" style={{gridTemplateColumns: '1fr 1fr 2fr auto auto', alignItems: 'flex-end', gap: 'var(--spacing-md)'}}>
                                    <div className="form-group"><label>Date</label><input type="date" name="date" className="input" value={form.date} onChange={handleFormChange} required /></div>
                                    <div className="form-group"><label>Amount ({expense.currency})</label><input type="number" step="0.01" name="amount" className="input" value={form.amount} onChange={handleFormChange} required /></div>
                                    <div className="form-group"><label>Description</label><input type="text" name="description" className="input" value={form.description} onChange={handleFormChange} required /></div>
                                    {/* --- THIS IS THE CHANGE --- */}
                                    <div className="form-group"><label>Receipt (Optional)</label><input type="file" name="receipt" className="input" accept="image/*" onChange={handleFormChange} /></div>
                                    <button type="submit" className="btn btn-primary" disabled={isSubmitting}>{isSubmitting ? 'Saving...' : 'Save'}</button>
                                </div>
                                 {error && <div className="alert alert-danger mt-md">{error}</div>}
                            </form>
                        </div>
                    </div>
                )}

                <div className="sub-expense-log">
                    {isLoading ? <p>Loading details...</p> : subExpenses.length === 0 ? <p className="no-items-message">No sub-expenses recorded yet.</p> : (
                        <div className="table-responsive">
                            <table>
                                <thead><tr><th>Date</th><th>Description</th><th>Amount</th><th>Recorded By</th><th>Receipt</th></tr></thead>
                                <tbody>
                                    {subExpenses.map(se => (
                                        <tr key={se.id}>
                                            <td>{formatDate(se.date)}</td>
                                            <td>{se.description}</td>
                                            <td>{formatCurrency(se.amount, expense.currency)}</td>
                                            <td>{se.recordedBy}</td>
                                            <td>
                                                {se.receiptUrl ? (
                                                    <button onClick={() => setViewingReceipt(se.receiptUrl)} className="btn btn-secondary btn-xsmall">
                                                        View
                                                    </button>
                                                ) : 'N/A'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
                
                <style jsx>{`
                    .sub-expense-container {
                        padding: var(--spacing-md);
                        background-color: #e9ecef;
                    }
                    .sub-expense-form-card { margin-bottom: var(--spacing-md); }
                    .form-group { margin-bottom: 0; }
                    .no-items-message { color: var(--text-light); text-align: center; padding: var(--spacing-md); }
                `}</style>
            </div>
        </>
    );
}