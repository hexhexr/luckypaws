// src/components/ToastNotification.js
import React, { useEffect } from 'react';

export default function ToastNotification({ notification, onDone }) {
    useEffect(() => {
        if (notification) {
            const timer = setTimeout(() => {
                onDone();
            }, 5000); // Notification disappears after 5 seconds
            return () => clearTimeout(timer);
        }
    }, [notification, onDone]);

    if (!notification) return null;

    return (
        <div className={`toast-notification ${notification.type}`}>
            <div className="toast-icon">
                {notification.type === 'success' && '✅'}
                {notification.type === 'warning' && '⚠️'}
            </div>
            <div className="toast-content">
                <p className="toast-title">{notification.title}</p>
                <p className="toast-message">{notification.message}</p>
            </div>
            <button className="toast-close-btn" onClick={onDone}>&times;</button>
        </div>
    );
}