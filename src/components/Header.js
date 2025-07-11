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
        .logo-text {
            color: var(--text-white);
            font-weight: 600;
            font-size: 1.1rem;
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
        .menu-toggle span {
            background-color: var(--text-white);
        }
      `}</style>
    </header>
  );
}