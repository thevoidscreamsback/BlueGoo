# BlueGoo Image Explainer

*This browser extension was created in VS Code using Roo Code and Google Gemini 2.5 Pro. It is free to use, share, and enjoy. I hope it helps someone!*

BlueGoo is a browser extension designed as an accessibility tool to make interacting with images on the internet easier, particularly for people with visual impairments. It allows users to quickly generate descriptions or transcribe text from images using AI, and provides an easy way to view this information.

## Features

*   **Generate Image Descriptions:** Right-click on any image on a webpage and select "Explain Image (BlueGoo)" from the context menu.
*   **AI-Powered:** Uses the OpenRouter API to connect to various AI models capable of image understanding (Vision models).
*   **Configurable:** Set your own OpenRouter API key and choose your preferred AI model via the extension's options page.
*   **Clear Overlay:** Displays the generated description or transcribed text directly over the image in a clean overlay.
*   **Copy Functionality:** Easily copy the generated text to your clipboard using the "Copy" button in the overlay.
*   **Customizable Theme:** Choose between a Light or Dark theme for the overlay via the options page.
*   **Close Button:** Dismiss the overlay easily with the "Close" button.

## Models

Currently, BlueGoo exclusively uses Google AI models via OpenRouter to ensure consistent performance and reliability. We offer two primary options:

*   **Google Gemini Flash:** A fast and capable model suitable for general image understanding tasks.
*   **Google Gemma 3 (4B):** A smaller, highly efficient 4-billion parameter model designed to minimize environmental impact while still providing effective image analysis.

This focused approach allows us to provide a stable and predictable user experience.

## Roadmap

We are actively working on expanding model support to offer greater flexibility. Future plans include:

*   **Ollama Support:** Integration with Ollama to allow users to use local models.
*   **OpenAI API:** Adding support for models via the OpenAI API format.
*   **Custom Models:** Enabling users to specify other compatible models via APIs like OpenRouter or directly.
*   **Custom Guidance/Prompts:** Allowing users to provide custom instructions or prompts to tailor the AI's output for specific needs (e.g., "Describe the colors" or "Transcribe only the handwritten text").

## How to Use

1.  **Install the Extension:**
    *   Navigate to your browser's extensions page (e.g., `chrome://extensions` or `edge://extensions`).
    *   Enable "Developer mode" (usually a toggle in the top-right corner).
    *   Click "Load unpacked" and select the directory containing the BlueGoo extension files.
    *   (Optional but recommended) Pin the BlueGoo extension icon to your browser toolbar for easy access to settings.
2.  **Configure Settings:**
    *   Click the BlueGoo extension icon in your browser toolbar to open the Settings page.
    *   Enter your [OpenRouter API Key](https://openrouter.ai/keys).
    *   Select the AI Model you wish to use (ensure it's a model compatible with vision tasks).
    *   Choose your preferred Overlay Theme (Light or Dark).
    *   Click "Save Settings".
3.  **Generate Description:**
    *   Find an image on any webpage.
    *   Right-click on the image.
    *   Select "Explain Image (BlueGoo)" from the menu.
4.  **View & Use:**
    *   An overlay will appear over the image displaying the AI-generated description or text transcription.
    *   Click the "Copy" button to copy the text.
    *   Click the "Close" button to dismiss the overlay.

## Accessibility Goal

The primary goal of BlueGoo is to improve web accessibility.
*   **For Content Consumers:** Users with visual impairments can use BlueGoo to understand images that lack proper alt text.
*   **For Content Creators:** Users can leverage BlueGoo to quickly generate descriptive alt text for images before posting them online, making their content more accessible to everyone.