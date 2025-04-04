console.log("BlueGoo content script loaded.");

// --- Globals ---
let currentOverlay = null; // Keep track of the main description/error overlay
let waitingOverlay = null; // Keep track of the "Please wait" overlay

// --- Listener for messages from background script ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Content script received message:", request);

  if (request.action === "prepareImageProcessing") { // Changed action name
    handlePrepareImage(request.imageUrl, sendResponse); // Changed function call, removed apiKey
    return true; // Indicate async response needed
  } else if (request.action === "displayDescription") {
    // Receive structured data
    displayOverlay(request.imageUrl, request.classification, request.originalLanguage, request.description, false);
    sendResponse({ status: "displayed" });
  } else if (request.action === "showError") {
    displayOverlay(request.imageUrl, request.message, true);
    sendResponse({ status: "error_shown" });
  }
  return false; // No async response needed for display/error actions
});

// --- Functions ---

// Renamed and simplified function: Finds image, shows loading, tells background to proceed
function handlePrepareImage(imageUrl, sendResponse) {
  console.log("Preparing to process image:", imageUrl);
  const targetImage = findImageElement(imageUrl);

  if (!targetImage) {
    console.error("Could not find the target image element for:", imageUrl);
    // Send error back immediately if image isn't found on page
    sendResponse({ status: "error", message: "Image element not found on page." });
    // Optionally display an error overlay here too?
    // displayOverlay(imageUrl, "Could not find the image element on the page.", true);
    return;
  }

  // Display "Please wait" overlay immediately
  displayWaitingOverlay(imageUrl);

  // Tell background script to start the actual fetching and API call
  console.log("Asking background script to start processing:", imageUrl);
  chrome.runtime.sendMessage({
    action: "startImageProcessing",
    imageUrl: imageUrl // Background script already has API key from storage
  });

  // Respond to the original message from background script
  sendResponse({ status: "processing_started" });
}

function findImageElement(srcUrl) {
  // Find the image element on the page that matches the srcUrl
  // This might need refinement depending on how pages load images (e.g., background images)
  const images = document.querySelectorAll('img');
  for (let img of images) {
    // Use 'src' for absolute URLs, 'currentSrc' might be better for responsive images
    if (img.src === srcUrl || img.currentSrc === srcUrl) {
      return img;
    }
    // Sometimes the src might be relative, try resolving it
    try {
        const absoluteUrl = new URL(img.src, window.location.href).href;
        if (absoluteUrl === srcUrl) {
            return img;
        }
    } catch (e) { /* Ignore invalid URLs */ }

  }
    // Fallback for background images (less reliable) - might need specific selectors
    // This is a basic attempt, might not cover all cases
    const elementsWithBg = document.querySelectorAll('*');
     for (let elem of elementsWithBg) {
        const style = window.getComputedStyle(elem);
        const bgImage = style.backgroundImage;
        if (bgImage && bgImage.includes(srcUrl)) {
             // Cannot directly return the element as we can't easily position overlay relative to background
             // For now, focus on <img> tags
             console.warn("Found image as background, overlay positioning might be inaccurate.");
             // return elem; // Maybe return element and handle positioning differently?
        }
     }

  console.warn("Image element not found for src:", srcUrl);
  return null; // Not found
}

// (Loading indicator functions were previously removed)

// Updated function to handle theme and centering/bounding
// Updated function signature to accept structured data
async function displayOverlay(imageUrl, classification, originalLanguage, description, isError) {
  // (Loading indicator call was previously removed)
  removeWaitingOverlay(); // Remove the waiting overlay first
  removeOverlay(); // Remove any existing main overlay

  const targetImage = findImageElement(imageUrl);
  if (!targetImage) {
    console.error("Cannot display overlay: Target image not found for", imageUrl);
    return;
  }

  // Get theme setting from storage
  const settings = await chrome.storage.sync.get({ selectedTheme: 'light' }); // Default to light
  const theme = settings.selectedTheme;

  const overlay = document.createElement('div');
  overlay.id = 'bluegoo-overlay';
  overlay.classList.add(theme); // Add theme class ('light' or 'dark')
  if (isError) {
      overlay.classList.add('error'); // Add error class
  }

  // Basic styles - others controlled by CSS
  overlay.style.position = 'absolute';
  overlay.style.zIndex = '2147483647'; // Max z-index

  // --- Sizing & Bounding ---
  const imgRect = targetImage.getBoundingClientRect();
  const paddingValue = 20; // Define padding (should match CSS) - used for max-width calc
  // Max width is image width minus padding on both sides
  overlay.style.maxWidth = `${Math.max(100, imgRect.width - paddingValue * 2)}px`; // Ensure a minimum width
  // Max height could also be set, e.g., overlay.style.maxHeight = `${imgRect.height - paddingValue * 2}px`;
  // but let's allow vertical overflow for now if needed, controlled by CSS overflow property if desired.

  // --- Metadata Elements (Classification & Language) ---
  // Create individual <p> elements for metadata, no container div

  // Classification Element
  const classificationElement = document.createElement('p'); // Use <p>
  classificationElement.textContent = `Type: ${classification || 'Unknown'}`;
  classificationElement.classList.add('metadata-text', 'classification-text');
  // Append directly to overlay later

  // Original Language Element (only if relevant)
  let languageElement = null; // Initialize as null
  if (originalLanguage && originalLanguage.toUpperCase() !== 'N/A') {
    languageElement = document.createElement('p'); // Use <p>
    // Use Intl.DisplayNames to get the full language name
    const languageNames = new Intl.DisplayNames(['en'], { type: 'language' }); // Use 'en' for English names of languages
    const fullLanguageName = languageNames.of(originalLanguage);
    languageElement.textContent = `Original Language: ${fullLanguageName || originalLanguage}`; // Fallback to code if name not found
    languageElement.classList.add('metadata-text', 'language-text');
    // Append directly to overlay later
  }

  // --- Main Description Element ---
  const textElement = document.createElement('p');
  textElement.textContent = description; // Use the description part
  textElement.style.margin = '0'; // Let CSS handle margins/padding
  textElement.classList.add('description-text'); // Add class for potential specific styling

  // Old close button ('X') removed

  // --- Copy Button ---
  const copyButton = document.createElement('button');
  copyButton.textContent = 'Copy';
  copyButton.classList.add('action-button'); // Shared class for bottom buttons
  copyButton.classList.add('copy-button'); // Specific class if needed later
  copyButton.onclick = (e) => {
      e.stopPropagation(); // Prevent closing the overlay
      navigator.clipboard.writeText(textElement.textContent)
          .then(() => {
              console.log('Text copied to clipboard');
              copyButton.textContent = 'Copied!';
              setTimeout(() => {
                  copyButton.textContent = 'Copy'; // Reset text after a delay
              }, 1500);
          })
          .catch(err => {
              console.error('Failed to copy text: ', err);
              copyButton.textContent = 'Error'; // Indicate failure
               setTimeout(() => {
                  copyButton.textContent = 'Copy';
              }, 1500);
          });
  };

  // --- New Close Button (at the bottom) ---
  const newCloseButton = document.createElement('button');
  newCloseButton.textContent = 'Close';
  newCloseButton.classList.add('action-button'); // Shared class
  newCloseButton.classList.add('close-button'); // Specific class if needed later
  newCloseButton.onclick = (e) => {
      e.stopPropagation();
      removeOverlay();
  };

  // --- Button Container ---
  const buttonContainer = document.createElement('div');
  buttonContainer.classList.add('button-container');
  buttonContainer.appendChild(copyButton);
  buttonContainer.appendChild(newCloseButton);

  // Append metadata <p> elements first, then description <p>
  overlay.appendChild(classificationElement);
  if (languageElement) { // Only append if it was created
      overlay.appendChild(languageElement);
  }
  overlay.appendChild(textElement);

  // Add disclaimer text (now appended after buttons)
  const disclaimerElement = document.createElement('p');
  disclaimerElement.textContent = 'BlueGoo uses generative AI and can make mistakes.';
  disclaimerElement.classList.add('disclaimer-text'); // Add class for styling

  overlay.appendChild(buttonContainer); // Append the container with both buttons
  overlay.appendChild(disclaimerElement); // Then append the disclaimer
  // --- Positioning Logic (Centering) ---
  // Append to body temporarily to calculate overlay dimensions
  overlay.style.visibility = 'hidden'; // Hide while calculating
  document.body.appendChild(overlay);
  // Use requestAnimationFrame to ensure dimensions are calculated after layout
  requestAnimationFrame(() => {
    const overlayWidth = overlay.offsetWidth;
    const overlayHeight = overlay.offsetHeight;

    // If dimensions are still 0, log an error and maybe apply a default position?
    if (overlayWidth === 0 || overlayHeight === 0) {
        console.warn("Overlay dimensions calculated as zero. Positioning might be incorrect.");
        // Potentially apply a fallback position near the image top-left?
        // overlay.style.left = `${imgRect.left + window.scrollX + 5}px`;
        // overlay.style.top = `${imgRect.top + window.scrollY + 5}px`;
    } else {
        // Calculate center of the image relative to the viewport
        const imgCenterX = imgRect.left + imgRect.width / 2;
        const imgCenterY = imgRect.top + imgRect.height / 2;

        // Calculate desired top-left corner for the overlay to be centered
        // Add scroll offsets to position relative to the document, not viewport
        let overlayLeft = imgCenterX - overlayWidth / 2 + window.scrollX;
        let overlayTop = imgCenterY - overlayHeight / 2 + window.scrollY;

        // Basic boundary check (prevent going too far off-screen left/top)
        overlayLeft = Math.max(5 + window.scrollX, overlayLeft); // Keep at least 5px from left edge
        overlayTop = Math.max(5 + window.scrollY, overlayTop);   // Keep at least 5px from top edge

        // Apply final position
        overlay.style.left = `${overlayLeft}px`;
        overlay.style.top = `${overlayTop}px`;
    }

    overlay.style.visibility = 'visible'; // Make visible now
  });

  document.body.appendChild(overlay);
  currentOverlay = overlay; // Store reference to the new overlay

  console.log(`Overlay ${isError ? 'error' : 'description'} displayed for:`, imageUrl, "Data:", { classification, originalLanguage, description });
}

// --- Waiting Overlay Functions ---

async function displayWaitingOverlay(imageUrl) {
  removeWaitingOverlay(); // Remove any previous waiting overlay
  removeOverlay(); // Also remove main overlay if it exists for some reason

  const targetImage = findImageElement(imageUrl);
  if (!targetImage) {
    console.error("Cannot display waiting overlay: Target image not found for", imageUrl);
    return;
  }

  // Get theme setting from storage to apply correct theme
  const settings = await chrome.storage.sync.get({ selectedTheme: 'light' });
  const theme = settings.selectedTheme;

  const overlay = document.createElement('div');
  overlay.id = 'bluegoo-waiting-overlay'; // Use a different ID
  overlay.classList.add(theme); // Apply theme

  // Basic styles - similar to main overlay, position/z-index set by JS/CSS
  overlay.style.position = 'absolute';
  overlay.style.zIndex = '2147483647'; // Max z-index

  const textElement = document.createElement('p');
  textElement.textContent = 'Please wait a few moments...';
  textElement.style.margin = '0'; // Let CSS handle margins/padding

  overlay.appendChild(textElement);

  // --- Positioning Logic (Centering - same as main overlay) ---
  const imgRect = targetImage.getBoundingClientRect();
  const paddingValue = 15; // Match main overlay padding for consistency if needed
  overlay.style.maxWidth = `${Math.max(100, imgRect.width - paddingValue * 2)}px`;

  // Append temporarily to calculate dimensions
  overlay.style.visibility = 'hidden';
  document.body.appendChild(overlay);
  // Use requestAnimationFrame for waiting overlay positioning too
  requestAnimationFrame(() => {
    const overlayWidth = overlay.offsetWidth;
    const overlayHeight = overlay.offsetHeight;

    if (overlayWidth === 0 || overlayHeight === 0) {
        console.warn("Waiting overlay dimensions calculated as zero. Positioning might be incorrect.");
    } else {
        const imgCenterX = imgRect.left + imgRect.width / 2;
        const imgCenterY = imgRect.top + imgRect.height / 2;

        let overlayLeft = imgCenterX - overlayWidth / 2 + window.scrollX;
        let overlayTop = imgCenterY - overlayHeight / 2 + window.scrollY;

        overlayLeft = Math.max(5 + window.scrollX, overlayLeft);
        overlayTop = Math.max(5 + window.scrollY, overlayTop);

        overlay.style.left = `${overlayLeft}px`;
        overlay.style.top = `${overlayTop}px`;
    }
    overlay.style.visibility = 'visible';
  });

  // Re-append (or just ensure it's in the body)
  // document.body.appendChild(overlay); // Already appended
  waitingOverlay = overlay; // Store reference

  console.log("Waiting overlay displayed for:", imageUrl);
}

function removeWaitingOverlay() {
  if (waitingOverlay) {
    waitingOverlay.remove();
    waitingOverlay = null;
    console.log("Waiting overlay removed.");
  }
}

// --- Main Overlay Removal ---

function removeOverlay() {
  // Also ensure waiting overlay is removed if this is called directly
  removeWaitingOverlay();

  if (currentOverlay) {
    currentOverlay.remove();
    currentOverlay = null;
    console.log("Previous main overlay removed.");
  }
}

// Initial check or setup if needed
console.log("BlueGoo content script ready.");