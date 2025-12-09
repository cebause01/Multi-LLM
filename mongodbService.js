/**
 * MongoDB Service for CRAG Document Storage
 * Handles connection and basic operations
 */

import 'dotenv/config';
import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'multi_llm_crag';
const COLLECTION_NAME = 'documents';
const USERS_COLLECTION = 'users';
const PERSONAL_RAG_COLLECTION = 'personal_rag_docs';
const SESSIONS_COLLECTION = 'sessions';

let client = null;
let db = null;

/**
 * Connect to MongoDB
 */
export async function connectToMongoDB() {
  if (client && db) {
    return { client, db };
  }

  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI is not set in .env file');
  }

  try {
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    db = client.db(MONGODB_DB_NAME);
    console.log('✅ Connected to MongoDB');
    return { client, db };
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    throw error;
  }
}

/**
 * Get the documents collection
 */
export async function getDocumentsCollection() {
  const { db } = await connectToMongoDB();
  return db.collection(COLLECTION_NAME);
}

export async function getUsersCollection() {
  const { db } = await connectToMongoDB();
  return db.collection(USERS_COLLECTION);
}

export async function getPersonalRagCollection() {
  const { db } = await connectToMongoDB();
  return db.collection(PERSONAL_RAG_COLLECTION);
}

export async function getSessionsCollection() {
  const { db } = await connectToMongoDB();
  return db.collection(SESSIONS_COLLECTION);
}

/**
 * Close MongoDB connection
 */
export async function closeMongoDBConnection() {
  if (client) {
    await client.close();
    client = null;
    db = null;
    console.log('MongoDB connection closed');
  }
}

/**
 * Create indexes for better performance
 */
export async function createIndexes() {
  try {
    const collection = await getDocumentsCollection();
    // Create index on docId for faster lookups
    await collection.createIndex({ docId: 1 }, { unique: true });
    // Create index on storedAt for sorting
    await collection.createIndex({ 'metadata.storedAt': -1 });
    
    // Try to create vector search index (MongoDB Atlas Vector Search)
    // Note: This requires MongoDB Atlas with vector search enabled
    // If not available, we'll fall back to in-memory similarity calculation
    try {
      // Check if vector search is available by trying to create a search index
      // This is done via Atlas UI or API, not via driver
      // For now, we'll use in-memory calculation but embeddings are stored as arrays
      console.log('✅ MongoDB indexes created');
      console.log('ℹ️  Embeddings stored as arrays. For vector search, configure Atlas Vector Search index via Atlas UI.');
    } catch (vectorError) {
      // Vector search not available, that's okay - we'll use in-memory calculation
      console.log('✅ MongoDB indexes created (vector search not configured)');
    }

    // Users indexes
    try {
      const users = await getUsersCollection();
      await users.createIndex({ email: 1 }, { unique: true });
    } catch (err) {
      console.error('Error creating users index:', err.message);
    }

    // Personal RAG indexes
    try {
      const rag = await getPersonalRagCollection();
      await rag.createIndex({ userId: 1, createdAt: -1 });
      await rag.createIndex({ embedding: 'text' });
    } catch (err) {
      console.error('Error creating personal RAG index:', err.message);
    }

    // Sessions indexes
    try {
      const sessions = await getSessionsCollection();
      await sessions.createIndex({ userId: 1, createdAt: -1 });
    } catch (err) {
      console.error('Error creating sessions index:', err.message);
    }
  } catch (error) {
    console.error('Error creating indexes:', error);
    // Don't throw - indexes might already exist
  }
}

/**
 * Verify embedding storage format
 */
export async function verifyEmbeddingFormat(docId) {
  try {
    const collection = await getDocumentsCollection();
    const doc = await collection.findOne({ docId });
    
    if (!doc) {
      return { error: 'Document not found' };
    }
    
    return {
      hasEmbedding: !!doc.embedding,
      isArray: Array.isArray(doc.embedding),
      embeddingLength: doc.embedding?.length || 0,
      embeddingType: typeof doc.embedding?.[0],
      sample: doc.embedding?.slice(0, 5) // First 5 values
    };
  } catch (error) {
    console.error('Error verifying embedding format:', error);
    return { error: error.message };
  }
}

