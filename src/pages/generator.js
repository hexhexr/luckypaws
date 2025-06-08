import { useState } from 'react';
import Head from 'next/head';

export default function GenerateUsernamePage() {
  const [facebookName, setFacebookName] = useState('');
  const [generatedUsername, setGeneratedUsername] = useState('');
  const [message, setMessage] = useState({ text: '', type: '' }); // type: 'success' or 'error'
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault(); // Prevent default form submission
    setMessage({ text: '', type: '' }); // Clear previous messages
    setGeneratedUsername(''); // Clear previous username
    setIsLoading(true); // Show loading indicator

    if (!facebookName.trim()) {
      setMessage({ text: 'Please enter a Facebook name.', type: 'error' });
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/generate-username', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ facebookName }),
      });

      const data = await response.json();

      if (response.ok) {
        setGeneratedUsername(data.username);
        setMessage({ text: data.message, type: 'success' });
      } else {
        setMessage({ text: data.message || 'An unknown error occurred.', type: 'error' });
      }
    } catch (error) {
      console.error('Frontend error:', error);
      setMessage({ text: 'Network error. Please try again.', type: 'error' });
    } finally {
      setIsLoading(false); // Hide loading indicator
    }
  };

  return (
    <div style={styles.container}>
      <Head>
        <title>Username Generator</title>
        <meta name="description" content="Generate unique usernames for your game" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main style={styles.main}>
        <h1 style={styles.title}>
          Username Generator
        </h1>

        <p style={styles.description}>
          Enter a Facebook name to generate a unique username for the game.
        </p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.inputGroup}>
            <label htmlFor="facebookName" style={styles.label}>Facebook Name:</label>
            <input
              type="text"
              id="facebookName"
              value={facebookName}
              onChange={(e) => setFacebookName(e.target.value)}
              placeholder="e.g., John Doe"
              required
              style={styles.input}
              disabled={isLoading}
            />
          </div>

          <button type="submit" disabled={isLoading} style={styles.button}>
            {isLoading ? 'Generating...' : 'Generate Username'}
          </button>
        </form>

        {message.text && (
          <p style={message.type === 'success' ? styles.successMessage : styles.errorMessage}>
            {message.text}
          </p>
        )}

        {generatedUsername && (
          <div style={styles.resultContainer}>
            <h2 style={styles.resultTitle}>Generated Username:</h2>
            <p style={styles.usernameDisplay}>{generatedUsername}</p>
          </div>
        )}
      </main>
    </div>
  );
}

// Basic inline styles for a quick setup. Consider using CSS modules or a styling library for larger projects.
const styles = {
  container: {
    minHeight: '100vh',
    padding: '0 0.5rem',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f2f5',
    fontFamily: 'Arial, sans-serif',
  },
  main: {
    padding: '2rem',
    borderRadius: '8px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
    backgroundColor: '#ffffff',
    textAlign: 'center',
    maxWidth: '500px',
    width: '100%',
  },
  title: {
    fontSize: '2rem',
    marginBottom: '1rem',
    color: '#333',
  },
  description: {
    fontSize: '1rem',
    color: '#555',
    marginBottom: '1.5rem',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    marginBottom: '1.5rem',
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
  buttonHover: { // For hover effect (would need JavaScript to apply)
    backgroundColor: '#005bb5',
  },
  buttonDisabled: { // For disabled state
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
  resultContainer: {
    marginTop: '2rem',
    padding: '1.5rem',
    border: '1px dashed #0070f3',
    borderRadius: '8px',
    backgroundColor: '#e6f2ff',
  },
  resultTitle: {
    fontSize: '1.2rem',
    color: '#0070f3',
    marginBottom: '0.5rem',
  },
  usernameDisplay: {
    fontSize: '1.5rem',
    fontWeight: 'bold',
    color: '#333',
    wordBreak: 'break-all', // Ensures long usernames wrap
  },
};