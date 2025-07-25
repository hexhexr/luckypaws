// src/components/OfferBar.js
import { useState, useEffect } from 'react';

export default function OfferBar() {
    const [offer, setOffer] = useState(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const offerClosed = sessionStorage.getItem('offerBarClosed');
        if (offerClosed) {
            return;
        }

        const fetchActiveOffer = async () => {
            try {
                const res = await fetch('/api/offers/active');
                const data = await res.json();
                if (data.offer) {
                    setOffer(data.offer);
                    setIsVisible(true);
                }
            } catch (error) {
                console.error("Could not fetch offer", error);
            }
        };

        fetchActiveOffer();
    }, []);

    const handleClose = () => {
        setIsVisible(false);
        sessionStorage.setItem('offerBarClosed', 'true');
    };

    if (!isVisible || !offer) {
        return null;
    }

    return (
        <div className="offer-bar">
            <p className="offer-text">{offer.text}</p>
            <button onClick={handleClose} className="close-btn" aria-label="Close offer bar">&times;</button>
            <style jsx>{`
                .offer-bar {
                    position: sticky;
                    top: 0;
                    left: 0;
                    width: 100%;
                    background: linear-gradient(45deg, var(--primary-blue), var(--primary-green));
                    color: white;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: var(--spacing-sm) var(--spacing-xl);
                    z-index: 1001;
                    text-align: center;
                    font-weight: 500;
                    box-shadow: var(--shadow-md);
                }
                .offer-text {
                    margin: 0;
                    padding-right: 2rem; /* Space for the close button */
                }
                .close-btn {
                    position: absolute;
                    right: var(--spacing-md);
                    top: 50%;
                    transform: translateY(-50%);
                    background: none;
                    border: none;
                    color: white;
                    font-size: 1.5rem;
                    cursor: pointer;
                    opacity: 0.8;
                    padding: 0 0.5rem;
                }
                .close-btn:hover {
                    opacity: 1;
                }
            `}</style>
        </div>
    );
}