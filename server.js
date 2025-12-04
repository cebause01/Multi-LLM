import express from 'express';
import cors from 'cors';
import multer from 'multer';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;

app.use(cors());
// Parse JSON bodies - must come before routes
app.use(express.json({ limit: '50mb' })); // Increased limit for base64 images
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const upload = multer({ dest: uploadsDir });

const OPENROUTER_API_KEY = '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';
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Helper function to convert file to base64
function fileToBase64(filePath) {
  return fs.readFileSync(filePath, { encoding: 'base64' });
}

// Helper function to get mime type
function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.pdf': 'application/pdf',
    '.txt': 'text/plain',
    '.md': 'text/markdown',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

// Chat completion endpoint
app.post('/api/chat', async (req, res) => {
  try {
    // Debug: Check if body is parsed
    console.log('Request Content-Type:', req.get('Content-Type'));
    console.log('Request body type:', typeof req.body);
    console.log('Request body exists:', !!req.body);
    console.log('Request body keys:', req.body ? Object.keys(req.body) : 'undefined');
    
    // Ensure body is parsed - handle case where it might be undefined
    if (!req.body) {
      console.error('req.body is undefined. Content-Type:', req.get('Content-Type'));
      return res.status(400).json({ 
        error: 'Request body is missing. Make sure Content-Type is application/json',
        contentType: req.get('Content-Type'),
        hint: 'The request should be sent as JSON, not FormData'
      });
    }
    
    if (typeof req.body !== 'object') {
      return res.status(400).json({ 
        error: 'Invalid request body format',
        contentType: req.get('Content-Type'),
        bodyType: typeof req.body
      });
    }
    
    const { text, models, judgeModel, images, files } = req.body || {};
    
    // Debug logging
    console.log('Received request body:', { 
      text: text?.substring(0, 50), 
      models, 
      judgeModel,
      imagesCount: images?.length || 0,
      filesCount: files?.length || 0
    });
    
    // Check if models field exists
    if (!models || models === null) {
      return res.status(400).json({ 
        error: 'Models field is missing',
        receivedFields: Object.keys(req.body)
      });
    }
    
    // Ensure models is an array
    let modelsArray;
    if (Array.isArray(models)) {
      modelsArray = models;
    } else {
      return res.status(400).json({ 
        error: 'Models must be an array',
        received: typeof models
      });
    }
    
    console.log('Parsed models:', modelsArray);
    console.log('Models count:', modelsArray.length);
    
    if (!text && (!images || images.length === 0) && (!files || files.length === 0)) {
      return res.status(400).json({ error: 'No input provided' });
    }

    if (modelsArray.length !== 5) {
      return res.status(400).json({ 
        error: 'Exactly 5 models must be selected',
        received: modelsArray.length,
        models: modelsArray
      });
    }

    // Build content array
    const content = [];
    
    if (text) {
      content.push({
        type: 'text',
        text: text
      });
    }

    // Handle images (already in base64 format from frontend)
    if (images && Array.isArray(images) && images.length > 0) {
      for (const image of images) {
        if (image.data && image.mimeType) {
          content.push({
            type: 'image_url',
            image_url: {
              url: `data:${image.mimeType};base64,${image.data}`
            }
          });
        }
      }
    }

    // Handle files (already converted to text or base64 by frontend)
    if (files && Array.isArray(files) && files.length > 0) {
      for (const file of files) {
        if (file.type === 'text' && file.content) {
          content.push({
            type: 'text',
            text: `\n[File: ${file.name}]\n${file.content}\n`
          });
        } else if (file.type === 'base64' && file.data) {
          content.push({
            type: 'text',
            text: `\n[File: ${file.name} - Base64 encoded, MIME type: ${file.mimeType}]\n`
          });
        }
      }
    }

    // Ensure content is not empty
    if (content.length === 0) {
      return res.status(400).json({ error: 'No valid content provided' });
    }

    // Send the SAME prompt to all 5 models simultaneously (in parallel)
    // Each request uses the same content, only the model name changes
    console.log(`Sending same prompt to ${modelsArray.length} models in parallel:`, modelsArray);
    console.log('Prompt content types:', content.map(c => c.type));
    
    const modelPromises = modelsArray.map((model, index) => {
      console.log(`Creating request ${index + 1}/5 for model: ${model}`);
      
      // Build request payload - some models don't support provider parameter
      const requestPayload = {
        model: model, // Only the model name changes, prompt stays the same
        messages: [
          {
            role: 'user',
            content: content // Same content for all 5 models
          }
        ]
      };
      
      // Only add provider parameter for models that support it (optional)
      // Some models may reject requests with provider parameter
      
      return axios.post(
        OPENROUTER_API_URL,
        requestPayload,
        {
          headers: {
            'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'http://localhost:3000',
            'X-Title': 'Multi-LLM Chat'
          }
        }
      ).then(response => {
        console.log(`✓ Response received from model: ${model}`);
        return {
          model: model,
          response: response.data.choices[0].message.content
        };
      }).catch(error => {
        const errorDetails = error.response?.data || {};
        const errorMessage = errorDetails.error?.message || errorDetails.message || error.message;
        const errorType = errorDetails.error?.type || errorDetails.type || 'Unknown error';
        const errorCode = errorDetails.error?.code || error.response?.status;
        
        console.error(`✗ Error from model ${model}:`, errorMessage);
        console.error(`  Error type: ${errorType}`);
        console.error(`  Error code: ${errorCode}`);
        console.error(`  Full error:`, JSON.stringify(errorDetails, null, 2));
        
        // Create a more descriptive error message
        let displayError = errorMessage;
        
        // Check for specific error cases
        if (errorMessage.includes('data policy') || errorMessage.includes('Free model publication')) {
          displayError = `Privacy settings required: To use free models, configure your OpenRouter privacy settings at https://openrouter.ai/settings/privacy. The model "${model}" requires free model publication to be enabled.`;
        } else if (errorMessage.includes('provider') || errorMessage.includes('Provider')) {
          displayError = `Model unavailable: ${errorMessage}. The model "${model}" may not be available on OpenRouter or the model name might be incorrect.`;
        } else if (errorCode === 404) {
          if (errorMessage.includes('No endpoints found')) {
            displayError = `Model not available: "${model}" is not available with your current OpenRouter settings. This may require privacy settings configuration or the model may not exist.`;
          } else {
            displayError = `Model not found: "${model}" is not available on OpenRouter. Please check the model name.`;
          }
        } else if (errorCode === 401 || errorCode === 403) {
          displayError = `Authentication error: ${errorMessage}`;
        } else if (errorCode === 429) {
          displayError = `Rate limit exceeded: ${errorMessage}. Please try again later.`;
        } else if (errorCode >= 500) {
          displayError = `Server error: ${errorMessage}. The OpenRouter service may be experiencing issues.`;
        }
        
        return {
          model: model,
          error: displayError,
          errorType: errorType,
          errorCode: errorCode
        };
      });
    });

    // Execute all 5 requests in parallel - they all start at the same time
    console.log('Waiting for all 5 model responses in parallel...');
    const startTime = Date.now();
    const modelResponses = await Promise.all(modelPromises);
    const endTime = Date.now();
    console.log(`All ${modelResponses.length} responses received in ${endTime - startTime}ms`);

    // Send all responses to judge model
    const judgePrompt = `You are an expert judge evaluating AI model responses. Below are 5 different responses to the same user query. Please evaluate each response and select the BEST one. Consider factors like accuracy, completeness, clarity, and helpfulness.

User Query: ${text || '[Image/File input]'}

Responses:
${modelResponses.map((r, i) => `\n${i + 1}. Model: ${r.model}\nResponse: ${r.response || r.error || 'No response'}`).join('\n')}

Please respond with ONLY the number (1-5) of the best response, followed by a brief explanation of why it's the best. Format: "BEST: [number]\nREASON: [explanation]"`;

    const judgeResponse = await axios.post(
      OPENROUTER_API_URL,
      {
        model: judgeModel || 'google/gemini-2.0-flash-exp:free',
        messages: [
          {
            role: 'user',
            content: judgePrompt
          }
        ]
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://localhost:3000',
          'X-Title': 'Multi-LLM Chat'
        }
      }
    );

    const judgeResult = judgeResponse.data.choices[0].message.content;
    
    // Parse judge result to find best response
    const bestMatch = judgeResult.match(/BEST:\s*(\d+)/i);
    const bestIndex = bestMatch ? parseInt(bestMatch[1]) - 1 : 0;
    const reasonMatch = judgeResult.match(/REASON:\s*(.+)/is);
    const reason = reasonMatch ? reasonMatch[1].trim() : 'Selected by judge model';

    res.json({
      allResponses: modelResponses,
      judgeResult: judgeResult,
      bestResponse: {
        index: bestIndex,
        model: modelResponses[bestIndex].model,
        response: modelResponses[bestIndex].response || modelResponses[bestIndex].error,
        reason: reason
      }
    });

  } catch (error) {
    console.error('Error:', error);
    console.error('Error details:', error.response?.data || error.message);
    res.status(500).json({ 
      error: error.response?.data?.error?.message || 'Internal server error',
      message: error.message,
      details: error.response?.data || null
    });
  }
});

// Get available models
app.get('/api/models', async (req, res) => {
  try {
    const response = await axios.get('https://openrouter.ai/api/v1/models', {
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`
      }
    });
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch models' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

