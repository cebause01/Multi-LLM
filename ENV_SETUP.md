# Environment Variables Setup Guide

## Quick Start

1. **Install dependencies** (including dotenv):
   ```bash
   npm install
   ```

2. **Create your `.env` file:**
   ```bash
   cp .env.example .env
   ```

3. **Edit `.env` and add your API key:**
   ```env
   OPENROUTER_API_KEY=your_actual_api_key_here
   ```

4. **Start the server:**
   ```bash
   npm run server
   ```

## Environment Variables

### Required Variables

- **`OPENROUTER_API_KEY`**: Your OpenRouter API key
  - Get it from: https://openrouter.ai/keys
  - Required for all API calls to OpenRouter

### Optional Variables

- **`PORT`**: Server port (default: 3001)
  - Example: `PORT=3001`

- **`RELEVANCE_THRESHOLD`**: CRAG relevance threshold (default: 0.7)
  - Range: 0.0 to 1.0
  - Higher = more strict relevance requirements

- **`MAX_RETRIEVAL_COUNT`**: Maximum documents to retrieve (default: 5)
  - Number of documents to retrieve per query

## Security Notes

⚠️ **IMPORTANT:**
- The `.env` file is already in `.gitignore` and will NOT be committed to git
- Never share your `.env` file or commit it to version control
- The `.env.example` file is safe to commit (it contains no real keys)

## Troubleshooting

### "OPENROUTER_API_KEY is not set"
- Make sure you created a `.env` file (not just `.env.example`)
- Check that the variable name is exactly `OPENROUTER_API_KEY`
- Verify there are no extra spaces around the `=` sign
- Restart the server after creating/editing `.env`

### Server won't start
- Make sure `dotenv` is installed: `npm install`
- Check that `.env` file exists in the project root
- Verify the file format is correct (no quotes around values unless needed)

### API calls failing
- Verify your API key is correct in `.env`
- Check that the key is active on OpenRouter
- Make sure you have credits/quota available

## File Structure

```
Multi-LLM/
├── .env              # Your actual environment variables (DO NOT COMMIT)
├── .env.example      # Template file (safe to commit)
├── .gitignore        # Already includes .env
└── ...
```

## Example `.env` File

```env
# OpenRouter API Configuration
OPENROUTER_API_KEY=sk-or-v1-your-actual-key-here

# Server Configuration
PORT=3001

# CRAG Configuration (Optional)
# RELEVANCE_THRESHOLD=0.7
# MAX_RETRIEVAL_COUNT=5
```

