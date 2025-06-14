import React from 'react';
import Head from 'next/head';
import Header from '../components/Header'; // Assuming you have a Header component
import Footer from '../components/Footer'; // Assuming you have a Footer component
// FIX: Import firebaseAdmin to fetch data on the server-side.
// Note: In a real project, you'd use the client SDK if fetching on the client, 
// but for getServerSideProps, the admin SDK is fine if the page is part of the same project.
// Let's assume there's a client-side library for this purpose.
import { db } from '../lib/firebaseAdmin'; // Using admin for server-side fetch

// FIX: The hardcoded gamesData array is now removed and will be fetched dynamically.

export default function GamesPage({ gamesData }) { // Receive gamesData as a prop
  return (
    <>
      <Head>
        <title>Game Links - Lucky Paw's Fishing Room</title>
        <meta name="description" content="Access all your favorite game links in one place." />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <Header />

      <main className="main-content">
        <section className="section-padded text-center">
          <div className="container">
            <h1 className="section-title">Our Exciting Game Collection</h1>
            <p className="section-subtitle">
              Find and access links for all your favorite games below.
            </p>
          </div>
        </section>

        <section className="games-sheet-section section-padded bg-light-gradient">
          <div className="container">
            <div className="game-list-container card"> {/* Using card for a nice border/shadow */}
              <div className="game-list-header">
                <div className="game-name-col">Game Name</div>
                <div className="game-links-col">Links</div>
              </div>
              <div className="game-list-body">
                {/* FIX: Map over the dynamically fetched gamesData prop */}
                {gamesData.map((game) => (
                  <div key={game.id} className="game-list-item">
                    <div className="game-name-col">{game.name}</div>
                    <div className="game-links-col">
                      {/* This assumes a 'links' array exists in your Firestore doc.
                          You may need to adjust this based on your actual data structure. */}
                      {game.links && game.links.map((link, linkIndex) => (
                        <a
                          key={linkIndex}
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-secondary btn-xsmall"
                        >
                          {link.type}
                        </a>
                      ))}
                      {/* Fallback for simple link structure */}
                      {!game.links && game.url && (
                         <a
                          href={game.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-secondary btn-xsmall"
                        >
                          Play Online
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}

// FIX: Add getServerSideProps to fetch the game list from Firestore at request time.
export async function getServerSideProps() {
  try {
    const gamesCollectionRef = db.collection('games');
    const snapshot = await gamesCollectionRef.orderBy('name').get();
    
    if (snapshot.empty) {
      return { props: { gamesData: [] } };
    }
    
    const gamesData = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name,
        // This part is an assumption of your data structure.
        // If your game doc just has a name, this is fine. 
        // If it has a URL or an array of links, you'd include them here.
        // For example, if you stored links in a 'links' field:
        // links: data.links || [{ type: 'Play Online', url: '#' }] 
      };
    });

    return {
      props: {
        gamesData,
      },
    };
  } catch (error) {
    console.error("Failed to fetch games for SSR:", error);
    return {
      props: {
        gamesData: [], // Return empty array on error
      },
    };
  }
}