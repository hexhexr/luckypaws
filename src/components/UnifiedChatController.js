import React, { useState, useEffect } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { signInAnonymously } from 'firebase/auth';
import { auth } from '../lib/firebaseClient';

import CustomerChat from './CustomerChat';
import AgentAdminChat from './AgentAdminChat';

export default function UnifiedChatController() {
    const [user, loading, error] = useAuthState(auth);
    const [role, setRole] = useState(null); // 'customer', 'agent', or 'admin'

    useEffect(() => {
        const determineRole = async () => {
            // Wait until the authentication state is fully resolved.
            // This is the key fix for the race condition.
            if (loading) {
                return;
            }

            if (!user) {
                // If there's no user, it's a new session. Attempt anonymous sign-in.
                try {
                    await signInAnonymously(auth);
                    // The useAuthState hook will re-run with the new anonymous user,
                    // and the logic will proceed to the next block.
                } catch (e) {
                    console.error("Critical: Anonymous sign-in failed. Chat will not load.", e);
                    setRole('customer'); // Default to customer on failure
                }
                return;
            }

            if (user.isAnonymous) {
                setRole('customer');
                return;
            }

            // For fully signed-in users, get their custom claims to determine role.
            try {
                const tokenResult = await user.getIdTokenResult();
                if (tokenResult.claims.admin) {
                    setRole('admin');
                } else if (tokenResult.claims.agent) {
                    setRole('agent');
                } else {
                    setRole('customer'); // A signed-in user without a specific role is a customer.
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

    if (role === 'agent' || role === 'admin') {
        return <AgentAdminChat user={user} userRole={role} />;
    } else {
        return <CustomerChat user={user} />;
    }
}