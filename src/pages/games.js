// src/pages/games.js
import React, { useState } from 'react';
import Head from 'next/head';
import Header from '../components/Header';
import Footer from '../components/Footer';
import Link from 'next/link';

const gamesData = [
    { name: 'Fire Kirin', imageUrl: 'https://lookerstudio.google.com/reporting/3d1f0bfb-62ad-43a2-827e-6df2f89fa5a9/page/M01AD', links: [ { type: 'Play Online', url: 'http://web.firekirin.xyz/firekirin/firekirin/' }, { type: 'Android', url: 'https://drive.google.com/file/d/1oEjL-Uc5xywDaUhgS4pj7_b25bRjwl8-/view?usp=drivesdk' }, { type: 'IOS', url: 'http://web.firekirin.xyz/firekirin/firekirin/' }, ], },
    { name: 'JUWA', imageUrl: 'https://i.ytimg.com/vi/a-3_eA-V_JM/maxresdefault.jpg', links: [ { type: 'Android', url: 'https://dl.juwa777.com/' }, { type: 'IOS', url: 'https://dl.juwa777.com/' }, ], },
    { name: 'Golden Dragon', imageUrl: 'https://image.pngaaa.com/582/236582-middle.png', links: [{ type: 'Play Online', url: 'https://playgd.mobi/' }], },
    { name: 'Ultra Monster', imageUrl: null, links: [{ type: 'Play Online', url: 'https://www.ultrapanda.mobi/' }], },
    { name: 'Kraken', imageUrl: 'https://mir-s3-cdn-cf.behance.net/project_modules/max_1200/182415102353323.5f34603294318.jpg', links: [{ type: 'Play Online', url: 'https://getthekraken.com/' }], },
    { name: 'Yolo', imageUrl: null, links: [{ type: 'Play Online', url: 'https://yolo777.game/' }], },
    { name: 'Skill TX', imageUrl: null, links: [{ type: 'Play Online', url: 'https://skilltx.com/' }], },
    { name: 'Blue Dragon', imageUrl: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR8Qy_3_5P4x_2-A6gGg_SAw_u-5e_g_uA&s', links: [{ type: 'Play Online', url: 'http://app.bluedragon777.com/' }], },
    { name: 'E Game', imageUrl: 'https://cdn.logojoy.com/wp-content/uploads/2018/05/30161848/1722.png', links: [{ type: 'Play Online', url: 'https://www.egame99.club/' }], },
    { name: 'V Power', imageUrl: null, links: [{ type: 'Play Online', url: 'https://www.vpower777.com/' }], },
    { name: 'Vegas X', imageUrl: null, links: [{ type: 'Android', url: 'https://play.google.com/store/apps/details?id=lol.gapi.vxgames' }], },
    { name: 'Orion Stars', imageUrl: null, links: [{ type: 'Play Online', url: 'http://orionstars.vip:8580/index.html' }], },
    { name: 'Fire Hunt', imageUrl: null, links: [{ type: 'Play Online', url: 'https://firehunt.games' }], },
    { name: 'Osiris X', imageUrl: null, links: [{ type: 'Play Online', url: 'https://osirisxgames.com/' }], },
    { name: 'Galaxy', imageUrl: 'https://img.freepik.com/premium-vector/galaxy-esport-mascot-logo_177315-189.jpg', links: [{ type: 'Play Online', url: 'https://www.galaxyworld99.com/' }], },
    { name: 'Golden City', imageUrl: 'https://i.pinimg.com/736x/e0/f5/6a/e0f56a0056e30737a2f2677611833512.jpg', links: [{ type: 'Play Online', url: 'http://www.goldentreasure.live' }], },
    { name: 'Milky Way', imageUrl: null, links: [{ type: 'Play Online', url: 'https://milkywayapp.xyz/' }], },
    { name: 'Touch O Luck', imageUrl: null, links: [{ type: 'Play Online', url: 'http://toucholuck.cc:8580/index.html' }], },
    { name: 'Ignite', imageUrl: 'https://cdn2.vectorstock.com/i/1000x1000/01/87/ignite-logo-vector-23710187.jpg', links: [{ type: 'Play Online', url: 'http://playignite.games/' }], },
    { name: 'Panda Master', imageUrl: null, links: [{ type: 'Play Online', url: 'https://pandamaster.vip:8888/index.html' }], },
    { name: 'Highstakes', imageUrl: null, links: [{ type: 'Play Online', url: 'http://dl.highstakesweeps.com' }], },
    { name: 'Gameroom', imageUrl: 'https://img.freepik.com/premium-vector/game-room-logo-design-vector-template_655383-11.jpg', links: [{ type: 'Play Online', url: 'http://www.gameroom777.com/m' }], },
    { name: 'Noble', imageUrl: null, links: [{ type: 'Play Online', url: 'http://web.noble777.com:8008/m' }], },
    { name: 'Golden Treasure', imageUrl: 'https://png.pngtree.com/png-clipart/20230201/ourmid/pngtree-golden-treasure-chest-3d-rendering-png-image_6568285.png', links: [{ type: 'Play Online', url: 'http://www.goldentreasure.mobi/' }], },
    { name: 'Vegas Strip', imageUrl: null, links: [{ type: 'Play Online', url: 'https://www.vsgames777.com/login' }], },
    { name: 'Lucky Master', imageUrl: null, links: [{ type: 'Play Online', url: 'https://lucky-master.net/' }], },
    { name: 'River Sweeps', imageUrl: null, links: [{ type: 'Play Online', url: 'http://river777.net/' }], },
    { name: 'VBlink', imageUrl: null, links: [{ type: 'Play Online', url: 'https://www.vblink777.club/' }], },
    { name: 'King Kong', imageUrl: 'https://img.freepik.com/premium-vector/king-kong-logo_43623-341.jpg', links: [{ type: 'Play Online', url: 'http://www.playgdt.top/' }], },
    { name: 'Ultra Panda', imageUrl: null, links: [{ type: 'Play Online', url: 'https://ultrapanda.mobi' }], },
    { name: 'Orion Power', imageUrl: null, links: [{ type: 'Play Online', url: 'http://download.orionpower.games:8008' }], },
    { name: 'Majik Bonus', imageUrl: null, links: [{ type: 'Play Online', url: 'https://99.100bonus.me/' }], },
    { name: 'Magic City', imageUrl: 'https://mir-s3-cdn-cf.behance.net/projects/404/b5f884118239709.Y3JvcCw4MDgsNjMyLDAsMA.png', links: [{ type: 'Play Online', url: 'https://www.magiccity777.com/' }], },
    { name: 'Apollo', imageUrl: 'https://www.dbljump.com/wp-content/uploads/2021/04/Games-by-Apollo-logo.png', links: [{ type: 'Android', url: 'http://m.apollo717.com/' }], },
    { name: 'Golden Dragon 2', imageUrl: 'https://i.pinimg.com/736x/21/25/71/2125713c2f4477811d7301a141b18a38.jpg', links: [{ type: 'Play Online', url: 'http://goldendragon2.games' }], },
    { name: 'Mega Spin', imageUrl: null, links: [{ type: 'Play Online', url: 'http://okay.megaspin.vip/web_game/ms/' }], },
    { name: 'Lucky Dragon', imageUrl: 'https://cdn.logoai.com/uploads/output/2021/10/18/d8a4369a47012f1a66a7b32c66281232.jpg', links: [{ type: 'Play Online', url: 'https://lucky-dragon.net/' }], },
];

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

        <section className="games-grid-section section-padded" style={{paddingTop: 0}}>
          <div className="container">
            <div className="games-grid">
              {gamesData.map((game, index) => (
                <div key={index} className="game-card">
                  <div className="game-card-image">
                    {game.imageUrl ? (
                      <img src={game.imageUrl} alt={`${game.name} logo`} />
                    ) : (
                      <div className="game-card-name-placeholder">{game.name}</div>
                    )}
                  </div>
                  <div className="game-card-actions">
                    {game.links.map((link, linkIndex) => (
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
                    ))}
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
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: var(--spacing-lg);
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
          height: 150px;
          display: flex;
          align-items: center;
          justify-content: center;
          background-color: #000;
        }
        .game-card-image img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .game-card-name-placeholder {
            color: #fff;
            font-size: 1.2rem;
            font-weight: bold;
            text-align: center;
        }
        .game-card-actions {
          padding: var(--spacing-md);
          display: flex;
          flex-direction: column;
          gap: var(--spacing-sm);
        }
        .game-card-action {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: var(--spacing-sm);
        }
      `}</style>
    </>
  );
}