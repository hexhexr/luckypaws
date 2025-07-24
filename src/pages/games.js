// src/pages/games.js
import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Header from '../components/Header';
import Footer from '../components/Footer';
import Link from 'next/link';

const allGamesData = [
    { name: 'Fire Kirin', links: [ { type: 'Play Online', url: 'http://web.firekirin.xyz/firekirin/firekirin/' }, { type: 'Android', url: 'https://drive.google.com/file/d/1oEjL-Uc5xywDaUhgS4pj7_b25bRjwl8-/view?usp=drivesdk' }, { type: 'IOS', url: 'http://web.firekirin.xyz/firekirin/firekirin/' }, ], },
    { name: 'Panda Master', links: [{ type: 'Play Online', url: 'https://pandamaster.vip:8888/index.html' }], },
    { name: 'Game Vault', links: [], }, // Added new game
    { name: 'Juwa', links: [ { type: 'Android', url: 'https://dl.juwa777.com/' }, { type: 'IOS', url: 'https://dl.juwa777.com/' }, ], },
    { name: 'VBlink', links: [{ type: 'Play Online', url: 'https://www.vblink777.club/' }], },
    { name: 'Milky Way', links: [{ type: 'Play Online', url: 'https://milkywayapp.xyz/' }], },
    { name: 'Ultra Panda', links: [{ type: 'Play Online', url: 'https://ultrapanda.mobi' }], },
    { name: 'Vegas Sweeps', links: [], }, // Added new game
    { name: 'Game Room', links: [{ type: 'Play Online', url: 'http://www.gameroom777.com/m' }], },
    { name: 'Yolo', links: [{ type: 'Play Online', url: 'https://yolo777.game/' }], },
    { name: 'Cash Machine', links: [], }, // Added new game
    { name: 'Orion Stars', links: [{ type: 'Play Online', url: 'http://orionstars.vip:8580/index.html' }], },
    { name: 'Golden Dragon', links: [{ type: 'Play Online', url: 'https://playgd.mobi/' }], },
    { name: 'Ultra Monster', links: [{ type: 'Play Online', url: 'https://www.ultrapanda.mobi/' }], },
    { name: 'Kraken', links: [{ type: 'Play Online', url: 'https://getthekraken.com/' }], },
    { name: 'Skill TX', links: [{ type: 'Play Online', url: 'https://skilltx.com/' }], },
    { name: 'Blue Dragon', links: [{ type: 'Play Online', url: 'http://app.bluedragon777.com/' }], },
    { name: 'E Game', links: [{ type: 'Play Online', url: 'https://www.egame99.club/' }], },
    { name: 'V Power', links: [{ type: 'Play Online', url: 'https://www.vpower777.com/' }], },
    { name: 'Vegas X', links: [{ type: 'Android', url: 'https://play.google.com/store/apps/details?id=lol.gapi.vxgames' }], },
    { name: 'Fire Hunt', links: [{ type: 'Play Online', url: 'https://firehunt.games' }], },
    { name: 'Osiris X', links: [{ type: 'Play Online', url: 'https://osirisxgames.com/' }], },
    { name: 'Galaxy', links: [{ type: 'Play Online', url: 'https://www.galaxyworld99.com/' }], },
    { name: 'Golden City', links: [{ type: 'Play Online', url: 'http://www.goldentreasure.live' }], },
    { name: 'Touch O Luck', links: [{ type: 'Play Online', url: 'http://toucholuck.cc:8580/index.html' }], },
    { name: 'Ignite', links: [{ type: 'Play Online', url: 'http://playignite.games/' }], },
    { name: 'Highstakes', links: [{ type: 'Play Online', url: 'http://dl.highstakesweeps.com' }], },
    { name: 'Noble', links: [{ type: 'Play Online', url: 'http://web.noble777.com:8008/m' }], },
    { name: 'Golden Treasure', links: [{ type: 'Play Online', url: 'http://www.goldentreasure.mobi/' }], },
    { name: 'Vegas Strip', links: [{ type: 'Play Online', url: 'https://www.vsgames777.com/login' }], },
    { name: 'Lucky Master', links: [{ type: 'Play Online', url: 'https://lucky-master.net/' }], },
    { name: 'River Sweeps', links: [{ type: 'Play Online', url: 'http://river777.net/' }], },
    { name: 'King Kong', links: [{ type: 'Play Online', url: 'http://www.playgdt.top/' }], },
    { name: 'Orion Power', links: [{ type: 'Play Online', url: 'http://download.orionpower.games:8008' }], },
    { name: 'Majik Bonus', links: [{ type: 'Play Online', url: 'https://99.100bonus.me/' }], },
    { name: 'Magic City', links: [{ type: 'Play Online', url: 'https://www.magiccity777.com/' }], },
    { name: 'Apollo', links: [{ type: 'Android', url: 'http://m.apollo717.com/' }], },
    { name: 'Golden Dragon 2', links: [{ type: 'Play Online', url: 'http://goldendragon2.games' }], },
    { name: 'Mega Spin', links: [{ type: 'Play Online', url: 'http://okay.megaspin.vip/web_game/ms/' }], },
    { name: 'Lucky Dragon', links: [{ type: 'Play Online', url: 'https://lucky-dragon.net/' }], },
];

const topGameNames = [
    'Fire Kirin', 'Panda Master', 'Game Vault', 'Juwa', 'VBlink', 'Milky Way', 
    'Ultra Panda', 'Vegas Sweeps', 'Game Room', 'Yolo', 'Cash Machine', 'Orion Stars'
];

const topGames = allGamesData.filter(game => topGameNames.includes(game.name));
const otherGames = allGamesData.filter(game => !topGameNames.includes(game.name));

// A component to handle image loading with a fallback
const GameImage = ({ gameName }) => {
    const [imgSrc, setImgSrc] = useState(`/game-images/${gameName}.png`);
    const [hasError, setHasError] = useState(false);

    useEffect(() => {
        setImgSrc(`/game-images/${gameName}.png`);
        setHasError(false);
    }, [gameName]);

    const handleError = () => {
        setHasError(true);
    };

    if (hasError) {
        return <div className="game-card-name-placeholder">{gameName}</div>;
    }

    // eslint-disable-next-line @next/next/no-img-element
    return <img src={imgSrc} alt={`${gameName} logo`} onError={handleError} />;
};


export default function GamesPage() {
    const [copiedLink, setCopiedLink] = useState(null);

    const handleCopy = (url) => {
        navigator.clipboard.writeText(url);
        setCopiedLink(url);
        setTimeout(() => setCopiedLink(null), 2000);
    };
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
              Ready to play? Our secure and reliable payment processing ensures your funds are available instantly. Top up fast and get right to the action.
            </p>
            <Link href="/#payment-form-section" className="btn btn-primary btn-large">
              Deposit Now
            </Link>
          </div>
        </section>

        {/* Top Games Section */}
        <section className="games-grid-section section-padded" style={{paddingTop: 'var(--spacing-xl)'}}>
          <div className="container">
            <h2 className="section-title text-center">Top Games</h2>
            <div className="games-grid">
              {topGames.map((game, index) => (
                <div key={index} className="game-card">
                  <div className="game-card-image">
                    <GameImage gameName={game.name} />
                  </div>
                  <div className="game-card-actions">
                    {game.links.length > 0 ? game.links.map((link, linkIndex) => (
                        <div key={linkIndex} className="game-card-action">
                            <a
                                href={link.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn-primary btn-xsmall"
                            >
                                {link.type}
                            </a>
                            <button
                                onClick={() => handleCopy(link.url)}
                                className="btn btn-secondary btn-xsmall"
                            >
                                {copiedLink === link.url ? 'Copied!' : 'Copy'}
                            </button>
                        </div>
                    )) : <p className="no-links-message">Coming Soon</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Other Games Section */}
        <section className="games-grid-section section-padded">
          <div className="container">
            <h2 className="section-title text-center">Other Games</h2>
            <div className="games-grid">
              {otherGames.map((game, index) => (
                <div key={index} className="game-card">
                  <div className="game-card-image">
                    <GameImage gameName={game.name} />
                  </div>
                  <div className="game-card-actions">
                    {game.links.length > 0 ? game.links.map((link, linkIndex) => (
                        <div key={linkIndex} className="game-card-action">
                            <a
                                href={link.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn-primary btn-xsmall"
                            >
                                {link.type}
                            </a>
                            <button
                                onClick={() => handleCopy(link.url)}
                                className="btn btn-secondary btn-xsmall"
                            >
                                {copiedLink === link.url ? 'Copied!' : 'Copy'}
                            </button>
                        </div>
                    )) : <p className="no-links-message">Coming Soon</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <Footer />
      <style jsx>{`
        .games-grid-section {
          padding-top: var(--spacing-xl);
        }
        .games-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
          gap: var(--spacing-md);
        }
        .game-card {
          background: rgba(17, 24, 39, 0.8);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: var(--border-radius-md);
          overflow: hidden;
          display: flex;
          flex-direction: column;
          transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        .game-card:hover {
            transform: translateY(-5px);
            box-shadow: var(--shadow-lg);
        }
        .game-card-image {
          height: 120px;
          display: flex;
          align-items: center;
          justify-content: center;
          background-color: #000;
          padding: var(--spacing-sm);
        }
        .game-card-image img {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }
        .game-card-name-placeholder {
            color: #fff;
            font-size: 1rem;
            font-weight: bold;
            text-align: center;
            padding: var(--spacing-sm);
        }
        .game-card-actions {
          padding: var(--spacing-sm);
          display: flex;
          flex-direction: column;
          gap: var(--spacing-xs);
          flex-grow: 1; /* Allows content to fill space */
          justify-content: center; /* Center content vertically */
        }
        .game-card-action {
            display: grid;
            grid-template-columns: 1fr auto;
            gap: var(--spacing-xs);
        }
        .no-links-message {
            color: var(--text-light);
            font-size: 0.9rem;
            text-align: center;
            margin: auto 0;
        }
      `}</style>
    </>
  );
}