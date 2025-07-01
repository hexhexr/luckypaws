// src/components/UnifiedChatController.js
import React, { useState, useEffect } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../lib/firebaseClient';

import CustomerChat from './CustomerChat';
import AgentAdminChat from './AgentAdminChat';

export default function UnifiedChatController() {
    const [user, loading, error] = useAuthState(auth);
    const [role, setRole] = useState(null); // 'customer', 'agent', or 'admin'

    useEffect(() => {
        const determineRole = async () => {
            if (loading) {
                return; // Wait until auth state is fully resolved
            }

            // If there's no user, the CustomerChat component will show a login form.
            if (!user) {
                setRole('customer');
                return;
            }

            // For logged-in users, get their custom claims to determine their role.
            try {
                const tokenResult = await user.getIdTokenResult();
                if (tokenResult.claims.admin) {
                    setRole('admin');
                } else if (tokenResult.claims.agent) {
                    setRole('agent');
                } else {
                    // This path is taken by users who log in via the CustomerChat component.
                    setRole('customer');
                }
            } catch (e) {
                console.error("Could not get user claims, defaulting to customer role.", e);
                setRole('customer'); // Fallback to customer on any token error
            }
        };

        determineRole();
    }, [user, loading]);

    // Render nothing if there's an auth error or the role hasn't been determined yet.
    if (error || !role) {
        return null;
    }

    // Render the appropriate chat interface based on the user's role.
    if (role === 'agent' || role === 'admin') {
        return <AgentAdminChat user={user} userRole={role} />;
    } else {
        // This will render the CustomerChat component, which now contains its own login flow.
        return <CustomerChat />;
    }
}
