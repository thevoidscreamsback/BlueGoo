// Function to apply the theme class to the body
function applyTheme(theme) {
    const body = document.body;
    body.classList.remove('theme-light', 'theme-dark'); // Remove existing theme classes
    body.classList.add(`theme-${theme}`); // Add the selected theme class
    console.log(`Applied theme: theme-${theme}`);
}

// Function to save options to chrome.storage
function saveOptions() {
  const apiKey = document.getElementById('apiKey').value;
  const model = document.getElementById('model').value;
  const theme = document.querySelector('input[name="theme"]:checked').value;
  const language = document.getElementById('language').value; // Get selected language

  chrome.storage.sync.set({
    openRouterApiKey: apiKey,
    selectedModel: model,
    selectedTheme: theme,
    selectedLanguage: language // Save selected language
  }, () => {
    // Check for errors during save (though less common with sync)
    if (chrome.runtime.lastError) {
        console.error('Error saving settings:', chrome.runtime.lastError);
        const status = document.getElementById('status');
        status.textContent = 'Error saving settings.';
        status.className = 'error'; // Add error class
        setTimeout(() => {
          status.textContent = '';
          status.className = ''; // Clear class
        }, 2500);
    } else {
        // Update status to let user know options were saved.
        const status = document.getElementById('status');
        status.textContent = 'Settings saved.';
        status.className = 'success'; // Add success class
        console.log('Settings saved:', {
            apiKey: apiKey ? '******' : '<empty>',
            model: model,
            theme: theme,
            language: language // Log saved language
        });
        setTimeout(() => {
          status.textContent = '';
          status.className = ''; // Clear class
        }, 1500); // Clear status after 1.5 seconds
    }
  });
}

// Function to restore options from chrome.storage
function restoreOptions() {
  // Use default values if settings aren't found
  chrome.storage.sync.get({
    openRouterApiKey: '', // Default to empty string if not set
    selectedModel: 'google/gemini-2.0-flash-exp:free', // Default model (Updated)
    selectedTheme: 'light', // Default theme
    selectedLanguage: 'en' // Default language to English
  }, (items) => {
    document.getElementById('apiKey').value = items.openRouterApiKey;
    document.getElementById('model').value = items.selectedModel;
    document.getElementById('language').value = items.selectedLanguage; // Restore language

    // Set the correct radio button based on the saved theme
    if (items.selectedTheme === 'dark') {
        document.getElementById('theme-dark').checked = true;
    } else {
        document.getElementById('theme-light').checked = true; // Default to light if value is unexpected
    }
    // Apply the theme to the body
    applyTheme(items.selectedTheme);

    console.log('Settings restored:', items);
  });
}

// Add event listeners once the DOM is fully loaded
// Function to handle theme changes immediately
function handleThemeChange() {
    const selectedTheme = document.querySelector('input[name="theme"]:checked').value;
    applyTheme(selectedTheme);
}

// Add event listeners once the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    restoreOptions(); // Load saved settings and apply initial theme

    // Add listener for save button
    document.getElementById('save').addEventListener('click', saveOptions);

    // Add listeners for theme radio buttons
    const themeRadios = document.querySelectorAll('input[name="theme"]');
    themeRadios.forEach(radio => {
        radio.addEventListener('change', handleThemeChange);
    });

    console.log("Options script loaded and listeners attached.");
});