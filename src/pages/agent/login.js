// pages/agent/login.js
import { useState, useEffect } from 'react';
import Head from 'next/head';
import { auth, db } from '../../lib/firebaseClient'; // Import auth from firebaseClient
import { useRouter } from 'next/router';
import { signInWithEmailAndPassword, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export default function AgentLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState({ text: '', type: '' }); // type: 'success' or 'error'
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  // Effect to check authentication status on component mount
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // User is signed in, check their role
        const userDocRef = doc(db, 'users', user.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists() && userDocSnap.data().role === 'agent') {
          // If it's an agent, redirect to agent dashboard
          console.log('Agent already logged in, redirecting to agent page.');
          // Record login time
          try {
            await fetch('/api/agent/record-login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ agentId: user.uid }),
            });
          } catch (error) {
            console.error('Error recording login time:', error);
          }
          router.replace('/agent');
        } else {
          // If not an agent or role not found, sign out and show error
          await auth.signOut();
          setMessage({ text: 'Access Denied: Not an authorized agent account.', type: 'error' });
        }
      }
      // If no user, stay on login page
    });

    return () => unsubscribe(); // Clean up the listener
  }, [router]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setMessage({ text: '', type: '' });
    setIsLoading(true);

    if (!email || !password) {
      setMessage({ text: 'Please enter both email and password.', type: 'error' });
      setIsLoading(false);
      return;
    }

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // After successful Firebase Auth login, verify user's role from Firestore
      const userDocRef = doc(db, 'users', user.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists() && userDocSnap.data().role === 'agent') {
        setMessage({ text: 'Login successful! Redirecting...', type: 'success' });
        // Record login time
        try {
          await fetch('/api/agent/record-login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ agentId: user.uid }),
          });
        } catch (error) {
          console.error('Error recording login time:', error);
        }
        router.replace('/agent'); // Redirect to agent dashboard
      } else {
        // If user is not an agent, sign them out immediately
        await auth.signOut();
        setMessage({ text: 'Access Denied: You do not have agent privileges.', type: 'error' });
      }
    } catch (error) {
      console.error('Login error:', error);
      let errorMessage = 'Failed to log in. Please check your credentials.';
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        errorMessage = 'Invalid email or password.';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many login attempts. Please try again later.';
      }
      setMessage({ text: errorMessage, type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const styles = {
    container: {
      minHeight: '100vh',
      padding: '0 0.5rem',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#f0f2f5',
      fontFamily: 'Inter, sans-serif',
    },
    main: {
      padding: '2rem',
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
      backgroundColor: '#ffffff',
      textAlign: 'center',
      maxWidth: '400px',
      width: '100%',
    },
    title: {
      fontSize: '2rem',
      marginBottom: '1.5rem',
      color: '#333',
    },
    form: {
      display: 'flex',
      flexDirection: 'column',
      gap: '1rem',
    },
    inputGroup: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-start',
    },
    label: {
      marginBottom: '0.5rem',
      fontSize: '0.9rem',
      color: '#444',
    },
    input: {
      width: '100%',
      padding: '0.8rem',
      fontSize: '1rem',
      border: '1px solid #ddd',
      borderRadius: '4px',
    },
    button: {
      padding: '0.8rem 1.5rem',
      fontSize: '1rem',
      backgroundColor: '#0070f3',
      color: 'white',
      border: 'none',
      borderRadius: '4px',
      cursor: 'pointer',
      transition: 'background-color 0.2s ease-in-out',
    },
    buttonDisabled: {
      backgroundColor: '#cccccc',
      cursor: 'not-allowed',
    },
    successMessage: {
      color: '#28a745',
      fontSize: '0.95rem',
      marginTop: '1rem',
    },
    errorMessage: {
      color: '#dc3545',
      fontSize: '0.95rem',
      marginTop: '1rem',
    },
  };

  return (
    <div style={styles.container}>
      <Head>
        <title>Agent Login</title>
        <meta name="description" content="Agent login page" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main style={styles.main}>
        <h1 style={styles.title}>Agent Login</h1>

        <form onSubmit={handleLogin} style={styles.form}>
          <div style={styles.inputGroup}>
            <label htmlFor="email" style={styles.label}>Email:</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="agent@example.com"
              required
              style={styles.input}
              disabled={isLoading}
            />
          </div>

          <div style={styles.inputGroup}>
            <label htmlFor="password" style={styles.label}>Password:</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="********"
              required
              style={styles.input}
              disabled={isLoading}
            />
          </div>

          <button type="submit" disabled={isLoading} style={isLoading ? { ...styles.button, ...styles.buttonDisabled } : styles.button}>
            {isLoading ? 'Logging In...' : 'Login'}
          </button>
        </form>

        {message.text && (
          <p style={message.type === 'success' ? styles.successMessage : styles.errorMessage}>
            {message.text}
          </p>
        )}
      </main>
    </div>
  );
}
