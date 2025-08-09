// src/components/SubExpenseSummary.js
import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebaseClient';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

const formatCurrency = (amount, currency) => `$${parseFloat(amount || 0).toFixed(2)} ${currency || 'USD'}`;

export default function SubExpenseSummary({ expense }) {
    const [summary, setSummary] = useState({ spent: 0, remaining: expense.amount });
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!expense || !expense.id) return;

        const q = query(
            collection(db, "subExpenses"), 
            where("mainExpenseId", "==", expense.id)
        );

        const unsubscribe = onSnapshot(q, 
            (snapshot) => {
                let totalSpent = 0;
                snapshot.forEach(doc => {
                    totalSpent += parseFloat(doc.data().amount || 0);
                });
                const remaining = parseFloat(expense.amount || 0) - totalSpent;
                setSummary({ spent: totalSpent, remaining: remaining });
                setIsLoading(false);
            },
            (err) => {
                console.error("Error fetching sub-expense summary:", err);
                setIsLoading(false);
            }
        );

        return () => unsubscribe();
    }, [expense]);

    if (isLoading) {
        return <div className="summary-loading">Loading summary...</div>;
    }

    return (
        <div className="sub-expense-summary">
            <div className="summary-item"><strong>Total Budget:</strong> {formatCurrency(expense.amount, expense.currency)}</div>
            <div className="summary-item"><strong>Amount Spent:</strong> {formatCurrency(summary.spent, expense.currency)}</div>
            <div className="summary-item"><strong>Remaining:</strong> {formatCurrency(summary.remaining, expense.currency)}</div>
            <style jsx>{`
                .sub-expense-summary {
                    display: flex;
                    gap: var(--spacing-lg);
                    padding: var(--spacing-sm) var(--spacing-md);
                    background: var(--bg-medium-light);
                    border-radius: var(--border-radius);
                    font-size: 0.9rem;
                }
                .summary-loading {
                    font-style: italic;
                    color: var(--text-light);
                    padding: var(--spacing-sm) var(--spacing-md);
                }
            `}</style>
        </div>
    );
}