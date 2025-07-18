// File: src/components/EditExpenseModal.js
// Description: The modal component for editing an expense, now with a currency field.

import React, { useState, useEffect } from 'react';

export default function EditExpenseModal({ expense, onClose, onSave }) {
    const [formData, setFormData] = useState(expense);

    useEffect(() => {
        const date = expense.date.toDate ? expense.date.toDate() : new Date(expense.date);
        setFormData({
            ...expense,
            date: date.toISOString().split('T')[0],
            currency: expense.currency || 'USD' // Default to USD if not set
        });
    }, [expense]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = (e) => {
        e.preventDefault();
        onSave(formData);
    };

    if (!expense) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
                <button onClick={onClose} className="modal-close-btn">&times;</button>
                <h2 className="modal-title">Edit Expense</h2>
                <form onSubmit={handleSave}>
                    <div className="form-group">
                        <label>Date</label>
                        <input type="date" name="date" className="input" value={formData.date} onChange={handleChange} required />
                    </div>
                    <div className="form-group">
                        <label>Category</label>
                        <select name="category" className="select" value={formData.category} onChange={handleChange} required>
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
                        <select name="currency" className="select" value={formData.currency} onChange={handleChange} required>
                            <option value="USD">USD</option>
                            <option value="PKR">PKR</option>
                        </select>
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
