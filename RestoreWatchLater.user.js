// ==UserScript==
// @name         YouTube 1‑Click Watch Later
// @namespace    http://tampermonkey.net/
// @version      9.1
// @downloadURL  https://github.com/babanpic/RestoreWatchLater/raw/refs/heads/main/RestoreWatchLater.user.js
// @updateURL    https://github.com/babanpic/RestoreWatchLater/raw/refs/heads/main/RestoreWatchLater.user.js
// @description  Adds a Watch Later button on YouTube home and subscriptions pages
// @author       https://github.com/babanpic
// @supportURL   https://ko-fi.com/babanpic
// @match        https://www.youtube.com/
// @match        https://www.youtube.com/feed/subscriptions
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Only run on home page or subscriptions page
    const isHomePage = window.location.pathname === '/';
    const isSubscriptionsPage = window.location.pathname === '/feed/subscriptions';

    if (!isHomePage && !isSubscriptionsPage) {
        return; // Exit immediately if not on target pages
    }

    let currentCard = null;
    let isProcessing = false;
    let hideTimeout = null;

    // CONFIGURATION - Adjust these values as needed
    const BUTTON_OFFSET_FROM_RIGHT = 115; // Pixels from right edge
    const BUTTON_OFFSET_FROM_TOP = 8;    // Pixels from top edge

    // Create floating button
    const wlBtn = document.createElement('button');
    wlBtn.textContent = '⏱️ Watch Later';
    wlBtn.style.cssText = `
        position: fixed;
        display: none;
        z-index: 2147483647;
        background: #3ea6ff;
        color: white;
        border: none;
        border-radius: 18px;
        padding: 6px 12px;
        font-weight: bold;
        cursor: pointer;
        font-family: 'Roboto', Arial, sans-serif;
        font-size: 12px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        white-space: nowrap;
        pointer-events: auto;
        min-width: 110px;
        text-align: center;
    `;
    document.body.appendChild(wlBtn);

    const ORIGINAL_TEXT = '⏱️ Watch Later';
    const ADDED_TEXT = '✓ Added';

    function resetButtonState() {
        if (wlBtn.textContent !== ORIGINAL_TEXT) {
            wlBtn.textContent = ORIGINAL_TEXT;
            wlBtn.style.backgroundColor = '#3ea6ff';
        }
    }

    wlBtn.onmouseover = () => {
        if (!isProcessing && wlBtn.textContent === ORIGINAL_TEXT) {
            wlBtn.style.backgroundColor = '#2a7fcc';
        }
    };
    wlBtn.onmouseout = () => {
        if (wlBtn.textContent === ORIGINAL_TEXT) {
            wlBtn.style.backgroundColor = '#3ea6ff';
        }
    };

    // Find video card from element (only videos, not playlists)
    function findVideoCard(element) {
        if (!element) return null;
        let current = element;
        while (current && current !== document.body) {
            // Only match video renderers, not playlist renderers
            if (current.tagName === 'YTD-RICH-ITEM-RENDERER' ||
                current.tagName === 'YTD-VIDEO-RENDERER') {
                // Additional check: make sure it's a video, not a playlist
                const isPlaylist = current.querySelector('ytd-thumbnail-overlay-playlist-status-renderer, [aria-label*="playlist"]');
                if (!isPlaylist) {
                    return current;
                }
            }
            current = current.parentElement;
        }
        return null;
    }

    // Position button in top-right corner of the thumbnail
    function positionButtonOnCard(card) {
        if (!card) return false;

        // Find the thumbnail container
        const thumbnail = card.querySelector('#thumbnail, ytd-thumbnail, a#thumbnail');
        let rect;

        if (thumbnail) {
            rect = thumbnail.getBoundingClientRect();
        } else {
            rect = card.getBoundingClientRect();
        }

        // Check if card is in viewport
        if (rect.top < 0 || rect.bottom > window.innerHeight ||
            rect.left < 0 || rect.right > window.innerWidth) {
            return false;
        }

        // Position at top-right with custom offset
        const buttonWidth = wlBtn.offsetWidth;
        wlBtn.style.top = (rect.top + BUTTON_OFFSET_FROM_TOP) + 'px';
        wlBtn.style.left = (rect.right - buttonWidth - BUTTON_OFFSET_FROM_RIGHT) + 'px';

        return true;
    }

    function hideButton() {
        if (hideTimeout) clearTimeout(hideTimeout);
        wlBtn.style.display = 'none';
        currentCard = null;
        resetButtonState();
    }

    function showButtonOnCard(card) {
        if (!card || isProcessing) return false;
        resetButtonState();
        if (!positionButtonOnCard(card)) return false;
        wlBtn.style.display = 'block';
        currentCard = card;
        return true;
    }

    // Mouse move handler
    document.addEventListener('mousemove', (e) => {
        if (isProcessing) return;
        if (hideTimeout) clearTimeout(hideTimeout);

        const card = findVideoCard(e.target);

        if (card) {
            if (card !== currentCard) {
                wlBtn.style.display = 'none';
                if (showButtonOnCard(card)) {
                    const mouseLeaveHandler = () => {
                        hideTimeout = setTimeout(() => {
                            if (wlBtn.style.display === 'block' && !wlBtn.matches(':hover')) {
                                hideButton();
                            }
                            hideTimeout = null;
                        }, 150);
                        card.removeEventListener('mouseleave', mouseLeaveHandler);
                    };
                    card.addEventListener('mouseleave', mouseLeaveHandler);
                }
            } else if (wlBtn.style.display !== 'block') {
                showButtonOnCard(card);
            }
        } else if (!wlBtn.matches(':hover')) {
            hideTimeout = setTimeout(() => {
                if (!wlBtn.matches(':hover')) hideButton();
                hideTimeout = null;
            }, 100);
        }
    });

    // Reposition on scroll/resize
    window.addEventListener('scroll', () => {
        if (currentCard && wlBtn.style.display === 'block' && !isProcessing) {
            positionButtonOnCard(currentCard);
        }
    });

    window.addEventListener('resize', () => {
        if (currentCard && wlBtn.style.display === 'block' && !isProcessing) {
            positionButtonOnCard(currentCard);
        }
    });

    // Click handler
    wlBtn.onclick = async (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (isProcessing || !currentCard) return;

        isProcessing = true;
        wlBtn.textContent = '⏳ Adding...';
        wlBtn.style.backgroundColor = '#ff8c00';

        try {
            const card = currentCard;
            if (!card || !card.isConnected) throw new Error('Video card not found');

            // Close any existing menu
            document.body.click();
            await new Promise(resolve => setTimeout(resolve, 200));

            // Find menu button
            const menuBtn = card.querySelector('button[aria-label*="Action menu"], button[aria-label*="More actions"], button[aria-label*="menu"]');
            if (!menuBtn) throw new Error('Menu button not found');

            // Click menu
            menuBtn.click();

            // Wait for sheet
            let attempts = 0;
            let sheet = null;
            while (attempts < 20 && !sheet) {
                await new Promise(resolve => setTimeout(resolve, 100));
                sheet = document.querySelector('yt-sheet-view-model');
                attempts++;
            }

            if (!sheet) throw new Error('Menu sheet did not appear');

            // Click Watch Later
            const items = sheet.querySelectorAll('yt-list-item-view-model');
            let found = false;

            for (let item of items) {
                const text = item.textContent.trim().toLowerCase();
                if (text.includes('save to watch later') || text.includes('watch later')) {
                    const button = item.querySelector('button');
                    if (button) {
                        button.click();
                        found = true;
                        break;
                    }
                }
            }

            if (found) {
                wlBtn.textContent = ADDED_TEXT;
                wlBtn.style.backgroundColor = '#2ba640';
                document.body.click();

                setTimeout(() => {
                    if (currentCard === card && !isProcessing) {
                        resetButtonState();
                        positionButtonOnCard(card);
                    }
                    isProcessing = false;
                }, 2000);
            } else {
                throw new Error('Watch Later option not found');
            }

        } catch (error) {
            console.error('Watch Later error:', error);
            wlBtn.textContent = '✕ Failed';
            wlBtn.style.backgroundColor = '#ff0000';
            setTimeout(() => {
                if (currentCard && !isProcessing) {
                    resetButtonState();
                    positionButtonOnCard(currentCard);
                }
                isProcessing = false;
            }, 1500);
            document.body.click();
        }
    };
})();
