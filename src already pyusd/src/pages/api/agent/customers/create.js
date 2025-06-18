// src/pages/api/agent/customers/create.js
import { db } from '../../../../lib/firebaseAdmin';
import { withAgentAuth } from '../../../../lib/authMiddleware';
import { Timestamp } from 'firebase-admin/firestore';

const handler = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { uid: agentId, email: agentEmail } = req.decodedToken;
  const { username, facebookName, facebookProfileLink } = req.body;

  if (!username || !facebookName || !facebookProfileLink) {
    return res.status(400).json({ message: 'Username, Facebook Name, and Profile Link are required.' });
  }

  try {
    const customersRef = db.collection('customers');

    // Check for duplicate username
    const usernameQuery = customersRef.where('username', '==', username.trim());
    const usernameSnapshot = await usernameQuery.get();
    if (!usernameSnapshot.empty) {
      return res.status(409).json({ message: `A customer with the username "${username}" already exists.` });
    }

    // Check for duplicate Facebook profile link
    const linkQuery = customersRef.where('facebookProfileLink', '==', facebookProfileLink.trim());
    const linkSnapshot = await linkQuery.get();
    if (!linkSnapshot.empty) {
      return res.status(409).json({ message: 'A customer with this Facebook Profile Link already exists.' });
    }

    // All checks passed, create the new customer
    const newCustomerRef = db.collection('customers').doc();
    await newCustomerRef.set({
      id: newCustomerRef.id,
      username: username.trim(),
      facebookName: facebookName.trim(),
      facebookProfileLink: facebookProfileLink.trim(),
      managedByAgentId: agentId,
      managedByAgentEmail: agentEmail,
      createdAt: Timestamp.now(),
    });

    res.status(201).json({ success: true, message: 'Customer added successfully.', id: newCustomerRef.id });

  } catch (error) {
    console.error('Error creating customer:', error);
    res.status(500).json({ message: 'An internal server error occurred.' });
  }
};

export default withAgentAuth(handler);