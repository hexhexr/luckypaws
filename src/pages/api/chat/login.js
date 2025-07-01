// src/pages/api/chat/login.js
import { auth, db } from '../../../lib/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';
import crypto from 'crypto';

/**
 * Creates a deterministic, unique user ID (UID) from a given username.
 * This ensures that the same user always gets the same UID when they log in.
 * @param {string} username - The username to hash.
 * @returns {string} A SHA256 hash truncated to 28 characters, similar to Firebase UIDs.
 */
const createDeterministicUid = (username) => {
    const hash = crypto.createHash('sha256');
    hash.update(username.toLowerCase().trim());
    // Truncate the hash to a reasonable length for a UID.
    return hash.digest('hex').substring(0, 28);
};

const handler = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const { username, email } = req.body;

    if (!username || !email || !email.includes('@')) {
        return res.status(400).json({ message: 'A valid username and email are required.' });
    }

    // Generate a consistent UID from the username.
    const uid = createDeterministicUid(username);
    const userRef = db.collection('users').doc(uid);

    try {
        const userDoc = await userRef.get();

        // If the user doesn't exist in Firestore, create a new record for them.
        if (!userDoc.exists) {
            await userRef.set({
                uid: uid,
                username: username.trim(),
                email: email.trim(),
                customer: true, // A flag to identify chat customers
                createdAt: Timestamp.now(),
            });
        } else {
            // If the user already exists, we can update their details if needed (e.g., email).
            await userRef.update({ email: email.trim() });
        }

        // Create a custom authentication token for this UID with a 'customer' claim.
        // This token allows the user to sign in to Firebase on the client-side.
        const customToken = await auth.createCustomToken(uid, { customer: true });

        res.status(200).json({ success: true, token: customToken });

    } catch (error) {
        console.error('Error in chat login API:', error);
        res.status(500).json({ message: 'Failed to create chat session.', error: error.message });
    }
};

export default handler;
