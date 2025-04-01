// Create context menu item on installation
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "explainImage",
    title: "Explain Image (BlueGoo)",
    contexts: ["image"] // Show only when right-clicking an image
  });
  console.log("BlueGoo context menu created.");
});

// Listener for context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "explainImage" && info.srcUrl) {
    console.log("Explain Image clicked for:", info.srcUrl);
    // 1. Check for API key
    chrome.storage.sync.get(['openRouterApiKey'], (result) => {
      const apiKey = result.openRouterApiKey;
      if (!apiKey) {
        console.error("OpenRouter API key not set.");
        // Optionally, open the options page or notify the user
        chrome.runtime.openOptionsPage();
        // Send a message to content script to show an error? Or handle directly?
        // For now, just log and open options.
        return;
      }

      // 2. Send message to content script to get image data and show loading
      console.log("Sending message to content script to process image:", info.srcUrl);
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js'] // Ensure content script is injected if not already
      }).then(() => {
         // Send message to content script to find the image and show loading indicator
         chrome.tabs.sendMessage(tab.id, {
           action: "prepareImageProcessing", // New action name
           imageUrl: info.srcUrl
           // No need to send API key here anymore
         }, (response) => {
             if (chrome.runtime.lastError) {
                 console.error("Error sending prepare message:", chrome.runtime.lastError.message);
             } else if (response?.status === "error") {
                 console.error("Content script reported error during preparation:", response.message);
                 // Optionally show a notification to the user here?
             } else {
                 console.log("Content script acknowledged prepare message:", response);
             }
         });
      }).catch(err => console.error("Failed to inject content script:", err));
    });
  }
});

// Listener for messages from content script (e.g., image data)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "startImageProcessing") {
    console.log("Received request to start processing image:", request.imageUrl);
    // Fetch image data here in the background script to avoid CORS issues
    fetchImageDataAndCallApi(request.imageUrl, sender.tab.id);
    sendResponse({ status: "background_processing_started" }); // Acknowledge receipt
    return true; // Indicates potentially async work (fetching + API call)
  }
  // Keep 'return false' outside the if block if no other async messages are handled
  return false;
});

// New function to handle fetching image data first
async function fetchImageDataAndCallApi(imageUrl, tabId) {
  console.log("Fetching image data for:", imageUrl);
  let apiKey;

  try {
    // 1. Get Settings (API Key and Model)
    const storageResult = await chrome.storage.sync.get({
        openRouterApiKey: '', // Default empty
        selectedModel: 'google/gemini-2.0-flash-exp:free', // Default model (Updated)
        selectedLanguage: 'en' // Default language
    });
    apiKey = storageResult.openRouterApiKey;
    const selectedModel = storageResult.selectedModel;
    const selectedLanguage = storageResult.selectedLanguage; // Get the selected language
    if (!apiKey) {
      console.error("OpenRouter API key not set when trying to fetch image.");
      // Notify user - maybe open options page? Or send error to content script?
      chrome.tabs.sendMessage(tabId, {
          action: "showError",
          message: "API Key not configured. Please set it in the extension options.",
          imageUrl: imageUrl
      });
      chrome.runtime.openOptionsPage(); // Also open options page
      return; // Stop processing
    }

    // 2. Fetch Image Data
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
    }
    const blob = await response.blob();

    // Optional: Check content type if possible, though Gemini Vision is robust
    // console.log("Fetched image blob type:", blob.type);
    // if (!blob.type.startsWith('image/')) {
    //   throw new Error(`Fetched content is not an image (${blob.type})`);
    // }

    // 3. Convert to Base64 Data URL
    const reader = new FileReader();
    const dataUrlPromise = new Promise((resolve, reject) => {
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = (error) => reject(new Error("Failed to read image data: " + error));
      reader.readAsDataURL(blob);
    });
    const imageDataUrl = await dataUrlPromise;
    console.log("Image fetched and converted to data URL successfully.");

    // 4. Call OpenRouter API
    // 4. Call OpenRouter API, passing the selected model
    await callOpenRouter(imageDataUrl, apiKey, selectedModel, selectedLanguage, tabId, imageUrl); // Pass language

  } catch (error) {
    console.error("Error fetching image data or calling API:", error);
    // Send error back to content script
    chrome.tabs.sendMessage(tabId, {
      action: "showError",
      message: `Error processing image: ${error.message}`,
      imageUrl: imageUrl // Use original URL to identify the image
    });
  }
}


// Updated function signature to accept the model
async function callOpenRouter(imageDataUrl, apiKey, model, language, tabId, originalImageUrl) { // Added language parameter
  console.log(`Calling OpenRouter API with model: ${model} and language: ${language}...`);
  // Construct the prompt, adding the language instruction if not English (default)
  let prompt = "Describe this image briefly for alt-text, or transcribe any text within it. If the image is artistic (e.g., a painting, drawing, illustration), also briefly describe its style and mood if relevant. Provide only the description or transcription, without repeating these instructions.";
  if (language && language !== 'en') {
      prompt += ` Respond in the language with code: ${language}.`;
  }
  // Model is now passed as a parameter, no need to hardcode here

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: "user",
            content: [
              {
                "type": "text",
                "text": prompt
              },
              {
                "type": "image_url",
                "image_url": {
                  "url": imageDataUrl // This is the base64 data URL
                }
              }
            ]
          }
        ],
        "max_tokens": 300 // Increased token limit for potentially longer descriptions
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("OpenRouter API Error:", response.status, errorData);
      throw new Error(`API Error: ${response.status} ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    console.log("OpenRouter API Response:", data);

    const description = data.choices?.[0]?.message?.content?.trim();

    if (description) {
      // 4. Send description back to content script
      console.log("Sending description to content script:", description);
      chrome.tabs.sendMessage(tabId, {
        action: "displayDescription",
        description: description,
        imageUrl: originalImageUrl // Send original URL to identify the image
      });
    } else {
      console.error("No description found in API response.");
      chrome.tabs.sendMessage(tabId, {
        action: "showError",
        message: "Could not get description from API.",
        imageUrl: originalImageUrl
      });
    }

  } catch (error) {
    console.error("Error calling OpenRouter API:", error);
    chrome.tabs.sendMessage(tabId, {
      action: "showError",
      message: `Error: ${error.message}`,
      imageUrl: originalImageUrl
    });
  }
}