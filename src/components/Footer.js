// src/components/Footer.js
import React from 'react';
import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="main-footer">
      <div className="container">
        <div className="footer-grid">
            <div className="footer-section brand-info">
              <h4>Lucky Paw's Fishing Room</h4>
              <p>Your premier destination for thrilling online fishing games with instant Bitcoin Lightning & PYUSD top-ups.</p>
            </div>
            <div className="footer-section quick-links">
              <h4>Quick Links</h4>
              <ul>
                <li><Link href="/">Home</Link></li>
                <li><Link href="/games">Games</Link></li>
                <li><Link href="/faq">FAQ</Link></li>
                <li><Link href="/contact">Contact</Link></li>
              </ul>
            </div>
            <div className="footer-section legal-links">
              <h4>Legal</h4>
              <ul>
                <li><Link href="/privacy">Privacy Policy</Link></li>
                <li><Link href="/terms">Terms of Service</Link></li>
              </ul>
            </div>
        </div>
      </div>
      <div className="footer-bottom">
        <div className="container text-center">
          <p>&copy; {new Date().getFullYear()} Lucky Paw's Fishing Room. All rights reserved.</p>
        </div>
      </div>
      <style jsx>{`
        .main-footer {
            background-color: #ffffff;
            color: var(--text-light);
            padding-top: var(--spacing-xl);
        }
        .footer-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: var(--spacing-lg);
            padding-bottom: var(--spacing-xl);
        }
        .footer-section h4 {
            color: var(--text-dark);
            font-weight: 600;
        }
        .footer-section p {
            font-size: 0.95rem;
        }
        .footer-section ul {
            list-style: none;
            padding: 0;
            margin: 0;
        }
        .footer-section li {
            margin-bottom: var(--spacing-sm);
        }
        .footer-section a {
            color: var(--text-secondary);
            text-decoration: none;
        }
        .footer-section a:hover {
            color: var(--primary-green);
            text-decoration: underline;
        }
        .footer-bottom {
            background: var(--bg-light);
            padding: var(--spacing-md) 0;
            border-top: 1px solid var(--border-color);
        }
        .footer-bottom p {
            margin: 0;
            font-size: 0.9rem;
        }
      `}</style>
    </footer>
  );
}