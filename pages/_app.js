// pages/_app.js
import '../styles/globals.css';
import { Roboto, Roboto_Mono } from '@next/font/google'; // Import Roboto and Roboto Mono

const roboto = Roboto({
  weight: ['400', '500', '700'], // Specify weights you need
  subsets: ['latin'],
  variable: '--font-family-base', // Link to your CSS variable
});

const robotoMono = Roboto_Mono({
  weight: ['400'],
  subsets: ['latin'],
  variable: '--font-family-mono', // Link to your CSS variable
});


function MyApp({ Component, pageProps }) {
  return (
    <main className={`${roboto.variable} ${robotoMono.variable}`}>
      <Component {...pageProps} />
    </main>
  );
}

export default MyApp;