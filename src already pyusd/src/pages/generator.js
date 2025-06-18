// src/pages/generator.js
import { useState } from 'react';
import Head from 'next/head';
import Header from '../components/Header';
import Footer from '../components/Footer';

export default function GenerateUsernamePage() {
  const [facebookName, setFacebookName] = useState('');
  const [generatedUsername, setGeneratedUsername] = useState('');
  const [message, setMessage] = useState({ text: '', type: '' });
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage({ text: '', type: '' });
    setGeneratedUsername('');
    setIsLoading(true);

    if (!facebookName.trim()) {
      setMessage({ text: 'Please enter a Facebook name.', type: 'error' });
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/generate-username', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      setIsLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Username Generator - Lucky Paw</title>
        <meta name="description" content="Generate unique usernames for your game" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <Header />

      <main className="main-content section-padded">
        <div className="container" style={{ maxWidth: '600px' }}>
          <div className="card">
            <div className="card-header">
              Username Generator
            </div>
            <div className="card-body">
              <p className="section-subtitle">
                Enter a Facebook name to generate a unique username for the game.
              </p>
              <form onSubmit={handleSubmit} className="payment-form-grid">
                <div className="form-group">
                  <label htmlFor="facebookName">Facebook Name:</label>
                  <input
                    type="text"
                    id="facebookName"
                    className="input"
                    value={facebookName}
                    onChange={(e) => setFacebookName(e.target.value)}
                    placeholder="e.g., John Doe"
                    required
                    disabled={isLoading}
                  />
                </div>
                <button type="submit" disabled={isLoading} className="btn btn-primary btn-full-width">
                  {isLoading ? 'Generating...' : 'Generate Username'}
                </button>
              </form>
              {message.text && (
                <div className={`alert mt-md ${message.type === 'success' ? 'alert-success' : 'alert-danger'}`}>
                  {message.text}
                </div>
              )}
              {generatedUsername && (
                <div className="result-container mt-lg">
                  <h2 className="result-title">Generated Username:</h2>
                  <p className="username-display">{generatedUsername}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}