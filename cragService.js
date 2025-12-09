/**
 * CRAG (Corrective Retrieval Augmented Generation) Service
 * 
 * This service implements:
 * 1. Document storage with embeddings
 * 2. Retrieval with relevance evaluation
 * 3. Corrective retrieval if documents are not relevant
 * 4. Context integration for RAG
 */

import 'dotenv/config';
import axios from 'axios';
import * as mongoService from './mongodbService.js';

// Embeddings cache (still in-memory for performance)
const embeddingsCache = new Map(); // Cache for embeddings

// Initialize MongoDB connection and indexes on module load
let mongoInitialized = false;
async function initializeMongoDB() {
  if (mongoInitialized) return;
  try {
    await mongoService.connectToMongoDB();
    await mongoService.createIndexes();
    mongoInitialized = true;
  } catch (error) {
    console.error('Failed to initialize MongoDB:', error);
    // Continue with in-memory fallback if MongoDB fails
  }
}

// Initialize on import
initializeMongoDB().catch(console.error);

// Configuration
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
if (!OPENROUTER_API_KEY) {
  console.error('⚠️  WARNING: OPENROUTER_API_KEY is not set in .env file');
  console.error('   CRAG functionality will not work without an API key');
  console.error('   Please create a .env file with your OpenRouter API key');
  console.error('   Get your API key from: https://openrouter.ai/keys');
}

const OPENROUTER_EMBEDDING_URL = 'https://openrouter.ai/api/v1/embeddings';

// Relevance threshold (0-1, higher = more strict)
const RELEVANCE_THRESHOLD = 0.7;

// Maximum number of documents to retrieve
const MAX_RETRIEVAL_COUNT = 5;

/**
 * Generate embedding for text using OpenRouter API
 */
export async function generateEmbedding(text) {
  if (!text || text.trim().length === 0) {
    throw new Error('Text cannot be empty');
  }

  // Check cache first
  const cacheKey = text.substring(0, 100); // Use first 100 chars as cache key
  if (embeddingsCache.has(cacheKey)) {
    return embeddingsCache.get(cacheKey);
  }

  if (!OPENROUTER_API_KEY) {
    // Fallback to simple embedding if API key is not set
    return generateSimpleEmbedding(text);
  }

  try {
    // Truncate text if too long (OpenRouter has limits)
    const maxLength = 8000; // Safe limit for embeddings
    const truncatedText = text.length > maxLength ? text.substring(0, maxLength) : text;
    
    // Use OpenRouter for embeddings (supports OpenAI-compatible models)
    // Try different model formats - OpenRouter may use different naming
    const modelsToTry = [
      'openai/text-embedding-ada-002',
      'text-embedding-ada-002',
      'openai/text-embedding-3-small',
      'text-embedding-3-small'
    ];
    
    let lastError = null;
    for (const modelName of modelsToTry) {
      try {
        const response = await axios.post(
          OPENROUTER_EMBEDDING_URL,
          {
            model: modelName,
            input: truncatedText // Can be string or array of strings
          },
          {
            headers: {
              'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
              'Content-Type': 'application/json',
              'HTTP-Referer': 'http://localhost:3000',
              'X-Title': 'Multi-LLM Chat CRAG'
            },
            timeout: 30000
          }
        );

        if (!response.data) {
          throw new Error('Invalid embedding response: no data');
        }

        // Handle different response formats
        let embedding;
        if (response.data.data && Array.isArray(response.data.data) && response.data.data[0]) {
          // OpenAI format: { data: [{ embedding: [...] }] }
          embedding = response.data.data[0].embedding;
        } else if (response.data.embedding && Array.isArray(response.data.embedding)) {
          // Direct embedding format: { embedding: [...] }
          embedding = response.data.embedding;
        } else if (Array.isArray(response.data)) {
          // Array format: [...]
          embedding = response.data;
        } else {
          throw new Error('Invalid embedding response format');
        }

        if (!embedding || !Array.isArray(embedding) || embedding.length === 0) {
          throw new Error('Invalid embedding: not an array or empty');
        }
        
        // Cache the embedding
        embeddingsCache.set(cacheKey, embedding);
        console.log(`Successfully generated embedding using model: ${modelName}`);
        
        return embedding;
      } catch (error) {
        lastError = error;
        console.log(`Model ${modelName} failed: ${error.message}`);
        if (error.response) {
          console.error('API Error Response:', error.response.data);
        }
        continue; // Try next model
      }
    }
    
    // If all models failed, fall back to simple embedding
    console.error('All embedding models failed, using fallback');
    if (lastError && lastError.response) {
      console.error('Last API Error:', lastError.response.data);
    }
    return generateSimpleEmbedding(text);
  } catch (error) {
    console.error('Error generating embedding:', error.message);
    if (error.response) {
      console.error('API Error Response:', error.response.data);
      console.error('Status:', error.response.status);
    }
    // Fallback: return a simple hash-based embedding for basic functionality
    console.log('Falling back to simple embedding generation');
    return generateSimpleEmbedding(text);
  }
}

/**
 * Simple fallback embedding (hash-based, not as good but works offline)
 */
function generateSimpleEmbedding(text) {
  // Simple TF-IDF-like vector (for fallback when API fails)
  const words = text.toLowerCase().split(/\s+/);
  const vector = new Array(384).fill(0); // Standard embedding dimension
  
  words.forEach((word, idx) => {
    const hash = word.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    vector[hash % 384] += 1 / (idx + 1); // Simple weighting
  });
  
  // Normalize
  const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  return magnitude > 0 ? vector.map(v => v / magnitude) : vector;
}

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(vec1, vec2) {
  if (vec1.length !== vec2.length) {
    throw new Error('Vectors must have the same length');
  }

  let dotProduct = 0;
  let magnitude1 = 0;
  let magnitude2 = 0;

  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
    magnitude1 += vec1[i] * vec1[i];
    magnitude2 += vec2[i] * vec2[i];
  }

  magnitude1 = Math.sqrt(magnitude1);
  magnitude2 = Math.sqrt(magnitude2);

  if (magnitude1 === 0 || magnitude2 === 0) {
    return 0;
  }

  return dotProduct / (magnitude1 * magnitude2);
}

/**
 * Store a document with its embedding
 */
export async function storeDocument(docId, text, metadata = {}) {
  try {
    await initializeMongoDB();
    const embedding = await generateEmbedding(text);
    
    const collection = await mongoService.getDocumentsCollection();
    
    // Ensure embedding is a proper array of numbers
    if (!Array.isArray(embedding)) {
      throw new Error('Embedding must be an array');
    }
    
    // Verify all values are numbers
    if (!embedding.every(val => typeof val === 'number')) {
      throw new Error('Embedding must contain only numbers');
    }
    
    const document = {
      docId,
      text,
      embedding: embedding, // Store as array of numbers - MongoDB will store this as a proper array
      metadata: {
        ...metadata,
        storedAt: new Date().toISOString(),
        docId
      },
      createdAt: new Date()
    };

    // Use upsert to handle duplicates
    await collection.updateOne(
      { docId },
      { $set: document },
      { upsert: true }
    );

    return { success: true, docId };
  } catch (error) {
    console.error('Error storing document:', error);
    throw error;
  }
}

/**
 * Retrieve relevant documents based on query
 */
export async function retrieveDocuments(query, topK = MAX_RETRIEVAL_COUNT) {
  try {
    await initializeMongoDB();
    const collection = await mongoService.getDocumentsCollection();
    
    // Check if there are any documents
    const count = await collection.countDocuments();
    if (count === 0) {
      return [];
    }

    const queryEmbedding = await generateEmbedding(query);
    
    // Get all documents from MongoDB
    const documents = await collection.find({}).toArray();
    
    // Calculate similarity for all documents
    const similarities = [];
    for (const doc of documents) {
      if (!doc.embedding || !Array.isArray(doc.embedding)) {
        continue; // Skip documents without valid embeddings
      }
      
      const similarity = cosineSimilarity(queryEmbedding, doc.embedding);
      similarities.push({
        docId: doc.docId,
        text: doc.text,
        metadata: doc.metadata || {},
        similarity
      });
    }

    // Sort by similarity (descending)
    similarities.sort((a, b) => b.similarity - a.similarity);

    // Return top K documents
    return similarities.slice(0, topK);
  } catch (error) {
    console.error('Error retrieving documents:', error);
    return [];
  }
}

/**
 * Evaluate relevance of retrieved documents using LLM
 */
export async function evaluateRelevance(query, retrievedDocs) {
  if (!retrievedDocs || retrievedDocs.length === 0) {
    return { isRelevant: false, score: 0, reason: 'No documents retrieved' };
  }

  try {
    const docsText = retrievedDocs
      .map((doc, idx) => `Document ${idx + 1} (similarity: ${doc.similarity.toFixed(3)}):\n${doc.text.substring(0, 500)}...`)
      .join('\n\n');

    const evaluationPrompt = `You are evaluating whether retrieved documents are relevant to a user query.

User Query: ${query}

Retrieved Documents:
${docsText}

Evaluate the relevance of these documents to the query. Consider:
1. Do the documents contain information directly related to the query?
2. Are the documents useful for answering the query?
3. Is the information accurate and up-to-date?

Respond in JSON format:
{
  "isRelevant": true/false,
  "score": 0.0-1.0,
  "reason": "brief explanation"
}`;

    if (!OPENROUTER_API_KEY) {
      throw new Error('OPENROUTER_API_KEY not set');
    }

    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'google/gemini-2.0-flash-exp:free',
        messages: [
          {
            role: 'user',
            content: evaluationPrompt
          }
        ]
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://localhost:3000',
          'X-Title': 'Multi-LLM Chat CRAG'
        },
        timeout: 30000
      }
    );

    const content = response.data.choices[0].message.content;
    
    // Try to parse JSON from response
    let evaluation;
    try {
      // Extract JSON from response (might have markdown code blocks)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        evaluation = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      // Fallback: use similarity scores
      const avgSimilarity = retrievedDocs.reduce((sum, doc) => sum + doc.similarity, 0) / retrievedDocs.length;
      evaluation = {
        isRelevant: avgSimilarity >= RELEVANCE_THRESHOLD,
        score: avgSimilarity,
        reason: 'Using similarity score as fallback'
      };
    }

    return evaluation;
  } catch (error) {
    console.error('Error evaluating relevance:', error);
    // Fallback to similarity-based evaluation
    const avgSimilarity = retrievedDocs.reduce((sum, doc) => sum + doc.similarity, 0) / retrievedDocs.length;
    return {
      isRelevant: avgSimilarity >= RELEVANCE_THRESHOLD,
      score: avgSimilarity,
      reason: 'Fallback evaluation using similarity scores'
    };
  }
}

/**
 * Corrective retrieval: refine query and retrieve again if needed
 */
export async function correctiveRetrieval(query, initialDocs, evaluation) {
  if (evaluation.isRelevant && evaluation.score >= RELEVANCE_THRESHOLD) {
    return { docs: initialDocs, corrected: false };
  }

  if (!OPENROUTER_API_KEY) {
    return { docs: initialDocs, corrected: false, error: 'OPENROUTER_API_KEY not set' };
  }

  try {
    // Generate a refined query based on the evaluation
    const refinementPrompt = `The initial retrieval for this query did not return relevant documents.

Original Query: ${query}
Evaluation: ${evaluation.reason}
Relevance Score: ${evaluation.score.toFixed(2)}

Generate a refined search query that would better retrieve relevant documents. Focus on:
1. Key terms and concepts from the original query
2. Synonyms or related terms
3. More specific or more general terms as needed

Respond with ONLY the refined query, nothing else:`;

    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'google/gemini-2.0-flash-exp:free',
        messages: [
          {
            role: 'user',
            content: refinementPrompt
          }
        ]
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://localhost:3000',
          'X-Title': 'Multi-LLM Chat CRAG'
        },
        timeout: 30000
      }
    );

    const refinedQuery = response.data.choices[0].message.content.trim();
    
    // Retrieve with refined query
    const correctedDocs = await retrieveDocuments(refinedQuery, MAX_RETRIEVAL_COUNT);
    
    return {
      docs: correctedDocs,
      corrected: true,
      originalQuery: query,
      refinedQuery
    };
  } catch (error) {
    console.error('Error in corrective retrieval:', error);
    // Return original docs if correction fails
    return { docs: initialDocs, corrected: false, error: error.message };
  }
}

/**
 * Main CRAG function: retrieve, evaluate, and correct if needed
 */
export async function performCRAG(query, enableCorrection = true) {
  try {
    // Step 1: Initial retrieval
    const initialDocs = await retrieveDocuments(query, MAX_RETRIEVAL_COUNT);
    
    if (initialDocs.length === 0) {
      return {
        documents: [],
        context: '',
        evaluation: { isRelevant: false, score: 0, reason: 'No documents found in knowledge base' },
        corrected: false
      };
    }

    // Step 2: Evaluate relevance
    const evaluation = await evaluateRelevance(query, initialDocs);
    
    // Step 3: Corrective retrieval if needed
    let finalDocs = initialDocs;
    let corrected = false;
    let refinedQuery = null;

    if (enableCorrection && (!evaluation.isRelevant || evaluation.score < RELEVANCE_THRESHOLD)) {
      const correctionResult = await correctiveRetrieval(query, initialDocs, evaluation);
      finalDocs = correctionResult.docs;
      corrected = correctionResult.corrected;
      refinedQuery = correctionResult.refinedQuery;
    }

    // Step 4: Build context from retrieved documents
    const context = finalDocs
      .map((doc, idx) => `[Document ${idx + 1}]\n${doc.text}`)
      .join('\n\n---\n\n');

    return {
      documents: finalDocs,
      context,
      evaluation,
      corrected,
      refinedQuery,
      originalQuery: query
    };
  } catch (error) {
    console.error('Error in CRAG:', error);
    return {
      documents: [],
      context: '',
      evaluation: { isRelevant: false, score: 0, reason: `Error: ${error.message}` },
      corrected: false
    };
  }
}

/**
 * Get all stored documents
 */
export async function getAllDocuments() {
  try {
    await initializeMongoDB();
    const collection = await mongoService.getDocumentsCollection();
    const documents = await collection.find({}).toArray();
    
    return documents.map(doc => ({
      docId: doc.docId,
      text: doc.text ? doc.text.substring(0, 200) + '...' : '', // Preview
      metadata: doc.metadata || {}
    }));
  } catch (error) {
    console.error('Error getting all documents:', error);
    return [];
  }
}

/**
 * Delete a document
 */
export async function deleteDocument(docId) {
  try {
    await initializeMongoDB();
    const collection = await mongoService.getDocumentsCollection();
    const result = await collection.deleteOne({ docId });
    return result.deletedCount > 0;
  } catch (error) {
    console.error('Error deleting document:', error);
    return false;
  }
}

/**
 * Clear all documents
 */
export async function clearAllDocuments() {
  try {
    await initializeMongoDB();
    const collection = await mongoService.getDocumentsCollection();
    await collection.deleteMany({});
    embeddingsCache.clear(); // Clear cache too
    return { success: true, message: 'All documents cleared' };
  } catch (error) {
    console.error('Error clearing documents:', error);
    throw error;
  }
}

/**
 * Get document count
 */
export async function getDocumentCount() {
  try {
    await initializeMongoDB();
    const collection = await mongoService.getDocumentsCollection();
    return await collection.countDocuments();
  } catch (error) {
    console.error('Error getting document count:', error);
    return 0;
  }
}

