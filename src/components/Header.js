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
            width={48}
            height={48}
            className="logo-icon"
            priority
          />
          <span className="logo-text">Lucky Paw's Fishing Room</span>
        </Link>
        <button 
          className={`menu-toggle ${isNavOpen ? 'open' : ''}`} 
          onClick={() => setIsNavOpen(!isNavOpen)} 
          aria-label="Toggle menu"
          aria-expanded={isNavOpen}
        >
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
            background-color: rgba(17, 24, 39, 0.85);
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            padding: var(--spacing-md) 0;
        }
        .header-content {
          display: flex;
          align-items: center;
        }
        .logo-link {
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
          z-index: 10; 
          flex-shrink: 0;
        }
        .logo-text {
            color: var(--text-white);
            font-weight: 700;
            font-size: 1.2rem;
            white-space: nowrap;
        }
        
        /* Desktop Navigation */
        .main-nav {
            margin-left: auto; /* This is the key change for alignment */
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
            color: #d1d5db; 
            font-weight: 500;
            transition: color 0.2s ease;
        }
        .main-nav a:hover {
            color: var(--text-white);
        }
        .main-nav a::after {
            content: '';
            position: absolute;
            width: 0;
            height: 2px;
            bottom: 0;
            left: 50%;
            background-color: var(--primary-blue);
            transition: all 0.3s ease-in-out;
            transform: translateX(-50%);
        }
        .main-nav a:hover::after {
            width: 100%;
        }

        /* Mobile Menu Toggle Button */
        .menu-toggle {
          display: none; 
          position: relative;
          z-index: 1001; /* Must be on top of the mobile nav */
          width: 30px;
          height: 25px;
          background: none;
          border: none;
          cursor: pointer;
          margin-left: auto; /* Push it to the right on mobile */
        }
        .menu-toggle span {
          display: block;
          position: absolute;
          width: 100%;
          height: 3px;
          background-color: var(--text-white);
          border-radius: 2px;
          transition: transform 0.3s ease-in-out, opacity 0.3s ease-in-out;
        }
        .menu-toggle span:nth-child(1) { top: 0; }
        .menu-toggle span:nth-child(2) { top: 50%; transform: translateY(-50%); }
        .menu-toggle span:nth-child(3) { bottom: 0; }
        .menu-toggle.open span:nth-child(1) { top: 50%; transform: translateY(-50%) rotate(45deg); }
        .menu-toggle.open span:nth-child(2) { opacity: 0; }
        .menu-toggle.open span:nth-child(3) { bottom: 50%; transform: translateY(50%) rotate(-45deg); }

        /* Mobile Navigation Styles */
        @media (max-width: 768px) {
          .main-nav {
            display: none;
          }
          .main-nav.open {
            display: flex;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100vh;
            background-color: #111827;
            align-items: center;
            justify-content: center;
          }
          .main-nav ul {
            flex-direction: column;
            gap: var(--spacing-xl);
            text-align: center;
          }
          .main-nav a {
            font-size: 1.5rem;
            font-weight: 600;
          }
          .menu-toggle {
            display: block;
          }
        }
      `}</style>
    </header>
  );
}