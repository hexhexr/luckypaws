// src/pages/index.js
import React, { useEffect, useRef } from 'react';
import Head from 'next/head';
import Header from '../components/Header';
import Footer from '../components/Footer';
// import PaymentForm from '../components/PaymentForm'; // <--- REMOVE THIS LINE
import dynamic from 'next/dynamic'; // <--- ADD THIS LINE

// Dynamically import PaymentForm, ensuring it only renders on the client-side
const PaymentForm = dynamic(() => import('../components/PaymentForm'), { ssr: false }); // <--- ADD THIS LINE

export default function Home() {
  const paymentFormRef = useRef(null);

  useEffect(() => {
    // Scroll to the payment form section on page load
    // This part should also be client-side only
    if (typeof window !== 'undefined' && paymentFormRef.current) { // Add window check
      paymentFormRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

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
              <a href="#payment-form-section" className="btn btn-primary btn-large">Top Up Now!</a>
              <a href="/games" className="btn btn-secondary btn-large">Explore Games</a>
            </div>
          </div>
        </section>

        {/* Payment Form Section (will render client-side) */}
        <section id="payment-form-section" ref={paymentFormRef} className="section-padded">
          <PaymentForm />
        </section>

        {/* Features Section */}
        <section className="features-section section-padded bg-medium-light">
          <div className="container">
            <h2 className="section-title text-center">Why Choose Lucky Paw's?</h2>
            <div className="feature-grid">
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
              <div className="feature-item">
                <div className="feature-icon">🤝</div>
                <h3 className="feature-title">24/7 Support</h3>
                <p className="feature-description">Our dedicated support team is always ready to assist you.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Call to Action Section (Optional, can be removed if hero is enough) */}
        <section className="cta-section text-center section-padded">
          <div className="container">
            <h2 className="section-title">Ready to Catch Big Wins?</h2>
            <p className="section-subtitle">Join the Lucky Paw's community today!</p>
            <a href="#payment-form-section" className="btn btn-primary btn-large">Get Started Now</a>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}