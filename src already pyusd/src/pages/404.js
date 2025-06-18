// src/pages/404.js
import Link from 'next/link';
import Head from 'next/head';
import Header from '../components/Header';
import Footer from '../components/Footer';

export default function Custom404() {
  return (
    <>
      <Head>
        <title>404 - Page Not Found</title>
      </Head>
      <Header />
      <main className="main-content container text-center section-padded">
        <h1 className="section-title">404 - Page Not Found</h1>
        <p className="section-subtitle">
          Oops! The page you are looking for does not exist. It might have been moved or deleted.
        </p>
        <Link href="/" className="btn btn-primary btn-large">
            Go Back Home
        </Link>
      </main>
      <Footer />
    </>
  );
}