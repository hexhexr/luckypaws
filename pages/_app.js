// pages/_app.js
import '../styles/globals.css';
// If you want to use Roboto, import it like this:
// import { Roboto } from '@next/font/google';

// const roboto = Roboto({
//   weight: ['400', '500', '700'], // Specify weights you need
//   subsets: ['latin'],
//   variable: '--font-family-base', // Link to your CSS variable
// });

function MyApp({ Component, pageProps }) {
  // If using Roboto from @next/font, you'd add className={roboto.variable} to your root element (e.g., <body> or <div>)
  return (
    // <main className={roboto.variable}> // Uncomment this if you use @next/font
    <Component {...pageProps} />
    // </main>
  );
}

export default MyApp;