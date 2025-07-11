// src/components/Footer.js
import React from 'react';
import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="main-footer" style={{backgroundColor: 'var(--text-dark)', color: 'var(--bg-light)'}}>
      <div className="container" style={{paddingTop: 'var(--spacing-xl)', paddingBottom: 'var(--spacing-xl)'}}>
        <div className="footer-grid">
            <div className="footer-section brand-info">
              <h4 style={{color: 'var(--text-white)'}}>Lucky Paw's Fishing Room</h4>
              <p>Your premier destination for thrilling online fishing games with instant Bitcoin Lightning & PYUSD top-ups.</p>
            </div>
            <div className="footer-section quick-links">
              <h4 style={{color: 'var(--text-white)'}}>Quick Links</h4>
              <ul>
                <li><Link href="/">Home</Link></li>
                <li><Link href="/games">Games</Link></li>
                <li><Link href="/faq">FAQ</Link></li>
                <li><Link href="/contact">Contact</Link></li>
              </ul>
            </div>
            <div className="footer-section legal-links">
              <h4 style={{color: 'var(--text-white)'}}>Legal</h4>
              <ul>
                <li><Link href="/privacy">Privacy Policy</Link></li>
                <li><Link href="/terms">Terms of Service</Link></li>
              </ul>
            </div>
        </div>
      </div>
      <div className="footer-bottom" style={{background: 'rgba(0,0,0,0.2)', padding: 'var(--spacing-md) 0'}}>
        <div className="container text-center">
          <p style={{margin: 0, fontSize: '0.9rem'}}>&copy; {new Date().getFullYear()} Lucky Paw's Fishing Room. All rights reserved.</p>
        </div>
      </div>
      <style jsx>{`
        .footer-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: var(--spacing-lg);
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
            color: var(--bg-medium-light);
            text-decoration: none;
        }
        .footer-section a:hover {
            color: var(--primary-green);
            text-decoration: underline;
        }
      `}</style>
    </footer>
  );
}