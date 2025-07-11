// src/pages/index.js
import React, { useRef } from 'react';
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
        <meta name="description" content="Top up your balance for thrilling online fishing games with instant Bitcoin Lightning and PYUSD payments." />
        <link rel="icon" href="/favicon.ico" />
        <meta property="og:title" content="Lucky Paw's Fishing Room" />
        <meta property="og:description" content="Top up your balance for thrilling online fishing games with instant Bitcoin Lightning and PYUSD payments." />
        <meta property="og:image" content="/logo-preview.png" />
        <meta property="og:url" content="https://luckypawsfishingroom.com" />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Lucky Paw's Fishing Room" />
        <meta name="twitter:description" content="Top up your balance for thrilling online fishing games." />
        <meta name="twitter:image" content="/logo-preview.png" />
      </Head>

      <Header />

      <main className="main-content">
        {/* Hero Section */}
        <section className="hero-section text-center section-padded">
          <div className="container">
            <h1 className="section-title">Welcome to Lucky Paw's Fishing Room</h1>
            <p className="section-subtitle">
              Your premier destination for exciting online fishing games. Top up your account instantly and start playing today!
            </p>
            <div className="hero-cta-buttons">
              <button onClick={scrollToPayment} className="btn btn-primary btn-large">Get Started</button>
              <a href="/games" className="btn btn-secondary btn-large">View Games</a>
            </div>
          </div>
        </section>

        {/* Payment Form Section */}
        <section id="payment-form-section" className="section-padded" ref={paymentFormRef}>
          <div className="container" style={{maxWidth: '700px'}}>
             <PaymentForm />
          </div>
        </section>

        {/* Features Section */}
        <section className="features-section section-padded" style={{backgroundColor: 'var(--bg-medium-light)'}}>
          <div className="container">
            <h2 className="section-title text-center" style={{marginBottom: 'var(--spacing-xl)'}}>Why You'll Love Lucky Paw's</h2>
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
    </>
  );
}

// Add some basic styles for the new sections if they don't exist
// This can be in your globals.css or in a style tag here for simplicity
const styles = `
.hero-section {
  background: var(--bg-light);
  padding: var(--spacing-xxl) 0;
}
.hero-title {
    font-weight: 700;
}
.hero-subtitle {
    font-size: 1.25rem;
    max-width: 800px;
}
.hero-cta-buttons {
    margin-top: var(--spacing-lg);
    display: flex;
    justify-content: center;
    gap: var(--spacing-md);
}
.feature-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: var(--spacing-lg);
}
.feature-item {
    text-align: center;
    padding: var(--spacing-lg);
    background: var(--card-bg);
    border-radius: var(--border-radius-md);
    box-shadow: var(--shadow-sm);
}
.feature-icon {
    font-size: 3rem;
    margin-bottom: var(--spacing-md);
}
.feature-title {
    font-size: 1.5rem;
    margin-bottom: var(--spacing-sm);
}
`;
// In a real app, you'd add the above styles to your main CSS file.