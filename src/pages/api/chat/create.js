// src/pages/api/chat/create.js
import { db } from '../../../lib/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';
import { withAuthenticatedUser } from '../../../lib/authMiddleware';

const handler = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { uid } = req.decodedToken;
  const { initialMessage } = req.body;

  if (!initialMessage || initialMessage.trim() === '') {
    return res.status(400).json({ message: 'An initial message is required.' });
  }

  try {
    const chatsRef = db.collection('chats');
    const existingChatQuery = chatsRef.where('participants', 'array-contains', uid).limit(1);
    const existingChatSnapshot = await existingChatQuery.get();

    if (!existingChatSnapshot.empty) {
        return res.status(409).json({ success: false, message: "A chat session already exists for this user."});
    }

    const chatRef = db.collection('chats').doc();
    const messageRef = chatRef.collection('messages').doc();
    const batch = db.batch();

    batch.set(chatRef, {
      participants: [uid],
      customerDisplayName: 'Customer',
      lastMessage: { text: initialMessage, timestamp: Timestamp.now() },
      unreadByAgent: true,
      unreadByAdmin: true,
      createdAt: Timestamp.now(),
    });

    batch.set(messageRef, {
      text: initialMessage,
      senderId: uid,
      senderName: 'Customer',
      timestamp: Timestamp.now(),
    });

    await batch.commit();

    res.status(201).json({ success: true, chatId: chatRef.id });
  } catch (error) {
    console.error('Error creating chat:', error);
    res.status(500).json({ message: 'Failed to create chat.' });
  }
};

export default withAuthenticatedUser(handler);