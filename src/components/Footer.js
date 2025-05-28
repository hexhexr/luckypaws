// src/components/Footer.js
import React from 'react';
import Link from 'next/link'; // Assuming Next.js for client-side routing

export default function Footer() {
  return (
    <footer className="main-footer mt-xl">
      <div className="container footer-content">
        <div className="footer-section brand-info">
          <h3>Lucky Paw's Fishing Room</h3>
          <p>Your premier destination for thrilling online fishing games with instant Bitcoin Lightning top-ups.</p>
          <div className="social-links">
            {/* Replace with actual social media icons/links. You might need Font Awesome or similar library. */}
            <a href="#" aria-label="Facebook"><i className="fab fa-facebook-f"></i></a>
            <a href="#" aria-label="Twitter"><i className="fab fa-twitter"></i></a>
            <a href="#" aria-label="Instagram"><i className="fab fa-instagram"></i></a>
          </div>
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
      <div className="footer-bottom">
        <div className="container text-center">
          <p>&copy; {new Date().getFullYear()} Lucky Paw's Fishing Room. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}