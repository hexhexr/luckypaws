import React from 'react';
import Head from 'next/head';
import Header from '../components/Header'; // Assuming you have a Header component
import Footer from '../components/Footer'; // Assuming you have a Footer component

// Hardcoded game data based on the links you provided
const gamesData = [
  {
    name: 'Fire Kirin',
    links: [
      { type: 'Play Online', url: 'http://web.firekirin.xyz/firekirin/firekirin/' },
      { type: 'Android', url: 'https://drive.google.com/file/d/1oEjL-Uc5xywDaUhgS4pj7_b25bRjwl8-/view?usp=drivesdk' },
      { type: 'IOS', url: 'http://web.firekirin.xyz/firekirin/firekirin/' },
    ],
  },
  {
    name: 'JUWA',
    links: [
      { type: 'Android', url: 'https://dl.juwa777.com/' },
      { type: 'IOS', url: 'https://dl.juwa777.com/' },
    ],
  },
  {
    name: 'Golden Dragon',
    links: [{ type: 'Play Online', url: 'https://playgd.mobi/' }],
  },
  {
    name: 'Ultra Monster',
    links: [{ type: 'Play Online', url: 'https://www.ultrapanda.mobi/' }],
  },
  {
    name: 'Kraken',
    links: [{ type: 'Play Online', url: 'https://getthekraken.com/' }],
  },
  {
    name: 'Skill TX',
    links: [{ type: 'Play Online', url: 'https://skilltx.com/' }],
  },
  {
    name: 'Blue Dragon',
    links: [{ type: 'Play Online', url: 'http://app.bluedragon777.com/' }],
  },
  {
    name: 'E Game',
    links: [{ type: 'Play Online', url: 'https://www.egame99.club/' }],
  },
  {
    name: 'V Power',
    links: [{ type: 'Play Online', url: 'https://www.vpower777.com/' }],
  },
  {
    name: 'Vegas X',
    links: [{ type: 'Android', url: 'https://play.google.com/store/apps/details?id=lol.gapi.vxgames' }],
  },
  {
    name: 'Orion Stars',
    links: [{ type: 'Play Online', url: 'http://orionstars.vip:8580/index.html' }],
  },
  {
    name: 'Fire Hunt',
    links: [{ type: 'Play Online', url: 'https://firehunt.games' }],
  },
  {
    name: 'Osiris X',
    links: [{ type: 'Play Online', url: 'https://osirisxgames.com/' }],
  },
  {
    name: 'Galaxy',
    links: [{ type: 'Play Online', url: 'https://www.galaxyworld99.com/' }],
  },
  {
    name: 'Golden City',
    links: [{ type: 'Play Online', url: 'http://www.goldentreasure.live' }],
  },
  {
    name: 'Milky Way',
    links: [{ type: 'Play Online', url: 'https://milkywayapp.xyz/' }],
  },
  {
    name: 'Touch O Luck',
    links: [{ type: 'Play Online', url: 'http://toucholuck.cc:8580/index.html' }],
  },
  {
    name: 'Ignite',
    links: [{ type: 'Play Online', url: 'http://playignite.games/' }],
  },
  {
    name: 'Panda Master',
    links: [{ type: 'Play Online', url: 'https://pandamaster.vip:8888/index.html' }],
  },
  {
    name: 'Highstakes',
    links: [{ type: 'Play Online', url: 'http://dl.highstakesweeps.com' }],
  },
  {
    name: 'Gameroom',
    links: [{ type: 'Play Online', url: 'http://www.gameroom777.com/m' }],
  },
  {
    name: 'Noble',
    links: [{ type: 'Play Online', url: 'http://web.noble777.com:8008/m' }],
  },
  {
    name: 'Golden Treasure',
    links: [{ type: 'Play Online', url: 'http://www.goldentreasure.mobi/' }],
  },
  {
    name: 'Vegas Strip',
    links: [{ type: 'Play Online', url: 'https://www.vsgames777.com/login' }],
  },
  {
    name: 'Lucky Master',
    links: [{ type: 'Play Online', url: 'https://lucky-master.net/' }],
  },
  {
    name: 'River Sweeps',
    links: [{ type: 'Play Online', url: 'http://river777.net/' }],
  },
  {
    name: 'VBlink',
    links: [{ type: 'Play Online', url: 'https://www.vblink777.club/' }],
  },
  {
    name: 'King Kong',
    links: [{ type: 'Play Online', url: 'http://www.playgdt.top/' }],
  },
  {
    name: 'Ultra Panda',
    links: [{ type: 'Play Online', url: 'https://ultrapanda.mobi' }],
  },
  {
    name: 'Orion Power',
    links: [{ type: 'Play Online', url: 'http://download.orionpower.games:8008' }],
  },
  {
    name: 'Majik Bonus',
    links: [{ type: 'Play Online', url: 'https://99.100bonus.me/' }],
  },
  {
    name: 'Magic City',
    links: [{ type: 'Play Online', url: 'https://www.magiccity777.com/' }],
  },
  {
    name: 'Apollo',
    links: [{ type: 'Android', url: 'http://m.apollo717.com/' }],
  },
  {
    name: 'Golden Dragon 2',
    links: [{ type: 'Play Online', url: 'http://goldendragon2.games' }],
  },
  {
    name: 'Mega Spin',
    links: [{ type: 'Play Online', url: 'http://okay.megaspin.vip/web_game/ms/' }],
  },
  {
    name: 'Lucky Dragon',
    links: [{ type: 'Play Online', url: 'https://lucky-dragon.net/' }],
  },
];

export default function GamesPage() {
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
              Click on a game below to get direct links to play online or download for your device.
            </p>
          </div>
        </section>

        <section className="games-grid-section section-padded bg-light-gradient">
          <div className="container">
            <div className="games-grid">
              {gamesData.map((game, index) => (
                <div key={index} className="game-card card">
                  <h3 className="game-title card-header text-center">{game.name}</h3>
                  <div className="card-body game-links">
                    {game.links.map((link, linkIndex) => (
                      <a
                        key={linkIndex}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-secondary btn-small game-link-btn"
                      >
                        {link.type}
                      </a>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}