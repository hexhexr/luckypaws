// src/components/Header.js
import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';

export default function Header() {
  const [isNavOpen, setIsNavOpen] = useState(false);

  return (
    <header className="main-header" style={{position: 'sticky', top: 0, zIndex: 1000, backgroundColor: 'var(--card-bg)'}}>
      <div className="container header-content">
        <Link href="/" className="logo-link">
          <Image 
            src="/logo.png"
            alt="Lucky Paw's Fishing Room Logo"
            width={40}
            height={40}
            className="logo-icon"
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
    </header>
  );
}