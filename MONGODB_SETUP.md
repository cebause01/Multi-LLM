# MongoDB Setup for CRAG Embeddings

## Overview

Your CRAG system now uses **MongoDB** for persistent storage of documents and embeddings. All data is stored in your MongoDB Atlas cluster and persists across server restarts.

## Configuration

### Environment Variables

Your `.env` file should contain:

```env
MONGODB_URI=mongodb+srv://zarrr345:YbojWBZ79zqbT23S@bukupb.q2dsnqi.mongodb.net/?retryWrites=true&w=majority&appName=bukupb
MONGODB_DB_NAME=multi_llm_crag
```

### Database Structure

**Database:** `multi_llm_crag`  
**Collection:** `documents`

Each document stored has this structure:

```javascript
{
  docId: "doc_1234567890_abc123",
  text: "Full document text...",
  embedding: [0.123, 0.456, ...], // Array of numbers (384 or 1536 dimensions)
  metadata: {
    fileName: "example.pdf",
    uploadedAt: "2024-01-01T00:00:00.000Z",
    docId: "doc_1234567890_abc123"
  },
  createdAt: ISODate("2024-01-01T00:00:00.000Z")
}
```

## Indexes

The system automatically creates indexes for better performance:
- **Unique index on `docId`** - Fast document lookups
- **Index on `metadata.storedAt`** - Fast sorting by date

## Installation

1. **Install MongoDB driver:**
   ```bash
   npm install
   ```
   (mongodb package is already in package.json)

2. **Verify your `.env` file has the MongoDB connection string**

3. **Start the server:**
   ```bash
   npm run server
   ```

   You should see:
   ```
   ✅ Connected to MongoDB
   ✅ MongoDB indexes created
   ✅ MongoDB connected and ready
   ```

## Features

### Persistent Storage
- ✅ Documents and embeddings saved to MongoDB
- ✅ Data persists across server restarts
- ✅ No data loss

### Performance
- ✅ Embeddings cache still in-memory for speed
- ✅ MongoDB indexes for fast queries
- ✅ Efficient similarity calculations

### Operations
- **Store:** Documents saved to MongoDB with embeddings
- **Retrieve:** Queries MongoDB, calculates similarity in-memory
- **Delete:** Removes documents from MongoDB
- **Clear:** Deletes all documents from collection

## Troubleshooting

### Connection Errors

**Error: "MONGODB_URI is not set"**
- Check your `.env` file has `MONGODB_URI`
- Restart the server after adding it

**Error: "Authentication failed"**
- Verify your MongoDB credentials are correct
- Check if your IP is whitelisted in MongoDB Atlas
- Ensure the connection string is correct

**Error: "Connection timeout"**
- Check your internet connection
- Verify MongoDB Atlas cluster is running
- Check firewall settings

### Fallback Behavior

If MongoDB connection fails:
- The system will log an error
- CRAG operations will fail gracefully
- You'll see warnings in the console
- The server will still start (but CRAG won't work)

## MongoDB Atlas Setup

If you need to configure MongoDB Atlas:

1. **Whitelist IP Address:**
   - Go to MongoDB Atlas → Network Access
   - Add your server's IP address (or `0.0.0.0/0` for all IPs in development)

2. **Database User:**
   - Ensure the user has read/write permissions
   - Username: `zarrr345`
   - Password: `YbojWBZ79zqbT23S`

3. **Cluster:**
   - Cluster name: `bukupb`
   - Region: Check your cluster settings

## Data Management

### View Documents in MongoDB

You can view your documents using:
- MongoDB Atlas Web Interface
- MongoDB Compass
- MongoDB Shell (mongosh)

### Backup

To backup your data:
```bash
mongodump --uri="your_connection_string" --db=multi_llm_crag
```

### Restore

To restore from backup:
```bash
mongorestore --uri="your_connection_string" --db=multi_llm_crag dump/multi_llm_crag
```

## Security Notes

⚠️ **Important:**
- Your MongoDB connection string contains credentials
- Never commit `.env` file to git (already in `.gitignore`)
- Rotate passwords regularly
- Use MongoDB Atlas IP whitelisting in production
- Consider using environment-specific connection strings

## Migration from In-Memory

If you had data in the old in-memory storage:
- Old data is lost (it was only in RAM)
- New documents will be saved to MongoDB
- No migration needed - just start using the system

## Performance

- **Storage:** ~1-2KB per document (text + embedding)
- **Query Speed:** Fast with indexes
- **Embedding Size:** 384 or 1536 numbers per document
- **Scalability:** MongoDB Atlas scales automatically

## Next Steps

1. ✅ MongoDB connection configured
2. ✅ Indexes created automatically
3. ✅ All CRAG operations use MongoDB
4. 🎉 Ready to use!

Your embeddings are now stored persistently in MongoDB! 🚀

