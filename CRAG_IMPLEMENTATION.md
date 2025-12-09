# CRAG (Corrective Retrieval Augmented Generation) Implementation

## Overview

CRAG has been successfully integrated into your Multi-LLM chat system. This implementation provides:

1. **Document Storage**: Store documents in a knowledge base with vector embeddings
2. **Retrieval**: Automatically retrieve relevant documents based on user queries
3. **Relevance Evaluation**: Use LLM to evaluate if retrieved documents are relevant
4. **Corrective Retrieval**: Automatically refine queries and re-retrieve if documents aren't relevant
5. **Context Integration**: Inject retrieved context into prompts for better responses

## How It Works

### 1. Document Storage
- Upload files (PDF, TXT, MD, etc.) through the chat interface
- Click "Store Files in Knowledge Base" to add them to the CRAG system
- Documents are automatically embedded using OpenAI-compatible embeddings via OpenRouter
- Documents are stored in-memory (for production, consider using Pinecone, Weaviate, or ChromaDB)

### 2. Retrieval Process
When CRAG is enabled and a user sends a query:
1. **Initial Retrieval**: Query is embedded and compared against all stored documents using cosine similarity
2. **Relevance Evaluation**: An LLM evaluates if the retrieved documents are relevant to the query
3. **Corrective Retrieval** (if needed): If documents aren't relevant, the system:
   - Generates a refined query using LLM
   - Re-retrieves documents with the refined query
4. **Context Injection**: Retrieved documents are added to the prompt as context

### 3. UI Features

#### Enable/Disable CRAG
- Toggle the "🔍 CRAG" checkbox in the chat header
- Shows document count in knowledge base when enabled

#### Store Files
- When files are selected, a "Store Files in Knowledge Base" button appears
- Click to add file contents to the knowledge base
- Files are automatically processed (PDFs are text-extracted)

#### CRAG Info Display
- Each response shows CRAG information:
  - Number of documents retrieved
  - Relevance score (0-100%)
  - Whether query was corrected
  - Refined query (if correction occurred)

## API Endpoints

### Store Document
```POST /api/crag/store```
```json
{
  "text": "Document content...",
  "metadata": {
    "fileName": "example.pdf",
    "uploadedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### Get All Documents
```GET /api/crag/documents```
Returns list of all stored documents with previews

### Delete Document
```DELETE /api/crag/documents/:docId```
Deletes a specific document

### Clear All Documents
```DELETE /api/crag/documents```
Clears the entire knowledge base

### Get Document Count
```GET /api/crag/count```
Returns the number of documents in the knowledge base

## Configuration

### Relevance Threshold
Default: `0.7` (70%)
- Located in `cragService.js`
- Higher = more strict (requires higher similarity to be considered relevant)
- Lower = more lenient

### Maximum Retrieval Count
Default: `5` documents
- Located in `cragService.js`
- Maximum number of documents to retrieve per query

### Embedding Model
Currently using: `openai/text-embedding-ada-002` via OpenRouter
- Can be changed in `cragService.js`
- Requires OpenAI-compatible embedding API

## Usage Example

1. **Store Documents**:
   - Upload a PDF file about "Machine Learning"
   - Click "Store Files in Knowledge Base"
   - Document is now in the knowledge base

2. **Query with CRAG**:
   - Enable CRAG toggle
   - Ask: "What is machine learning?"
   - System retrieves relevant documents and includes them in the prompt
   - Response is generated with context from your documents

3. **View CRAG Info**:
   - Check the CRAG info box in the response
   - See how many documents were retrieved
   - See relevance score and if query was corrected

## Technical Details

### Embeddings
- Uses OpenAI-compatible embeddings via OpenRouter API
- Fallback to simple hash-based embeddings if API fails
- Embeddings are cached for performance

### Similarity Calculation
- Uses cosine similarity between query and document embeddings
- Returns documents sorted by similarity score

### Relevance Evaluation
- Uses LLM (Gemini 2.0 Flash) to evaluate relevance
- Falls back to similarity scores if LLM evaluation fails
- Returns JSON with `isRelevant`, `score`, and `reason`

### Corrective Retrieval
- Only triggers if relevance score < threshold
- Uses LLM to generate refined query
- Re-retrieves with refined query
- Can be disabled by setting `enableCorrection = false`

## Production Considerations

### Vector Database
Current implementation uses in-memory storage. For production:
- **Pinecone**: Managed vector database, easy to use
- **Weaviate**: Open-source, self-hosted option
- **ChromaDB**: Lightweight, Python-based
- **Qdrant**: High-performance, Rust-based

### Scaling
- Current implementation is suitable for small to medium knowledge bases (< 1000 documents)
- For larger scale, implement:
  - Persistent storage
  - Batch embedding generation
  - Indexing for faster retrieval
  - Distributed storage

### Performance
- Embedding generation: ~100-500ms per document
- Retrieval: ~50-200ms (depends on document count)
- Relevance evaluation: ~500-2000ms (LLM call)
- Corrective retrieval: ~1000-3000ms (additional LLM call)

## Troubleshooting

### "No documents found in knowledge base"
- Make sure you've stored documents first
- Check that files were successfully processed
- Verify document count in the UI

### Low relevance scores
- Documents may not be relevant to the query
- Try storing more relevant documents
- Consider lowering the relevance threshold

### Slow responses
- CRAG adds ~1-3 seconds to response time
- Disable corrective retrieval for faster responses
- Consider caching embeddings

### Embedding errors
- Check OpenRouter API key
- Verify network connection
- System will fall back to simple embeddings if API fails

## Future Enhancements

1. **Persistent Storage**: Save documents to database
2. **Chunking**: Split large documents into smaller chunks
3. **Metadata Filtering**: Filter by document metadata
4. **Hybrid Search**: Combine semantic and keyword search
5. **Re-ranking**: Use cross-encoder for better ranking
6. **Multi-modal**: Support image/document embeddings
7. **User-specific Knowledge Bases**: Separate KBs per user

## Files Modified

- `cragService.js` - Core CRAG implementation
- `server.js` - CRAG endpoints and chat integration
- `src/components/ChatInterface.jsx` - UI controls and CRAG toggle
- `src/components/MessageList.jsx` - CRAG info display

## Dependencies

All required dependencies are already in `package.json`:
- `axios` - HTTP requests
- `express` - Server framework
- No additional packages needed!

