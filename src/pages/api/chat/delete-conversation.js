// src/pages/api/chat/delete-conversation.js
import { db } from '../../../lib/firebaseAdmin';
import { withAuth } from '../../../lib/authMiddleware';

// Helper function to recursively delete a collection
async function deleteCollection(collectionRef, batchSize) {
    const query = collectionRef.limit(batchSize);
    let deleted = 0;

    do {
        const snapshot = await query.get();
        if (snapshot.size === 0) {
            return;
        }

        const batch = db.batch();
        snapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
        await batch.commit();

        deleted += snapshot.size;
    } while (deleted > 0);
}


const handler = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  // withAuth middleware ensures only an admin can proceed
  const { chatId } = req.body;

  if (!chatId) {
    return res.status(400).json({ message: 'Chat ID is required.' });
  }

  try {
    const chatRef = db.collection('chats').doc(chatId);
    const messagesRef = chatRef.collection('messages');

    // Delete all messages in the subcollection first
    await deleteCollection(messagesRef, 100);
    
    // Once the subcollection is empty, delete the main chat document
    await chatRef.delete();

    res.status(200).json({ success: true, message: 'Chat conversation deleted successfully.' });
  } catch (error) {
    console.error(`Error deleting chat conversation ${chatId}:`, error);
    res.status(500).json({ message: 'Failed to delete chat conversation.', error: error.message });
  }
};

export default withAuth(handler);