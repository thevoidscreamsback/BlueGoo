console.log("BlueGoo content script loaded.");

// --- Globals ---
let currentOverlay = null; // Keep track of the currently displayed overlay

// --- Listener for messages from background script ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Content script received message:", request);

  if (request.action === "prepareImageProcessing") { // Changed action name
    handlePrepareImage(request.imageUrl, sendResponse); // Changed function call, removed apiKey
    return true; // Indicate async response needed
  } else if (request.action === "displayDescription") {
    displayOverlay(request.imageUrl, request.description, false);
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

  // (Loading indicator was previously removed)
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
async function displayOverlay(imageUrl, text, isError) {
  // (Loading indicator call was previously removed)
  removeOverlay(); // Remove any existing overlay first

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

  const textElement = document.createElement('p');
  textElement.textContent = text;
  textElement.style.margin = '0'; // Let CSS handle margins/padding

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

  overlay.appendChild(textElement);
  overlay.appendChild(buttonContainer); // Append the container with both buttons
  // --- Positioning Logic (Centering) ---
  // Append to body temporarily to calculate overlay dimensions
  overlay.style.visibility = 'hidden'; // Hide while calculating
  document.body.appendChild(overlay);
  const overlayWidth = overlay.offsetWidth;
  const overlayHeight = overlay.offsetHeight;

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
  overlay.style.visibility = 'visible'; // Make visible now

  document.body.appendChild(overlay);
  currentOverlay = overlay; // Store reference to the new overlay

  console.log(`Overlay ${isError ? 'error' : 'description'} displayed for:`, imageUrl);
}

function removeOverlay() {
  if (currentOverlay) {
    currentOverlay.remove();
    currentOverlay = null;
    console.log("Previous overlay removed.");
  }
}

// Initial check or setup if needed
console.log("BlueGoo content script ready.");