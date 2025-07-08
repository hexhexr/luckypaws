// src/components/Header.js
import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image'; // Import the Next.js Image component

export default function Header() {
  const [isNavOpen, setIsNavOpen] = useState(false);

  return (
    <header className="main-header">
      <div className="container header-content">
        <Link href="/" className="logo-link">
          {/* Use the Image component for your logo */}
          <Image 
            src="/logo.png" // Assumes your logo is named logo.png in the public folder
            alt="Lucky Paw's Fishing Room Logo"
            width={40} // Specify the width
            height={40} // Specify the height
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