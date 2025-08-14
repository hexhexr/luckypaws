// src/components/EditSubExpenseModal.js
import React, { useState, useEffect } from 'react';

export default function EditSubExpenseModal({ subExpense, onClose, onSave }) {
    const [formData, setFormData] = useState(subExpense);

    useEffect(() => {
        const date = subExpense.date.toDate ? subExpense.date.toDate() : new Date(subExpense.date);
        setFormData({
            ...subExpense,
            date: date.toISOString().split('T')[0],
        });
    }, [subExpense]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = (e) => {
        e.preventDefault();
        onSave(formData);
    };

    if (!subExpense) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
                <button onClick={onClose} className="modal-close-btn">&times;</button>
                <h2 className="modal-title">Edit Sub-Expense</h2>
                <form onSubmit={handleSave}>
                    <div className="form-group">
                        <label>Date</label>
                        <input type="date" name="date" className="input" value={formData.date} onChange={handleChange} required />
                    </div>
                    <div className="form-group">
                        <label>Amount</label>
                        <input type="number" step="0.01" name="amount" className="input" value={formData.amount} onChange={handleChange} required />
                    </div>
                    <div className="form-group">
                        <label>Description</label>
                        <input type="text" name="description" className="input" value={formData.description} onChange={handleChange} required />
                    </div>
                    <div className="modal-actions">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary">Save Changes</button>
                    </div>
                </form>
            </div>
        </div>
    );
}