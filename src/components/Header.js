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
            <li><Link href="/contact">Contact Us</Link></li>
          </ul>
        </nav>
      </div>
      <style jsx>{`
        .main-header {
            position: sticky;
            top: 0;
            z-index: 1000;
            background-color: var(--card-bg);
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }
        .logo-text {
            color: var(--text-dark);
            font-weight: 600;
        }
        .main-nav a {
            padding: var(--spacing-sm) 0;
            position: relative;
        }
        .main-nav a::after {
            content: '';
            position: absolute;
            width: 0;
            height: 2px;
            bottom: 0;
            left: 0;
            background-color: var(--primary-green);
            transition: width 0.3s ease;
        }
        .main-nav a:hover::after {
            width: 100%;
        }
      `}</style>
    </header>
  );
}