// src/components/Header.js
import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';

export default function Header() {
  const [isNavOpen, setIsNavOpen] = useState(false);

  return (
    <header className="main-header">
      <div className="container header-content">
        <Link href="/" className="logo-link">
          <Image 
            src="/logo.png"
            alt="Lucky Paw's Fishing Room Logo"
            width={40}
            height={40}
            className="logo-icon"
            priority
          />
          <span className="logo-text">Lucky Paw's Fishing Room</span>
        </Link>
        <button className={`menu-toggle ${isNavOpen ? 'open' : ''}`} onClick={() => setIsNavOpen(!isNavOpen)} aria-label="Toggle menu">
          <span></span>
          <span></span>
          <span></span>
        </button>
        <nav className={`main-nav ${isNavOpen ? 'open' : ''}`}>
          <ul>
            <li><Link href="/">Home</Link></li>
            <li><Link href="/games">Games</Link></li>
            <li><Link href="/faq">How to Play/FAQ</Link></li>
            <li><Link href="/contact">Contact</Link></li>
          </ul>
        </nav>
      </div>
      <style jsx>{`
        .main-header {
            position: sticky;
            top: 0;
            z-index: 1000;
            background-color: rgba(17, 24, 39, 0.5); /* Semi-transparent dark bg */
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            padding: var(--spacing-sm) 0;
        }
        .header-content {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .logo-link {
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
        }
        .logo-text {
            color: var(--text-white);
            font-weight: 600;
            font-size: 1.1rem;
        }
        .main-nav ul {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          gap: var(--spacing-lg);
          align-items: center;
        }
        .main-nav a {
            padding: var(--spacing-sm) 0;
            position: relative;
            color: #d1d5db; /* Light gray for nav links */
            font-weight: 500;
            transition: color 0.2s ease;
        }
        .main-nav a:hover {
            color: var(--text-white);
        }

        /* --- Mobile Navigation Styles --- */
        @media (max-width: 768px) {
          .main-nav {
            display: none; /* Hide nav by default on mobile */
            position: absolute;
            top: 100%; /* Position it right below the header */
            left: 0;
            width: 100%;
            background-color: #1f2937; /* A solid background for the dropdown */
            padding: var(--spacing-md);
            box-shadow: var(--shadow-lg);
          }
          .main-nav.open {
            display: flex; /* Show the nav when open */
            flex-direction: column;
          }
          .main-nav ul {
            flex-direction: column;
            width: 100%;
            align-items: flex-start;
          }
        }
      `}</style>
    </header>
  );
}