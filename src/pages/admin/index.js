// pages/admin/index.js
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { auth as firebaseAuth, db } from '../../lib/firebaseClient'; // Import db as well
import { signInWithEmailAndPassword, onAuthStateChanged } from 'firebase/auth'; // Import specific auth methods
import { doc, getDoc } from 'firebase/firestore'; // Import firestore methods

export default function AdminLogin() {
  const router = useRouter();
  const [form, setForm] = useState({ email: '', password: '' }); // Changed username to email
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true); // New state for initial auth check

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
      if (user) {
        // User is signed in, now check their role in Firestore
        try {
          const userDocRef = doc(db, 'users', user.uid);
          const userDocSnap = await getDoc(userDocRef);

          if (userDocSnap.exists() && userDocSnap.data()?.isAdmin) {
            console.log('Firebase user is signed in and is an admin. Redirecting...');
            router.replace('/admin/dashboard');
          } else {
            // User is signed in but not an admin, or isAdmin flag is false/missing
            console.log('Firebase user is signed in but not an admin. Signing out.');
            await firebaseAuth.signOut(); // Sign out non-admin users
            setError('You do not have administrative privileges.');
            setLoading(false); // Auth check complete, show form
          }
        } catch (e) {
          console.error("Error checking admin role:", e);
          setError('Failed to verify admin status. Please try again.');
          await firebaseAuth.signOut(); // Sign out on error
          setLoading(false); // Auth check complete, show form
        }
      } else {
        // No user is signed in
        console.log('No Firebase user signed in. Showing login form.');
        setLoading(false); // Auth check complete, show form
      }
    });

    return () => unsubscribe(); // Clean up auth listener
  }, [router]);

  const handleChange = e => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setError(''); // Clear previous errors

    try {
      // Use Firebase's signInWithEmailAndPassword
      const userCredential = await signInWithEmailAndPassword(firebaseAuth, form.email, form.password);
      const user = userCredential.user;

      // After successful Firebase Auth login, verify admin role from Firestore
      const userDocRef = doc(db, 'users', user.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists() && userDocSnap.data()?.isAdmin) {
        console.log('Admin successfully logged in via Firebase Auth and role verified.');
        router.push('/admin/dashboard'); // Redirect to dashboard after successful login
      } else {
        // If the user logs in via Firebase Auth but is not marked as admin in Firestore
        console.log('User logged in, but not an admin according to Firestore. Signing out.');
        await firebaseAuth.signOut(); // Sign out the non-admin user
        setError('Invalid credentials or you do not have administrative privileges.');
      }

    } catch (err) {
      console.error("Admin login error:", err);
      if (err.code) {
        switch (err.code) {
          case 'auth/user-not-found':
          case 'auth/wrong-password':
          case 'auth/invalid-credential': // More generic in newer Firebase versions
            setError('Invalid email or password.');
            break;
          case 'auth/invalid-email':
            setError('Please enter a valid email address.');
            break;
          case 'auth/too-many-requests':
            setError('Too many login attempts. Please try again later.');
            break;
          default:
            setError(`Login failed: ${err.message}`);
        }
      } else {
        setError('An unexpected error occurred during login.');
      }
    }
  };

  if (loading) {
    return (
      <div className="container mt-lg text-center" style={{ maxWidth: '400px' }}>
        <p>Checking authentication status...</p>
      </div>
    );
  }

  return (
    <div className="container mt-lg" style={{ maxWidth: '400px' }}>
      <div className="card">
        <h2 className="card-header text-center">🔐 Admin Access</h2>
        <form onSubmit={handleSubmit}>
          <label>Email</label> {/* Changed label from Username to Email */}
          <input
            className="input"
            name="email"
            type="email" // Changed type to email
            placeholder="Admin email"
            value={form.email}
            onChange={handleChange}
            required
          />
          <label>Password</label>
          <input
            className="input"
            name="password"
            type="password"
            placeholder="Password"
            value={form.password}
            onChange={handleChange}
            required
          />
          <button className="btn btn-primary mt-md" type="submit">Login</button>
        </form>
        {error && <div className="alert alert-danger mt-md">{error}</div>}
      </div>
    </div>
  );
}