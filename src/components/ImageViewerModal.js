// src/components/ImageViewerModal.js
import React from 'react';

export default function ImageViewerModal({ imageUrl, onClose }) {
    if (!imageUrl) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal image-viewer-modal" onClick={(e) => e.stopPropagation()}>
                <button onClick={onClose} className="modal-close-btn">&times;</button>
                <img src={imageUrl} alt="Receipt" />
            </div>
            <style jsx>{`
                .image-viewer-modal {
                    max-width: 90vw;
                    max-height: 90vh;
                    width: auto;
                    height: auto;
                    padding: var(--spacing-md);
                    background-color: #fff;
                }
                .image-viewer-modal img {
                    max-width: 100%;
                    max-height: calc(90vh - 60px);
                    object-fit: contain;
                    border-radius: var(--border-radius);
                }
            `}</style>
        </div>
    );
}