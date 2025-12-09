import 'dotenv/config';
import axios from 'axios';
import { ObjectId } from 'mongodb';
import { getPersonalRagCollection, getSessionsCollection } from './mongodbService.js';
import * as mongoService from './mongodbService.js';
import { cosineSimilarity } from './cragService.js';

// Reuse embedding generator from cragService by importing lazily
import * as cragService from './cragService.js';

const MAX_RETRIEVAL = 5;

async function ensureIndexes() {
  await mongoService.createIndexes();
}

export async function storeSummary({ userId, title, summary, messages }) {
  await ensureIndexes();
  const collection = await getPersonalRagCollection();
  const sessions = await getSessionsCollection();

  // Generate embedding using cragService
  const embedding = await cragService.generateEmbedding(summary);

  const doc = {
    userId: typeof userId === 'string' ? new ObjectId(userId) : userId,
    title: title || 'Session Summary',
    content: summary,
    embedding,
    metadata: {
      type: 'session_summary',
      messagesCount: messages?.length || 0
    },
    createdAt: new Date()
  };

  await collection.insertOne(doc);

  await sessions.insertOne({
    userId: doc.userId,
    title: doc.title,
    summary,
    createdAt: doc.createdAt
  });

  return { success: true, id: doc._id };
}

export async function getSummaries(userId) {
  const collection = await getPersonalRagCollection();
  const docs = await collection
    .find({ userId: typeof userId === 'string' ? new ObjectId(userId) : userId })
    .sort({ createdAt: -1 })
    .limit(50)
    .toArray();
  return docs.map(d => ({
    id: d._id,
    title: d.title,
    summary: d.content,
    createdAt: d.createdAt
  }));
}

export async function searchPersonalRag(userId, query, topK = 3) {
  const collection = await getPersonalRagCollection();
  const count = await collection.countDocuments({ userId: typeof userId === 'string' ? new ObjectId(userId) : userId });
  if (count === 0) return [];

  const queryEmbedding = await cragService.generateEmbedding(query);
  const docs = await collection.find({ userId: typeof userId === 'string' ? new ObjectId(userId) : userId }).toArray();

  const scored = [];
  for (const doc of docs) {
    if (!doc.embedding || !Array.isArray(doc.embedding)) continue;
    const sim = cosineSimilarity(queryEmbedding, doc.embedding);
    scored.push({
      id: doc._id,
      title: doc.title,
      content: doc.content,
      similarity: sim,
      createdAt: doc.createdAt
    });
  }

  scored.sort((a, b) => b.similarity - a.similarity);
  return scored.slice(0, topK);
}

export async function deleteSummary(userId, summaryId) {
  try {
    const collection = await getPersonalRagCollection();
    const sessions = await getSessionsCollection();
    
    const objectId = typeof summaryId === 'string' ? new ObjectId(summaryId) : summaryId;
    const userIdObj = typeof userId === 'string' ? new ObjectId(userId) : userId;
    
    // Delete from personal_rag_docs collection
    const result = await collection.deleteOne({ 
      _id: objectId,
      userId: userIdObj 
    });
    
    if (result.deletedCount === 0) {
      throw new Error('Summary not found or you do not have permission to delete it');
    }
    
    // Also delete from sessions collection if it exists there
    await sessions.deleteOne({
      userId: userIdObj,
      _id: objectId
    }).catch(() => {
      // Ignore if not found in sessions collection
    });
    
    return { success: true };
  } catch (err) {
    console.error('Error deleting summary:', err);
    throw err;
  }
}

