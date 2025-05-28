// src/pages/index.js
import React from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import PaymentForm from '../components/PaymentForm';

export default function Home() {
  return (
    <>
      <Header /> {/* Global Header */}

      <main>
        {/* Hero Section - Main content of the home page */}
        <section className="hero-section container mt-xl"> {/* Added mt-xl for top margin */}
          <div className="card">
            <h1 className="card-header">🎣 Lucky Paw’s Fishing Room</h1>
            <div className="text-center mb-lg">
              <p className="text-light" style={{ fontSize: '1.1rem', margin: '0 0 var(--spacing-sm) 0' }}>
                Top up your balance for thrilling fishing games!
              </p>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-light)' }}>
                Secure and instant payments via Bitcoin Lightning.
              </p>
            </div>

            {/* The main Payment Form section, now a separate component */}
            <PaymentForm />
          </div>
        </section>

        {/* You can add more simple, static sections here if desired,
            but we're keeping it minimal as requested.
            E.g., a small "Why choose us?" or "Game highlights" section if not too detailed. */}
      </main>

      <Footer /> {/* Global Footer */}
    </>
  );
}