// src/components/AgentAdminChat.js
import React, { useState, useEffect, useRef } from 'react';
import { db, auth } from '../lib/firebaseClient';
import { collection, query, onSnapshot, doc, updateDoc, serverTimestamp, orderBy, addDoc } from 'firebase/firestore';
import styles from './SharedChat.module.css';

// --- SVG Icons ---
const ChatIcon = () => <svg width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"></path></svg>;
const CloseIcon = () => <svg width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"></path></svg>;
const MinimizeIcon = () => <svg width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M19 13H5v-2h14v2z"></path></svg>;
const SendIcon = () => <svg width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"></path></svg>;
const MenuIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>;
const DeleteIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"></path></svg>;


const ChatList = ({ chats, activeChat, onSelectChat, userRole, onDeleteChat }) => (
    <div className={styles.sidebar}>
        <div className={styles.sidebarHeader}>Conversations</div>
        <div className={styles.chatListContainer}>
            {chats.length === 0 ? <p className={styles.noItemsMessage}>No active chats.</p> : chats.map(chat => (
                <div key={chat.id} className={`${styles.chatListItem} ${activeChat?.id === chat.id ? styles.active : ''}`} onClick={() => onSelectChat(chat)}>
                    <div className={styles.chatInfo}>
                        <div className={styles.customerName}>{chat.customerDisplayName || 'Customer'}</div>
                        <p className={styles.lastMessage}>{chat.lastMessage?.text}</p>
                    </div>
                    {userRole === 'admin' && <button className={styles.deleteChatButton} onClick={(e) => { e.stopPropagation(); onDeleteChat(chat.id); }}><DeleteIcon /></button>}
                </div>
            ))}
        </div>
    </div>
);

export default function AgentAdminChat({ user, userRole }) {
    const [isOpen, setIsOpen] = useState(false);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [chats, setChats] = useState([]);
    const [activeChat, setActiveChat] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const messagesEndRef = useRef(null);
    const panelRef = useRef(null);

    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

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
        if (!isOpen) { setChats([]); return; }
        const q = query(collection(db, 'chats'), orderBy('lastMessage.timestamp', 'desc'));
        const unsubscribe = onSnapshot(q, snapshot => setChats(snapshot.docs.map(d => ({ id: d.id, ...d.data() }))));
        return () => unsubscribe();
    }, [isOpen]);

    useEffect(() => {
        if (!activeChat || !isOpen) { setMessages([]); return; }
        const q = query(collection(db, `chats/${activeChat.id}/messages`), orderBy('timestamp', 'asc'));
        const unsubscribe = onSnapshot(q, snapshot => setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
        return () => unsubscribe();
    }, [activeChat, isOpen]);

    const selectChat = async (chat) => {
        setActiveChat(chat);
        const unreadKey = userRole === 'admin' ? 'unreadByAdmin' : 'unreadByAgent';
        if (chat[unreadKey]) {
            await updateDoc(doc(db, 'chats', chat.id), { [unreadKey]: false });
        }
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (newMessage.trim() === '' || !activeChat) return;
        const textToSend = newMessage;
        setNewMessage('');
        await addDoc(collection(db, `chats/${activeChat.id}/messages`), { text: textToSend, senderId: user.uid, senderName: user.displayName || 'Support', timestamp: serverTimestamp() });
        await updateDoc(doc(db, 'chats', activeChat.id), { lastMessage: { text: textToSend, timestamp: new Date() }});
    };

    const handleDeleteChat = async (chatId) => {
        if (!window.confirm("Delete this conversation permanently?")) return;
        try {
            const token = await auth.currentUser.getIdToken();
            await fetch('/api/chat/delete-conversation', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ chatId }) });
            if (activeChat?.id === chatId) setActiveChat(null);
        } catch (error) { console.error(`Error deleting chat: ${error.message}`); }
    };

    const isSupportMessage = (msg) => {
        return activeChat?.participants?.includes(msg.senderId) === false;
    };

    return (
        <div className={styles.chatContainer}>
            <button className={styles.floatingIcon} onClick={() => setIsOpen(true)} style={{ display: isOpen ? 'none' : 'flex' }}><ChatIcon /></button>
            <div ref={panelRef} className={`${styles.panel} ${styles.agentPanel} ${isOpen ? styles.open : ''}`}>
                <div className={`${styles.dashboard} ${isSidebarCollapsed ? styles.sidebarCollapsed : ''}`}>
                    <ChatList chats={chats} activeChat={activeChat} onSelectChat={selectChat} userRole={userRole} onDeleteChat={handleDeleteChat} />
                    <div className={styles.mainContent}>
                        <div className={styles.header}>
                            <div className={styles.headerTitle}>
                                <button className={styles.menuToggle} onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}><MenuIcon /></button>
                                <h3>{activeChat ? (activeChat.customerDisplayName || 'Customer') : 'Chat'}</h3>
                            </div>
                            <div className={styles.headerActions}>
                                <button onClick={() => setIsOpen(false)} className={styles.headerButton} aria-label="Minimize"><MinimizeIcon /></button>
                                <button onClick={() => setIsOpen(false)} className={styles.headerButton} aria-label="Close"><CloseIcon /></button>
                            </div>
                        </div>
                        {activeChat ? (
                             <div className={styles.chatView}>
                                <div className={styles.messagesContainer}>
                                    {messages.map(msg => (
                                        <div key={msg.id} className={`${styles.messageWrapper} ${isSupportMessage(msg) ? styles.sent : styles.received}`}>
                                            <div className={`${styles.message} ${isSupportMessage(msg) ? styles.supportMessage : styles.customerMessage}`}>
                                                <p>{msg.text}</p>
                                            </div>
                                            {isSupportMessage(msg) && <div className={styles.senderName}>Sent by {msg.senderName || 'Support'}</div>}
                                        </div>
                                    ))}
                                    <div ref={messagesEndRef} />
                                </div>
                                {/* --- THIS IS THE FIX --- */}
                                {/* The form is now wrapped in a div with the correct class, just like in CustomerChat.js */}
                                <div className={styles.inputArea}>
                                    <form onSubmit={handleSendMessage}>
                                        <input type="text" value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Type a message..." />
                                        <button type="submit" aria-label="Send Message"><SendIcon /></button>
                                    </form>
                                </div>
                            </div>
                        ) : (
                            <div className={styles.noChatSelected}>
                                <p>Select a conversation from the left.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
