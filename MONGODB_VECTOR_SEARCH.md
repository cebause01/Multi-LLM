# MongoDB Vector Search Setup Guide

## Current Implementation

Your embeddings are currently stored as **arrays of numbers** in MongoDB:

```javascript
{
  docId: "doc_123",
  text: "Document content...",
  embedding: [0.123, 0.456, 0.789, ...], // Array of 384 or 1536 numbers
  metadata: {...},
  createdAt: ISODate(...)
}
```

## How It Works Now

1. **Storage**: Embeddings are stored as arrays in MongoDB ✅
2. **Retrieval**: All documents are fetched, then similarity is calculated in-memory
3. **Performance**: Works well for small to medium datasets (< 10,000 documents)

## MongoDB Atlas Vector Search (Recommended for Production)

For better performance with large datasets, you can use **MongoDB Atlas Vector Search**:

### Benefits
- ✅ Native vector similarity search in MongoDB
- ✅ Much faster for large datasets (10,000+ documents)
- ✅ No need to fetch all documents
- ✅ Automatic similarity calculation in database

### Setup Steps

1. **Go to MongoDB Atlas UI**
   - Navigate to your cluster
   - Go to "Atlas Search" tab

2. **Create Vector Search Index**
   ```json
   {
     "fields": [
       {
         "type": "vector",
         "path": "embedding",
         "numDimensions": 1536,  // or 384 for ada-002
         "similarity": "cosine"
       }
     ]
   }
   ```

3. **Update Code to Use Vector Search**
   - Use `$vectorSearch` aggregation pipeline
   - Query directly in MongoDB instead of fetching all

### Current vs Vector Search

**Current (In-Memory):**
```javascript
// Fetch all documents
const docs = await collection.find({}).toArray();
// Calculate similarity in Node.js
const similarity = cosineSimilarity(queryEmbedding, doc.embedding);
```

**With Vector Search:**
```javascript
// MongoDB does the similarity search
const results = await collection.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: queryEmbedding,
      numCandidates: 100,
      limit: 5
    }
  }
]).toArray();
```

## Verification

To verify your embeddings are stored correctly:

```javascript
// Check a document
const doc = await collection.findOne({ docId: "your_doc_id" });
console.log("Is array:", Array.isArray(doc.embedding));
console.log("Length:", doc.embedding?.length);
console.log("Type:", typeof doc.embedding[0]); // Should be "number"
```

## When to Use Vector Search

- **Current method (in-memory)**: Good for < 10,000 documents
- **MongoDB Vector Search**: Better for > 10,000 documents or when you need faster queries

## Next Steps

1. ✅ Embeddings are already stored as arrays (correct format)
2. ⚠️ For production with large datasets, set up Atlas Vector Search
3. ✅ Current implementation works fine for small/medium datasets

Your embeddings are stored correctly as vectors (arrays) in MongoDB! 🎉

