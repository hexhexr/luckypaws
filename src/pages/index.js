// src/pages/index.js
import React, { useRef, useEffect } from 'react';
import Head from 'next/head';
import Header from '../components/Header';
import Footer from '../components/Footer';
import PaymentForm from '../components/PaymentForm';

export default function Home() {
  const paymentFormRef = useRef(null);

  // This function is still used for the "Get Started" button
  const scrollToPayment = () => {
    if (paymentFormRef.current) {
      paymentFormRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  // This hook runs once when the page loads
  useEffect(() => {
    // A small delay ensures the page is fully rendered before we scroll
    const timer = setTimeout(() => {
      if (paymentFormRef.current) {
        // Scroll the payment form section into the middle of the view
        paymentFormRef.current.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });

        // Find the first input field (username) within the form and focus it
        const firstInput = paymentFormRef.current.querySelector('input[name="username"]');
        if (firstInput) {
          // The preventScroll option stops the page from jumping again after the initial scroll
          firstInput.focus({ preventScroll: true });
        }
      }
    }, 100); // 100ms delay

    // Clean up the timer if the user navigates away before it fires
    return () => clearTimeout(timer);
  }, []); // The empty array means this effect only runs on the initial render

  return (
    <>
      <Head>
        <title>Lucky Paw's Fishing Room - Top Up & Play</title>
        <meta name="description" content="Top up your balance for thrilling online fishing games with instant Bitcoin Lightning and PYUSD payments." />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <Header />

      <main className="main-content">
        {/* Hero Section */}
        <section className="hero-section text-center">
          <div className="container">
            <h1 className="hero-title">Welcome to Lucky Paw's Fishing Room</h1>
            <p className="hero-subtitle">
              Experience our uniquely reliable and secure payment gateway. We offer a fast, seamless deposit process so you can get in the game instantly.
            </p>
            <div className="hero-cta-buttons">
              <button onClick={scrollToPayment} className="btn btn-primary btn-large">Deposit Now</button>
              <a href="/games" className="btn btn-secondary btn-large">View Games</a>
            </div>
          </div>
        </section>

        {/* Payment Form Section */}
        <section id="payment-form-section" className="payment-section" ref={paymentFormRef}>
          <div className="container" style={{maxWidth: '700px'}}>
             <PaymentForm />
          </div>
        </section>

        {/* Features Section */}
        <section className="features-section">
          <div className="container">
            <h2 className="section-title text-center">Why You'll Love Lucky Paw's</h2>
            <div className="feature-grid">
              <div className="feature-item">
                <div className="feature-icon">⚡</div>
                <h3 className="feature-title">Instant Payments</h3>
                <p className="feature-description">Use Bitcoin Lightning or PYUSD for fast and secure account top-ups.</p>
              </div>
              <div className="feature-item">
                <div className="feature-icon">🎮</div>
                <h3 className="feature-title">Exciting Games</h3>
                <p className="feature-description">Explore a wide variety of engaging fishing games with huge rewards.</p>
              </div>
              <div className="feature-item">
                <div className="feature-icon">🔒</div>
                <h3 className="feature-title">Secure and Fair</h3>
                <p className="feature-description">We prioritize the security of your transactions and the fairness of our games.</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />

      <style jsx>{`
        .hero-section {
          padding: var(--spacing-xxl) 0;
        }
        .hero-title {
            font-weight: 800; /* Bolder font */
            font-size: 3.5rem;
            letter-spacing: -1px;
        }
        .hero-subtitle {
            font-size: 1.25rem;
            color: #9ca3af; /* Softer gray */
            max-width: 600px;
            margin-top: var(--spacing-sm);
            margin-left: auto; /* FIX: This centers the text block */
            margin-right: auto; /* FIX: This centers the text block */
        }
        .hero-cta-buttons {
            margin-top: var(--spacing-lg);
            display: flex;
            justify-content: center;
            gap: var(--spacing-md);
        }
        .payment-section, .features-section {
            padding: var(--spacing-xxl) var(--spacing-md);
        }
        .features-section {
             border-top: 1px solid rgba(255, 255, 255, 0.1);
        }
        .feature-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: var(--spacing-lg);
            margin-top: var(--spacing-xl);
        }
        .feature-item {
            text-align: center;
            padding: var(--spacing-lg);
            background: rgba(17, 24, 39, 0.5); /* Dark card background */
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: var(--border-radius-md);
        }
        .feature-icon {
            font-size: 2.5rem;
            margin-bottom: var(--spacing-md);
            color: var(--primary-blue);
        }
        .feature-title {
            font-size: 1.4rem;
            margin-bottom: var(--spacing-sm);
        }
        .feature-description {
            color: #9ca3af; /* Softer gray */
        }
      `}</style>
    </>
  );
}