# Multi-LLM Chat

A modern AI chat application that compares responses from 5 different AI models using the OpenRouter API. The application sends your input to 5 models simultaneously, then uses a judge model to select the best response.

## Features

- 🎯 **Multi-Model Comparison**: Send queries to 5 AI models simultaneously
- 🏆 **Intelligent Judging**: A judge model evaluates and selects the best response
- 📸 **Image Support**: Upload and analyze images
- 📄 **File Support**: Upload and process text files
- 🎨 **Modern UI**: Clean, minimalist interface inspired by OpenAI
- ⚙️ **Customizable**: Choose which 5 models to use and which model acts as judge

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the backend server:**
   ```bash
   npm run server
   ```
   The server will run on `http://localhost:3001`

3. **Start the frontend (in a new terminal):**
   ```bash
   npm run dev
   ```
   The app will be available at `http://localhost:3000`

## Usage

1. **Select Models**: Choose 5 AI models from the sidebar
2. **Choose Judge Model**: Select which model will evaluate the responses
3. **Input Your Query**: 
   - Type text in the input area
   - Upload images using the image button
   - Upload files using the file button
4. **Send**: Press Enter or click the send button
5. **View Results**: See the best response selected by the judge model, with an option to expand and view all 5 responses

## API Key

The OpenRouter API key is configured in `server.js`. Make sure to keep it secure in production environments.

## Tech Stack

- **Frontend**: React + Vite
- **Backend**: Node.js + Express
- **API**: OpenRouter API
- **Styling**: CSS (minimalist design)

## Project Structure

```
├── src/
│   ├── components/
│   │   ├── ChatInterface.jsx
│   │   ├── InputArea.jsx
│   │   ├── MessageList.jsx
│   │   └── ModelSelector.jsx
│   ├── App.jsx
│   ├── App.css
│   ├── main.jsx
│   └── index.css
├── server.js
├── package.json
└── vite.config.js
```

