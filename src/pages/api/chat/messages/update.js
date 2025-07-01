import { db } from '../../../../lib/firebaseAdmin';
import { withAuth } from '../../../../lib/authMiddleware';

// This handler is protected by withAuth, ensuring only admins can access it.
const handler = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { chatId, messageId, newText } = req.body;

  if (!chatId || !messageId || !newText) {
    return res.status(400).json({ message: 'Chat ID, Message ID, and new text are required.' });
  }

  try {
    const messageRef = db.collection('chats').doc(chatId).collection('messages').doc(messageId);

    // Verify the document exists before trying to update
    const doc = await messageRef.get();
    if (!doc.exists) {
      return res.status(404).json({ message: 'Message not found.' });
    }

    await messageRef.update({
      text: newText,
      isEdited: true,
    });

    res.status(200).json({ success: true, message: 'Message updated successfully.' });
  } catch (error) {
    console.error('Error updating message:', error);
    res.status(500).json({ message: 'Failed to update message.' });
  }
};

export default withAuth(handler);