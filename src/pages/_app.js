// pages/_app.js
import '../src/lib/firebaseClient'; // <--- ADD THIS LINE TO INITIALIZE CLIENT-SIDE FIREBASE

import React from 'react';
import App from 'next/app';
// import any other global CSS or components you might have

class MyApp extends App {
  render() {
    const { Component, pageProps } = this.props;
    return <Component {...pageProps} />;
  }
}

export default MyApp;