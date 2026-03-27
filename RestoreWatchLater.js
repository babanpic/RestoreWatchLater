// ==UserScript==
// @name         YouTube 1‑Click Watch Later (Clean)
// @namespace    http://tampermonkey.net/
// @version      8.5
// @description  Adds a floating Watch Later button in fixed position on each thumbnail
// @author       babanpic on github
// @match        https://www.youtube.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    let currentCard = null;
    let isProcessing = false;
    let hideTimeout = null;

    // CONFIGURATION - Adjust these values as needed
    const BUTTON_OFFSET_FROM_RIGHT = 115; // Pixels from right edge (increase to move left, decrease to move right)
    const BUTTON_OFFSET_FROM_TOP = 8;    // Pixels from top edge

    // Create floating button - NO transitions/animations
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
        min-width: 110px; /* Fixed minimum width to prevent shifting */
        text-align: center;
    `;
    document.body.appendChild(wlBtn);

    // Store the original text for resetting
    const ORIGINAL_TEXT = '⏱️ Watch Later';
    const ADDED_TEXT = '✓ Added';

    // Function to reset button to original state
    function resetButtonState() {
        if (wlBtn.textContent !== ORIGINAL_TEXT) {
            wlBtn.textContent = ORIGINAL_TEXT;
            wlBtn.style.backgroundColor = '#3ea6ff';
        }
    }

    // Simple hover effect without transition
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

    // Find video card from element
    function findVideoCard(element) {
        if (!element) return null;
        let current = element;
        while (current && current !== document.body) {
            if (current.tagName === 'YTD-RICH-ITEM-RENDERER' ||
                current.tagName === 'YTD-VIDEO-RENDERER') {
                return current;
            }
            current = current.parentElement;
        }
        return null;
    }

    // Position button in top-right corner of the thumbnail with offset
    function positionButtonOnCard(card) {
        if (!card) return false;

        // Find the thumbnail container
        const thumbnail = card.querySelector('#thumbnail, ytd-thumbnail, a#thumbnail');
        let rect;

        if (thumbnail) {
            rect = thumbnail.getBoundingClientRect();
        } else {
            // Fallback: use the card itself
            rect = card.getBoundingClientRect();
        }

        // Check if card is in viewport (don't show if off-screen)
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

    // Hide button with cleanup
    function hideButton() {
        if (hideTimeout) clearTimeout(hideTimeout);
        wlBtn.style.display = 'none';
        currentCard = null;
        // Reset button state when hiding
        resetButtonState();
    }

    // Show button on specific card
    function showButtonOnCard(card) {
        if (!card || isProcessing) return false;

        // Reset button state before showing on new card
        resetButtonState();

        // Position the button
        const positioned = positionButtonOnCard(card);
        if (!positioned) return false;

        // Show button
        wlBtn.style.display = 'block';
        currentCard = card;

        return true;
    }

    // Mouse move handler - simple show/hide logic
    document.addEventListener('mousemove', (e) => {
        if (isProcessing) return;

        // Clear any pending hide timeout
        if (hideTimeout) {
            clearTimeout(hideTimeout);
            hideTimeout = null;
        }

        const card = findVideoCard(e.target);

        // Case 1: Hovering over a video card
        if (card) {
            // If it's a different card than current
            if (card !== currentCard) {
                // Immediately hide current button (no animation)
                wlBtn.style.display = 'none';

                // Show button on new card
                if (showButtonOnCard(card)) {
                    // Add mouseleave handler to this card
                    const mouseLeaveHandler = () => {
                        // Delay hide slightly to allow moving to button
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
            }
            // If same card, ensure button is still visible
            else if (wlBtn.style.display !== 'block') {
                showButtonOnCard(card);
            }
        }
        // Case 2: Not hovering over a card
        else {
            // Don't hide immediately if mouse might be going to button
            if (!wlBtn.matches(':hover')) {
                hideTimeout = setTimeout(() => {
                    if (!wlBtn.matches(':hover')) {
                        hideButton();
                    }
                    hideTimeout = null;
                }, 100);
            }
        }
    });

    // Reposition on scroll - only if button is visible
    function repositionIfNeeded() {
        if (currentCard && wlBtn.style.display === 'block' && !isProcessing) {
            positionButtonOnCard(currentCard);
        }
    }

    window.addEventListener('scroll', repositionIfNeeded);
    window.addEventListener('resize', repositionIfNeeded);

    // Click handler
    wlBtn.onclick = async (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (isProcessing || !currentCard) return;

        isProcessing = true;
        const originalBg = wlBtn.style.backgroundColor;

        wlBtn.textContent = '⏳ Adding...';
        wlBtn.style.backgroundColor = '#ff8c00';

        try {
            const card = currentCard;
            if (!card || !card.isConnected) throw new Error('Video card not found');

            // Get video title for debugging
            const titleElement = card.querySelector('#video-title, [title]');
            const videoTitle = titleElement ? (titleElement.getAttribute('title') || titleElement.textContent || 'Unknown') : 'Unknown';
            console.log(`Adding "${videoTitle}" to Watch Later`);

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

                // Reset button after 2 seconds (only if still on same card)
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
