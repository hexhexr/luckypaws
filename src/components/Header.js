// src/components/Header.js
import React from 'react';
import Link from 'next/link';

export default function Header() {
  return (
    <header className="main-header">
      <div className="container header-content">
        <Link href="/" className="logo-link">
          <span className="logo-icon">🎣</span>
          <span className="logo-text">Lucky Paw's Fishing Room</span>
        </Link>
        <nav className="main-nav">
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