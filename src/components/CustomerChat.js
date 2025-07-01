import React, { useState, useEffect, useRef } from 'react';
import { db, auth } from '../lib/firebaseClient';
import { collection, query, where, onSnapshot, doc, serverTimestamp, orderBy, addDoc, updateDoc, limit } from 'firebase/firestore';
import styles from './SharedChat.module.css';

// --- SVG Icons ---
const ChatIcon = () => <svg width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"></path></svg>;
const CloseIcon = () => <svg width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"></path></svg>;
const MinimizeIcon = () => <svg width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M19 13H5v-2h14v2z"></path></svg>;
const SendIcon = () => <svg width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"></path></svg>;

export default function CustomerChat({ user }) {
    const [isOpen, setIsOpen] = useState(false);
    const [chatId, setChatId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef(null);
    const panelRef = useRef(null);
    const [messageText, setMessageText] = useState('');

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        function handleClickOutside(event) {
            if (isOpen && panelRef.current && !panelRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isOpen]);

    useEffect(() => {
        if (!user || !isOpen) {
            setMessages([]); // Clear messages when closed
            setChatId(null);  // Clear chat session
            return;
        }

        setIsLoading(true);
        const q = query(collection(db, 'chats'), where('participants', 'array-contains', user.uid), limit(1));
        
        // This is the listener for the chat session itself
        const unsubscribeChat = onSnapshot(q, (querySnapshot) => {
            if (!querySnapshot.empty) {
                const newChatId = querySnapshot.docs[0].id;
                setChatId(newChatId);
            } else {
                setChatId(null);
                setMessages([]);
                setIsLoading(false); // Stop loading if no chat exists
            }
        }, (error) => {
            console.error("Error fetching chat session:", error);
            setIsLoading(false);
        });

        return () => unsubscribeChat();
    }, [user, isOpen]);

    useEffect(() => {
        if (!chatId) {
            setMessages([]);
            return;
        }

        // This is the listener for messages *within* the chat session
        const messagesQuery = query(collection(db, `chats/${chatId}/messages`), orderBy('timestamp', 'asc'));
        const unsubscribeMessages = onSnapshot(messagesQuery, (msgSnapshot) => {
            setMessages(msgSnapshot.docs.map(d => ({id: d.id, ...d.data()})));
            setIsLoading(false); // Stop loading once messages are fetched
        }, (error) => {
            console.error("Error fetching messages:", error);
            setIsLoading(false);
        });
        
        return () => unsubscribeMessages();
    }, [chatId]);

    const handleSendMessage = async (e) => {
        e.preventDefault();
        const textToSend = messageText.trim();
        if (!textToSend || !user) return;
        setMessageText('');

        if (!chatId) {
            await fetch('/api/chat/create', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${await auth.currentUser.getIdToken()}` }, body: JSON.stringify({ initialMessage: textToSend }) });
        } else {
            await addDoc(collection(db, `chats/${chatId}/messages`), { text: textToSend, senderId: user.uid, timestamp: serverTimestamp() });
            await updateDoc(doc(db, 'chats', chatId), { lastMessage: { text: textToSend, timestamp: new Date() }, unreadByAgent: true, unreadByAdmin: true });
        }
    };

    const WelcomeScreen = () => (
        <div className={styles.welcomeContainer}>
            <h4>Welcome!</h4>
            <p>How can we help you today?</p>
        </div>
    );

    return (
        <div className={styles.chatContainer}>
            <button className={styles.floatingIcon} onClick={() => setIsOpen(true)} style={{ display: isOpen ? 'none' : 'flex' }}><ChatIcon /></button>
            <div ref={panelRef} className={`${styles.panel} ${styles.customerPanel} ${isOpen ? styles.open : ''}`}>
                <div className={styles.header}>
                    <h3>Support Chat</h3>
                    <div className={styles.headerActions}>
                        <button onClick={() => setIsOpen(false)} className={styles.headerButton}><MinimizeIcon /></button>
                        <button onClick={() => setIsOpen(false)} className={styles.headerButton}><CloseIcon /></button>
                    </div>
                </div>
                <div className={styles.chatView}>
                    <div className={styles.messagesContainer}>
                        {isLoading ? <p className={styles.noItemsMessage}>Loading chat...</p> : 
                         messages.length > 0 ? (
                            messages.map(msg => (
                                <div key={msg.id} className={`${styles.messageWrapper} ${msg.senderId === user.uid ? styles.sent : styles.received}`}>
                                    <div className={styles.message}>
                                        <p>{msg.text}</p>
                                    </div>
                                </div>
                            ))
                          ) : <WelcomeScreen />
                        }
                        <div ref={messagesEndRef} />
                    </div>
                    <div className={styles.inputArea}>
                        <form onSubmit={handleSendMessage}>
                            <input type="text" value={messageText} onChange={(e) => setMessageText(e.target.value)} placeholder="Type a message..."/>
                            <button type="submit"><SendIcon /></button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}