// src/pages/index.js
import React, { useEffect, useRef } from 'react';
import Head from 'next/head';
import Header from '../components/Header';
import Footer from '../components/Footer';
import PaymentForm from '../components/PaymentForm';

export default function Home() {
  const paymentFormRef = useRef(null);

  const scrollToPayment = () => {
    if (paymentFormRef.current) {
      paymentFormRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <>
      <Head>
        <title>Lucky Paw's Fishing Room - Top Up & Play</title>
        <meta name="description" content="Top up your balance for thrilling online fishing games with instant Bitcoin Lightning payments." />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <Header />

      <main className="main-content">
        {/* Hero Section */}
        <section className="hero-section text-center">
          <div className="container">
            <h1 className="hero-title">Dive into the Action at Lucky Paw's Fishing Room!</h1>
            <p className="hero-subtitle">
              Top up your balance instantly with Bitcoin Lightning and cast your line for big wins.
            </p>
            <div className="hero-cta-buttons">
              <button onClick={scrollToPayment} className="btn btn-primary btn-large">Top Up Now!</button>
              <a href="/games" className="btn btn-secondary btn-large">Explore Games</a>
            </div>
          </div>
        </section>

        {/* Payment Form Section - Anchor for CTA and auto-focus */}
        <section id="payment-form-section" className="section-padded" ref={paymentFormRef}>
          <div className="container" style={{maxWidth: '650px'}}>
             <PaymentForm />
          </div>
        </section>

        {/* Features Section */}
        <section className="features-section section-padded">
          <div className="container">
            <h2 className="section-title text-center mb-xl">Why Choose Lucky Paw's?</h2>
            <div className="feature-grid">
              <div className="feature-item">
                <div className="feature-icon">⚡</div>
                <h3 className="feature-title">Lightning Fast Payments</h3>
                <p className="feature-description">Top up instantly with Bitcoin Lightning. No waiting, just playing!</p>
              </div>
              <div className="feature-item">
                <div className="feature-icon">🎮</div>
                <h3 className="feature-title">Exciting Fishing Games</h3>
                <p className="feature-description">Discover a wide range of captivating fishing games with high payouts.</p>
              </div>
              <div className="feature-item">
                <div className="feature-icon">🔒</div>
                <h3 className="feature-title">Secure & Transparent</h3>
                <p className="feature-description">Your transactions are safe, and your game results are fair.</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}