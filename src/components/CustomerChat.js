// src/components/CustomerChat.js
import React, { useState, useEffect, useRef } from 'react';
import { db, auth } from '../lib/firebaseClient';
import { signInWithCustomToken } from 'firebase/auth';
import { collection, query, onSnapshot, doc, serverTimestamp, orderBy, addDoc, updateDoc, setDoc, getDoc } from 'firebase/firestore';
import styles from './SharedChat.module.css';

// --- SVG Icons ---
const ChatIcon = () => <svg width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"></path></svg>;
const MinimizeIcon = () => <svg width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M19 13H5v-2h14v2z"></path></svg>;
const SendIcon = () => <svg width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"></path></svg>;

/**
 * A login form component displayed before the user starts a chat.
 */
const ChatLogin = ({ onLogin, error, isLoading }) => {
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        onLogin(username, email);
    };

    return (
        <div className={styles.welcomeContainer}>
            <h4>Support Chat</h4>
            <p>Please enter your details to start.</p>
            <form onSubmit={handleSubmit} style={{ width: '80%', marginTop: '1rem' }}>
                <div className="form-group">
                    <input
                        type="text"
                        className="input"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="Game Username"
                        required
                        disabled={isLoading}
                    />
                </div>
                <div className="form-group">
                    <input
                        type="email"
                        className="input"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Email Address"
                        required
                        disabled={isLoading}
                    />
                </div>
                <button type="submit" className="btn btn-primary btn-full-width" disabled={isLoading}>
                    {isLoading ? 'Starting...' : 'Start Chat'}
                </button>
                {error && <p className="alert alert-danger mt-md">{error}</p>}
            </form>
        </div>
    );
};

export default function CustomerChat() {
    const [isOpen, setIsOpen] = useState(false);
    const [user, setUser] = useState(null); // Firebase auth user object
    const [loggedInUsername, setLoggedInUsername] = useState('');
    const [chatId, setChatId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [isChatLoading, setIsChatLoading] = useState(false);
    const [isLoginLoading, setIsLoginLoading] = useState(false);
    const [loginError, setLoginError] = useState('');
    const [messageText, setMessageText] = useState('');
    const messagesEndRef = useRef(null);
    const panelRef = useRef(null);
    const iconRef = useRef(null); // Ref for the floating icon

    // Effect to listen for Firebase auth state changes. Session is now persistent.
    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged(currentUser => {
            if (currentUser && !currentUser.isAnonymous) {
                setUser(currentUser);
            } else {
                setUser(null);
            }
        });
        return () => unsubscribe();
    }, []);

    // Effect to scroll to the bottom of the message list
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Effect to handle clicks outside the chat panel to minimize it
    useEffect(() => {
        function handleClickOutside(event) {
            // If panel is open, and the click is not on the panel or the icon, minimize.
            if (isOpen && panelRef.current && !panelRef.current.contains(event.target) && iconRef.current && !iconRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isOpen]);

    // Effect to fetch chat messages once a user is logged in and the panel is open
    useEffect(() => {
        if (!user || !isOpen) {
            // We don't clear messages anymore to persist state when minimized
            return;
        }

        // Only set loading state if messages are not already loaded
        if (messages.length === 0) {
            setIsChatLoading(true);
        }

        const chatDocRef = doc(db, 'chats', user.uid);
        setChatId(user.uid);

        const unsubscribeMessages = onSnapshot(
            query(collection(chatDocRef, 'messages'), orderBy('timestamp', 'asc')),
            (msgSnapshot) => {
                setMessages(msgSnapshot.docs.map(d => ({ id: d.id, ...d.data() })));
                setIsChatLoading(false);
            },
            (error) => {
                console.error("Error fetching messages:", error);
                setIsChatLoading(false);
            }
        );

        return () => unsubscribeMessages();
    }, [user, isOpen, messages.length]);

    const handleToggleChat = () => {
        setIsOpen(prev => !prev);
    };

    const handleLogin = async (username, email) => {
        setLoginError('');
        setIsLoginLoading(true);
        try {
            const res = await fetch('/api/chat/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, email }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to log in.');

            setLoggedInUsername(username);
            await signInWithCustomToken(auth, data.token);
        } catch (err) {
            console.error("Chat login error:", err);
            setLoginError(err.message);
        } finally {
            setIsLoginLoading(false);
        }
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        const textToSend = messageText.trim();
        if (!textToSend || !user || !chatId) return;
        setMessageText('');

        const chatDocRef = doc(db, 'chats', chatId);
        const messagesColRef = collection(chatDocRef, 'messages');

        try {
            const chatDocSnap = await getDoc(chatDocRef);
            if (!chatDocSnap.exists()) {
                await setDoc(chatDocRef, {
                    participants: [user.uid],
                    customerDisplayName: loggedInUsername || 'Customer',
                    lastMessage: { text: textToSend, timestamp: serverTimestamp() },
                    unreadByAgent: true,
                    unreadByAdmin: true,
                    createdAt: serverTimestamp(),
                });
            } else {
                await updateDoc(chatDocRef, {
                    lastMessage: { text: textToSend, timestamp: new Date() },
                    unreadByAgent: true,
                    unreadByAdmin: true,
                });
            }
            await addDoc(messagesColRef, { text: textToSend, senderId: user.uid, timestamp: serverTimestamp() });
        } catch (error) {
            console.error("Error sending message:", error);
        }
    };

    return (
        <div className={styles.chatContainer}>
            <button ref={iconRef} className={styles.floatingIcon} onClick={handleToggleChat}>
                {isOpen ? <MinimizeIcon /> : <ChatIcon />}
            </button>
            <div ref={panelRef} className={`${styles.panel} ${styles.customerPanel} ${isOpen ? styles.open : ''}`}>
                <div className={styles.header}>
                    <h3>{user ? `Chatting as ${loggedInUsername}` : 'Support Chat'}</h3>
                    <div className={styles.headerActions}>
                        <button onClick={handleToggleChat} className={styles.headerButton}><MinimizeIcon /></button>
                    </div>
                </div>
                <div className={styles.chatView}>
                    {user ? (
                        <>
                            <div className={styles.messagesContainer}>
                                {isChatLoading ? <p className={styles.noItemsMessage}>Loading chat...</p> :
                                    messages.length > 0 ? (
                                        messages.map(msg => (
                                            <div key={msg.id} className={`${styles.messageWrapper} ${msg.senderId === user.uid ? styles.sent : styles.received}`}>
                                                <div className={styles.message}><p>{msg.text}</p></div>
                                            </div>
                                        ))
                                    ) : <p className={styles.noItemsMessage}>No messages yet. Say hello!</p>
                                }
                                <div ref={messagesEndRef} />
                            </div>
                            <div className={styles.inputArea}>
                                <form onSubmit={handleSendMessage}>
                                    <input type="text" value={messageText} onChange={(e) => setMessageText(e.target.value)} placeholder="Type a message..." />
                                    <button type="submit"><SendIcon /></button>
                                </form>
                            </div>
                        </>
                    ) : (
                        <ChatLogin onLogin={handleLogin} error={loginError} isLoading={isLoginLoading} />
                    )}
                </div>
            </div>
        </div>
    );
}
