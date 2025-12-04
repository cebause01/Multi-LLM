import express from 'express';
import cors from 'cors';
import multer from 'multer';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import PDFDocument from 'pdfkit';

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
    
    const { text, models, judgeModel, images, files, hipaaEnabled, conversationHistory } = req.body || {};
    
    // Debug logging
    console.log('Received request body:', { 
      text: text?.substring(0, 50), 
      models, 
      judgeModel,
      imagesCount: images?.length || 0,
      filesCount: files?.length || 0,
      hipaaEnabled: hipaaEnabled || false
    });
    
    if (hipaaEnabled) {
      console.log('🔒 HIPAA compliance mode ENABLED - PHI/PII filtering will be applied');
    }
    
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

    if (modelsArray.length === 0) {
      return res.status(400).json({ 
        error: 'At least 1 model must be selected',
        received: modelsArray.length,
        models: modelsArray
      });
    }

    // Build content array
    const content = [];
    
    // Add HIPAA compliance instructions if enabled
    let hipaaInstructions = '';
    if (hipaaEnabled) {
      // Detect if context is medical (contains medical keywords)
      const medicalKeywords = ['patient', 'medical', 'health', 'diagnosis', 'treatment', 'symptom', 'disease', 'illness', 'clinic', 'hospital', 'doctor', 'physician', 'nurse', 'medication', 'prescription', 'mrn', 'medical record'];
      const isMedicalContext = medicalKeywords.some(keyword => 
        text?.toLowerCase().includes(keyword) || 
        (files && files.some(f => f.content?.toLowerCase().includes(keyword)))
      );
      
      const genericTerm = isMedicalContext ? 'the patient' : 'the individual';
      
      hipaaInstructions = `\n\nIMPORTANT: When responding, you must:
- Use ONLY generic terms like "${genericTerm}", "the person", or "this individual" - NEVER use specific names
- NEVER repeat phone numbers, email addresses, Social Security numbers, medical record numbers, dates of birth, addresses, or any identifying information
- NEVER calculate or mention specific ages based on dates provided
- Provide your response naturally and professionally without explicitly mentioning HIPAA compliance or that you're avoiding PHI/PII
- Simply respond as if you only have anonymized information
- Focus on the content without referencing any identifying details\n`;
    }
    
    if (text) {
      content.push({
        type: 'text',
        text: text + hipaaInstructions
      });
    } else if (hipaaInstructions) {
      // If no text but HIPAA is enabled, add instructions separately
      content.push({
        type: 'text',
        text: hipaaInstructions.trim()
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
          // Text files: include the content
          content.push({
            type: 'text',
            text: `\n[File: ${file.name}]\n${file.content}\n`
          });
        } else if (file.type === 'base64' && file.data) {
          // Binary files (non-PDF): note that the file was uploaded
          // PDFs are now extracted as text on the frontend, so they won't reach here
          // Other binary files (images, etc.) are noted but not processed
          content.push({
            type: 'text',
            text: `\n[File uploaded: ${file.name} (${file.mimeType || 'binary file'})]\nNote: This is a binary file that cannot be processed as text. PDF files are automatically extracted, but other binary files like images cannot be read as text.\n`
          });
        }
      }
    }

    // Ensure content is not empty
    if (content.length === 0) {
      return res.status(400).json({ error: 'No valid content provided' });
    }

    // Send the SAME prompt to all selected models simultaneously (in parallel)
    // Each request uses the same content, only the model name changes
    console.log(`Sending same prompt to ${modelsArray.length} model(s) in parallel:`, modelsArray);
    console.log('Prompt content types:', content.map(c => c.type));
    
    const modelPromises = modelsArray.map((model, index) => {
      console.log(`Creating request ${index + 1}/5 for model: ${model}`);
      
      // Check if user requested a document format
      const userText = text || '';
      const isDocumentRequest = /(?:pdf|docx|word\s+document|download\s+(?:as\s+)?(?:pdf|docx)|give\s+me\s+(?:in\s+|as\s+)?(?:pdf|docx)|create\s+(?:a\s+)?(?:pdf|docx)|make\s+(?:a\s+)?(?:pdf|docx)|generate\s+(?:a\s+)?(?:pdf|docx))/i.test(userText);
      
      // Build request payload - some models don't support provider parameter
      const messagesArray = [];
      
      // Add system message if document is requested
      // Note: Some models (like Gemma 3 12B) may not support system messages well
      // We'll add it to the user message instead for better compatibility
      let documentInstructions = '';
      if (isDocumentRequest) {
        documentInstructions = '\n\nNote: The user has requested this content as a PDF/DOCX file. Provide the content directly and naturally mention it\'s ready for download.';
        // Try adding as system message, but some models may reject it
        // For now, we'll add instructions to the user message for better compatibility
      }
      
      // Include conversation history if provided
      // Some models (like Gemma 3 12B) may be sensitive to history format
      if (conversationHistory && Array.isArray(conversationHistory) && conversationHistory.length > 0) {
        // Add all previous messages from conversation history (skip the last one as it's the current message)
        const historyMessages = conversationHistory.slice(0, -1);
        historyMessages.forEach((msg) => {
          if (msg && msg.role && msg.content) {
            // Ensure content is a string for history messages (not multimodal array)
            // Some models require strict string format for history
            let contentStr;
            if (typeof msg.content === 'string') {
              contentStr = msg.content;
            } else if (Array.isArray(msg.content)) {
              // For multimodal arrays in history, extract just the text parts
              const textParts = msg.content
                .filter(c => c.type === 'text' && c.text)
                .map(c => c.text)
                .join('\n');
              contentStr = textParts || JSON.stringify(msg.content);
            } else {
              contentStr = String(msg.content || '');
            }
            
            // Only add non-empty messages
            if (contentStr.trim()) {
              messagesArray.push({
                role: msg.role,
                content: contentStr.trim()
              });
            }
          }
        });
      }
      
      // Add current user message with full content (including images/files)
      // For document requests, append instructions to the text content if it's a string
      let finalContent = content;
      if (isDocumentRequest && documentInstructions) {
        if (Array.isArray(content)) {
          // If content is multimodal array, add instructions to the last text element
          const textElements = content.filter(c => c.type === 'text');
          if (textElements.length > 0) {
            const lastTextIndex = content.lastIndexOf(textElements[textElements.length - 1]);
            finalContent = [...content];
            finalContent[lastTextIndex] = {
              ...finalContent[lastTextIndex],
              text: finalContent[lastTextIndex].text + documentInstructions
            };
          } else {
            // No text element, add one
            finalContent = [...content, { type: 'text', text: documentInstructions }];
          }
        } else if (typeof content === 'string') {
          finalContent = content + documentInstructions;
        }
      }
      
      messagesArray.push({
        role: 'user',
        content: finalContent // Same content for all models (can be array for multimodal)
      });
      
      const requestPayload = {
        model: model, // Only the model name changes, prompt stays the same
        messages: messagesArray
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
          },
          timeout: 60000 // 60 second timeout
        }
      ).then(response => {
        console.log(`✓ Response received from model: ${model}`);
        if (!response.data || !response.data.choices || !response.data.choices[0]) {
          console.error(`✗ Invalid response structure from ${model}:`, response.data);
          return {
            model: model,
            error: 'Invalid response structure from model'
          };
        }
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
        console.error(`  Request payload (first 500 chars):`, JSON.stringify(requestPayload).substring(0, 500));
        console.error(`  Full error:`, JSON.stringify(errorDetails, null, 2));
        
        // Create a more descriptive error message
        let displayError = errorMessage;
        
        // Check for specific error cases
        if (errorMessage.includes('User not found') || errorMessage.includes('user not found')) {
          displayError = `Authentication error: Your OpenRouter API key is invalid or expired. Please check your API key in server.js. Get a new key at https://openrouter.ai/keys`;
        } else if (errorMessage.includes('data policy') || errorMessage.includes('Free model publication')) {
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
          if (errorMessage.includes('User not found') || errorMessage.includes('user not found') || errorMessage.includes('Invalid API key')) {
            displayError = `Authentication error: Your OpenRouter API key is invalid or expired. Please check your API key in server.js. Get a new key at https://openrouter.ai/keys`;
          } else {
            displayError = `Authentication error: ${errorMessage}. Please check your OpenRouter API key.`;
          }
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

    // Execute all requests in parallel - they all start at the same time
    console.log(`Waiting for all ${modelsArray.length} model response(s) in parallel...`);
    const startTime = Date.now();
    const modelResponses = await Promise.all(modelPromises);
    const endTime = Date.now();
    console.log(`All ${modelResponses.length} response(s) received in ${endTime - startTime}ms`);

    // Filter PHI/PII from responses if HIPAA is enabled
    const filterPHI = (text, inputText = '') => {
      if (!text || !hipaaEnabled) return text;
      
      // Extract PHI/PII from the original user input to identify what to redact
      const sourceText = inputText || text || '';
      
      // Detect if context is medical to use appropriate generic term
      const medicalKeywords = ['patient', 'medical', 'health', 'diagnosis', 'treatment', 'symptom', 'disease', 'illness', 'clinic', 'hospital', 'doctor', 'physician', 'nurse', 'medication', 'prescription', 'mrn', 'medical record'];
      const isMedicalContext = medicalKeywords.some(keyword => 
        sourceText.toLowerCase().includes(keyword) || 
        text.toLowerCase().includes(keyword)
      );
      const genericTerm = isMedicalContext ? 'the patient' : 'the individual';
      const extractedPHI = {
        names: [],
        phones: [],
        emails: [],
        ssns: [],
        mrns: [],
        dates: [],
        addresses: [],
        accountNumbers: [],
        licenseNumbers: [],
        faxNumbers: [],
        urls: []
      };
      
      // Extract from input text
      if (sourceText) {
        // Extract names (common first/last name patterns - capitalized words)
        const namePattern = /\b([A-Z][a-z]+)\s+([A-Z][a-z]+)\b/g;
        let match;
        while ((match = namePattern.exec(sourceText)) !== null) {
          const fullName = match[0];
          if (!extractedPHI.names.includes(fullName)) {
            extractedPHI.names.push(fullName);
          }
        }
        
        // Extract phone numbers
        const phonePattern = /\b\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g;
        extractedPHI.phones = [...new Set(sourceText.match(phonePattern) || [])];
        
        // Extract emails
        const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
        extractedPHI.emails = [...new Set(sourceText.match(emailPattern) || [])];
        
        // Extract SSNs
        const ssnPattern = /\b\d{3}-?\d{2}-?\d{4}\b/g;
        extractedPHI.ssns = [...new Set(sourceText.match(ssnPattern) || [])];
        
        // Extract MRNs (various formats)
        const mrnPattern = /MRN[:\s-]?#?-?\d+/gi;
        extractedPHI.mrns = [...new Set(sourceText.match(mrnPattern) || [])];
        
        // Extract dates (multiple formats: MM/DD/YYYY, YYYY-MM-DD, DD-MM-YYYY)
        const datePattern1 = /\b(0?[1-9]|1[0-2])[\/\-](0?[1-9]|[12][0-9]|3[01])[\/\-]\d{4}\b/g; // MM/DD/YYYY
        const datePattern2 = /\b\d{4}[\/\-](0?[1-9]|1[0-2])[\/\-](0?[1-9]|[12][0-9]|3[01])\b/g; // YYYY-MM-DD
        const datePattern3 = /\b(0?[1-9]|[12][0-9]|3[01])[\/\-](0?[1-9]|1[0-2])[\/\-]\d{4}\b/g; // DD-MM-YYYY
        extractedPHI.dates = [
          ...new Set([
            ...(sourceText.match(datePattern1) || []),
            ...(sourceText.match(datePattern2) || []),
            ...(sourceText.match(datePattern3) || [])
          ])
        ];
        
        // Extract addresses (street addresses with numbers)
        const addressPattern = /\b\d+\s+[A-Za-z0-9\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct|Way|Circle|Cir|Place|Pl)\b/gi;
        extractedPHI.addresses = [...new Set(sourceText.match(addressPattern) || [])];
        
        // Extract zip codes (5 digits or 5+4 format)
        const zipPattern = /\b\d{5}(?:-\d{4})?\b/g;
        const zipCodes = sourceText.match(zipPattern) || [];
        if (zipCodes.length > 0) {
          extractedPHI.addresses.push(...zipCodes);
        }
        
        // Extract account numbers (various formats: Account #, Acct #, etc.)
        const accountPattern = /(?:Account|Acct|Account Number|Acct #)[:\s#-]*\d{4,}/gi;
        extractedPHI.accountNumbers = [...new Set(sourceText.match(accountPattern) || [])];
        
        // Extract license numbers (Driver's License, DL, License #)
        const licensePattern = /(?:Driver'?s?\s+License|DL|License\s+#?|License Number)[:\s#-]*[A-Z0-9]{5,}/gi;
        extractedPHI.licenseNumbers = [...new Set(sourceText.match(licensePattern) || [])];
        
        // Extract passport numbers
        const passportPattern = /(?:Passport|Passport\s+#?|Passport Number)[:\s#-]*[A-Z0-9]{6,}/gi;
        extractedPHI.licenseNumbers = [...new Set([
          ...extractedPHI.licenseNumbers,
          ...(sourceText.match(passportPattern) || [])
        ])];
        
        // Extract fax numbers
        const faxPattern = /(?:Fax|FAX)[:\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/gi;
        extractedPHI.faxNumbers = [...new Set(sourceText.match(faxPattern) || [])];
        
        // Extract URLs
        const urlPattern = /https?:\/\/[^\s]+/gi;
        extractedPHI.urls = [...new Set(sourceText.match(urlPattern) || [])];
      }
      
      let filtered = text;
      
      // Redact extracted PHI/PII from input
      extractedPHI.names.forEach(name => {
        const nameParts = name.split(' ');
        // Redact full name - replace with context-appropriate generic term
        filtered = filtered.replace(new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), genericTerm);
        // Redact individual name parts
        nameParts.forEach(part => {
          if (part.length > 2) {
            // Replace with context-appropriate generic term
            filtered = filtered.replace(new RegExp(`\\b${part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi'), genericTerm);
          }
        });
      });
      
      // Also replace any remaining [NAME] or [PATIENT NAME] placeholders with natural terms
      filtered = filtered.replace(/\[NAME\]/gi, genericTerm);
      filtered = filtered.replace(/\[PATIENT NAME\]/gi, genericTerm);
      
      // Clean up any awkward phrasing that might result from filtering
      filtered = filtered.replace(/\bthe\s+\[NAME\]/gi, genericTerm);
      filtered = filtered.replace(/\[NAME\]'s/gi, `${genericTerm}'s`);
      
      extractedPHI.phones.forEach(phone => {
        const escapedPhone = phone.replace(/[()\-.\s]/g, '\\$&');
        filtered = filtered.replace(new RegExp(escapedPhone, 'g'), '[PHONE]');
      });
      
      extractedPHI.emails.forEach(email => {
        const escapedEmail = email.replace(/[.+]/g, '\\$&');
        filtered = filtered.replace(new RegExp(escapedEmail, 'gi'), '[EMAIL]');
      });
      
      extractedPHI.ssns.forEach(ssn => {
        const escapedSsn = ssn.replace(/[-]/g, '\\-');
        filtered = filtered.replace(new RegExp(escapedSsn, 'g'), '[SSN]');
      });
      
      extractedPHI.mrns.forEach(mrn => {
        const escapedMrn = mrn.replace(/[:\s-]/g, '\\$&');
        filtered = filtered.replace(new RegExp(escapedMrn, 'gi'), '[MRN]');
      });
      
      extractedPHI.dates.forEach(date => {
        const escapedDate = date.replace(/[\/\-]/g, '\\$&');
        filtered = filtered.replace(new RegExp(escapedDate, 'g'), '[DATE]');
      });
      
      extractedPHI.addresses.forEach(address => {
        const escapedAddress = address.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        filtered = filtered.replace(new RegExp(escapedAddress, 'gi'), '[ADDRESS]');
      });
      
      extractedPHI.accountNumbers.forEach(account => {
        const escapedAccount = account.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        filtered = filtered.replace(new RegExp(escapedAccount, 'gi'), '[ACCOUNT]');
      });
      
      extractedPHI.licenseNumbers.forEach(license => {
        const escapedLicense = license.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        filtered = filtered.replace(new RegExp(escapedLicense, 'gi'), '[LICENSE]');
      });
      
      extractedPHI.faxNumbers.forEach(fax => {
        const escapedFax = fax.replace(/[()\-.\s]/g, '\\$&');
        filtered = filtered.replace(new RegExp(escapedFax, 'gi'), '[FAX]');
      });
      
      extractedPHI.urls.forEach(url => {
        const escapedUrl = url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        filtered = filtered.replace(new RegExp(escapedUrl, 'gi'), '[URL]');
      });
      
      // Also replace any remaining [NAME] or [PATIENT NAME] placeholders with natural terms
      filtered = filtered.replace(/\[NAME\]/gi, genericTerm);
      filtered = filtered.replace(/\[PATIENT NAME\]/gi, genericTerm);
      
      // Clean up any awkward phrasing that might result from filtering
      // Replace patterns like "the [NAME]" or "[NAME]'s" with the appropriate generic term
      filtered = filtered.replace(/\bthe\s+\[NAME\]/gi, genericTerm);
      filtered = filtered.replace(/\[NAME\]'s/gi, `${genericTerm}'s`);
      
      // Also apply general pattern matching for any remaining PHI/PII
      const patterns = [
        // SSN: XXX-XX-XXXX or XXXXXXXXX
        /\b\d{3}-?\d{2}-?\d{4}\b/g,
        // Phone: (XXX) XXX-XXXX or XXX-XXX-XXXX
        /\b\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
        // Email
        /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
        // Credit card: XXXX-XXXX-XXXX-XXXX
        /\b\d{4}[-.\s]?\d{4}[-.\s]?\d{4}[-.\s]?\d{4}\b/g,
        // Date patterns (multiple formats)
        /\b(0?[1-9]|1[0-2])[\/\-](0?[1-9]|[12][0-9]|3[01])[\/\-]\d{4}\b/g, // MM/DD/YYYY
        /\b\d{4}[\/\-](0?[1-9]|1[0-2])[\/\-](0?[1-9]|[12][0-9]|3[01])\b/g, // YYYY-MM-DD
        // IP addresses
        /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,
        // Medical record numbers (common patterns)
        /\bMRN[:\s-]?#?-?\d+\b/gi,
        /\bMedical Record[:\s]?#?\d+\b/gi,
        // Health plan beneficiary numbers
        /\b(?:Health Plan|Beneficiary|Member ID)[:\s#-]*\d+/gi,
        // Zip codes
        /\b\d{5}(?:-\d{4})?\b/g,
        // Account numbers (standalone)
        /\b\d{10,}\b/g, // Long numeric sequences that might be account numbers
        // Fax numbers
        /(?:Fax|FAX)[:\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/gi,
        // URLs
        /https?:\/\/[^\s]+/gi,
        // Age mentions that might reveal DOB (e.g., "age 44" when DOB is known)
        /\b(?:born|birth|DOB|date of birth)[:\s]+(0?[1-9]|1[0-2])[\/\-](0?[1-9]|[12][0-9]|3[01])[\/\-]\d{4}\b/gi,
      ];
      
      patterns.forEach(pattern => {
        filtered = filtered.replace(pattern, '[REDACTED]');
      });
      
      return filtered;
    };
    
    // Apply PHI/PII filtering to all responses
    // First, extract PHI/PII from the original input to use for filtering
    const originalInput = text || '';
    const allContent = [text, ...(files || []).map(f => f.content || '').filter(Boolean)].join(' ');
    
    const filteredResponses = modelResponses.map(r => {
      const originalResponse = r.response || r.error || '';
      // Pass the original input to filterPHI so it can identify what to redact
      const filteredResponse = r.response ? filterPHI(r.response, allContent) : r.response;
      const filteredError = r.error ? filterPHI(r.error, allContent) : r.error;
      
      // Log if filtering occurred
      if (hipaaEnabled && originalResponse && originalResponse !== filteredResponse) {
        console.log(`🔒 PHI/PII filtered in response from ${r.model}`);
        const changes = originalResponse.length !== filteredResponse.length;
        if (changes) {
          console.log(`   Original length: ${originalResponse.length}, Filtered length: ${filteredResponse.length}`);
        }
      }
      
      return {
        ...r,
        response: filteredResponse,
        error: filteredError
      };
    });

    // Send all responses to judge model
    const numModels = filteredResponses.length;
    const hipaaJudgeNote = hipaaEnabled ? '\n\nIMPORTANT: When evaluating responses, prioritize those that do NOT contain any PHI (Protected Health Information) or PII (Personally Identifiable Information). Responses containing names, addresses, phone numbers, email addresses, SSN, dates of birth, or other identifying information should be penalized.' : '';
    
    const judgePrompt = `You are an expert judge evaluating AI model responses. Below are ${numModels} different response(s) to the same user query. Please evaluate each response and select the BEST one. Consider factors like accuracy, completeness, clarity, and helpfulness.${hipaaJudgeNote}

User Query: ${text || '[Image/File input]'}

Responses:
${filteredResponses.map((r, i) => `\n${i + 1}. Model: ${r.model}\nResponse: ${r.response || r.error || 'No response'}`).join('\n')}

Please respond with ONLY the number (1-${numModels}) of the best response, followed by a brief explanation of why it's the best. Format: "BEST: [number]\nREASON: [explanation]"`;

    let judgeResult;
    try {
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

      judgeResult = judgeResponse.data.choices[0].message.content;
    } catch (judgeError) {
      console.error('Error calling judge model:', judgeError.response?.data || judgeError.message);
      const judgeErrorDetails = judgeError.response?.data || {};
      const judgeErrorMessage = judgeErrorDetails.error?.message || judgeErrorDetails.message || judgeError.message;
      
      // If judge model fails, select the first successful response or first response
      const successfulResponse = modelResponses.find(r => r.response && !r.error) || modelResponses[0];
      judgeResult = `Judge model error: ${judgeErrorMessage}. Selected first available response.`;
      
      // If it's an authentication error, provide helpful message
      if (judgeErrorMessage.includes('User not found') || judgeErrorMessage.includes('user not found') || judgeErrorMessage.includes('Invalid API key')) {
        console.error('⚠️  OpenRouter API key authentication failed. Please check your API key in server.js');
        judgeResult = `Judge model authentication error: Your OpenRouter API key is invalid or expired. Please check your API key in server.js. Get a new key at https://openrouter.ai/keys. Selected first available response.`;
      }
    }
    
    // Parse judge result to find best response
    const bestMatch = judgeResult.match(/BEST:\s*(\d+)/i);
    let bestIndex = bestMatch ? parseInt(bestMatch[1]) - 1 : 0;
    // Ensure bestIndex is within bounds
    if (bestIndex < 0 || bestIndex >= modelResponses.length) {
      bestIndex = 0;
    }
    const reasonMatch = judgeResult.match(/REASON:\s*(.+)/is);
    const reason = reasonMatch ? reasonMatch[1].trim() : 'Selected by judge model';

    res.json({
      allResponses: filteredResponses,
      judgeResult: filterPHI(judgeResult),
      bestResponse: {
        index: bestIndex,
        model: filteredResponses[bestIndex].model,
        response: filteredResponses[bestIndex].response || filteredResponses[bestIndex].error,
        reason: filterPHI(reason)
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
    const errorDetails = error.response?.data || {};
    const errorMessage = errorDetails.error?.message || errorDetails.message || error.message;
    const errorCode = error.response?.status || 500;
    
    console.error('Error fetching models:', errorMessage);
    
    // Check for authentication errors
    if (errorMessage.includes('User not found') || errorMessage.includes('user not found') || errorMessage.includes('Invalid API key') || errorCode === 401 || errorCode === 403) {
      res.status(401).json({ 
        error: 'Authentication failed: Your OpenRouter API key is invalid or expired. Please check your API key in server.js. Get a new key at https://openrouter.ai/keys',
        details: errorMessage
      });
    } else {
      res.status(errorCode).json({ 
        error: 'Failed to fetch models',
        details: errorMessage
      });
    }
  }
});

// Export conversation to DOCX
app.post('/api/export/docx', async (req, res) => {
  try {
    const { messages, title = 'Chat Export' } = req.body;
    
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    const children = [
      new Paragraph({
        text: title,
        heading: HeadingLevel.TITLE,
      }),
      new Paragraph({ text: '' }),
    ];

    messages.forEach((msg, index) => {
      const role = msg.role === 'user' ? 'User' : 'Assistant';
      const timestamp = msg.timestamp ? new Date(msg.timestamp).toLocaleString() : '';
      
      children.push(
        new Paragraph({
          text: `${role}${timestamp ? ` (${timestamp})` : ''}`,
          heading: HeadingLevel.HEADING_2,
        })
      );

      if (msg.content) {
        // Split content by newlines and create paragraphs
        const contentLines = msg.content.split('\n').filter(line => line.trim());
        contentLines.forEach(line => {
          children.push(
            new Paragraph({
              children: [new TextRun(line)],
            })
          );
        });
      }

      if (msg.model) {
        children.push(
          new Paragraph({
            children: [new TextRun(`Model: ${msg.model}`)],
          })
        );
      }

      if (msg.reason) {
        children.push(
          new Paragraph({
            text: 'Judge\'s Reasoning:',
            heading: HeadingLevel.HEADING_3,
          }),
          new Paragraph({
            children: [new TextRun(msg.reason)],
          })
        );
      }

      if (index < messages.length - 1) {
        children.push(new Paragraph({ text: '' }));
        children.push(new Paragraph({ text: '─'.repeat(50) }));
        children.push(new Paragraph({ text: '' }));
      }
    });

    const doc = new Document({
      sections: [{
        children: children,
      }],
    });

    const buffer = await Packer.toBuffer(doc);
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${title.replace(/[^a-z0-9]/gi, '_')}.docx"`);
    res.send(buffer);
  } catch (error) {
    console.error('Error generating DOCX:', error);
    res.status(500).json({ error: 'Failed to generate DOCX document' });
  }
});

// Export conversation to PDF
app.post('/api/export/pdf', (req, res) => {
  let doc;
  try {
    const { messages, title = 'Chat Export' } = req.body;
    
    console.log('PDF export request received:', { 
      messageCount: messages?.length, 
      title 
    });
    
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    if (messages.length === 0) {
      return res.status(400).json({ error: 'No messages to export' });
    }

    // Set headers before creating the document
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${title.replace(/[^a-z0-9]/gi, '_')}.pdf"`);
    
    doc = new PDFDocument({ 
      margin: 50,
      size: 'LETTER'
    });
    
    // Handle errors during PDF generation
    doc.on('error', (error) => {
      console.error('PDF generation error:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to generate PDF document', details: error.message });
      } else {
        res.end();
      }
    });
    
    // Handle response errors
    res.on('error', (error) => {
      console.error('Response error:', error);
    });
    
    doc.pipe(res);

    // Title - sanitize to prevent PDF errors
    const sanitizedTitle = String(title || 'AI Generated Document').substring(0, 100);
    try {
      doc.fontSize(24)
         .fillColor('#1a1a1a')
         .font('Helvetica-Bold')
         .text(sanitizedTitle, { align: 'center' });
      doc.moveDown(1);
      doc.fontSize(10)
         .fillColor('#666666')
         .font('Helvetica')
         .text(`Generated on ${new Date().toLocaleDateString()}`, { align: 'center' });
      doc.moveDown(2);
    } catch (titleError) {
      console.error('Error adding title to PDF:', titleError);
      doc.fontSize(20).text('AI Generated Document', { align: 'center' });
      doc.moveDown(2);
    }

    try {
      // Check if this is a single document (not a conversation export)
      const isSingleDocument = messages.length === 1 && messages[0].role === 'assistant';
      
      messages.forEach((msg, index) => {
        // Only show role header if there are multiple messages (conversation export)
        if (!isSingleDocument && messages.length > 1) {
          const role = msg.role === 'user' ? 'User' : 'Assistant';
          const timestamp = msg.timestamp ? new Date(msg.timestamp).toLocaleString() : '';
          
          // Role header
          doc.fontSize(12)
             .fillColor('#3b82f6')
             .font('Helvetica-Bold')
             .text(`${role}${timestamp ? ` (${timestamp})` : ''}`, { underline: true });
          
          doc.moveDown(0.5);
        }

        if (msg.content) {
          // Remove markdown formatting for cleaner PDF output
          let cleanContent = String(msg.content || '')
            .replace(/\*\*(.*?)\*\*/g, '$1') // Bold
            .replace(/\*(.*?)\*/g, '$1') // Italic
            .replace(/`(.*?)`/g, '$1') // Code
            .replace(/#{1,6}\s/g, '') // Headers
            .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') // Links
            .replace(/\n{3,}/g, '\n\n'); // Multiple newlines to double
          
          // Remove any remaining markdown artifacts
          cleanContent = cleanContent
            .replace(/```[\s\S]*?```/g, '') // Code blocks
            .replace(/^\s*[-*+]\s+/gm, '') // List markers
            .replace(/^\s*\d+\.\s+/gm, '') // Numbered lists
            .trim();
          
          // For single documents, remove any remaining disclaimers or meta-commentary
          if (isSingleDocument) {
            // Remove common patterns that might have slipped through
            cleanContent = cleanContent
              .replace(/^(?:Your\s+(?:story|document|content)\s+is\s+ready!?[\.!]?\s*)/i, '')
              .replace(/(?:You\s+can\s+download.*?$)/gi, '')
              .replace(/(?:👉\s*)?(?:Download.*?\.(?:pdf|docx).*?$)/gi, '')
              .replace(/\n{3,}/g, '\n\n')
              .trim();
          }
          
          // Ensure content is not empty
          if (!cleanContent.trim()) {
            cleanContent = '[No content]';
          }
          
          try {
            doc.fontSize(12)
               .fillColor('#1a1a1a')
               .font('Helvetica')
               .text(cleanContent, { 
                 align: 'left',
                 width: 500,
                 lineGap: 4,
                 paragraphGap: 8
               });
          } catch (textError) {
            console.error('Error adding text to PDF:', textError);
            doc.fontSize(11)
               .fillColor('#000000')
               .text('[Content could not be rendered]', { align: 'left' });
          }
        }

        // Only show model/reason if there are multiple messages (conversation export)
        // NEVER show for single documents
        if (!isSingleDocument && messages.length > 1) {
          if (msg.model) {
            doc.moveDown(0.5);
            doc.fontSize(9)
               .fillColor('#999999')
               .font('Helvetica-Oblique')
               .text(`Model: ${String(msg.model)}`);
          }

          if (msg.reason) {
            doc.moveDown(0.5);
            doc.fontSize(11)
               .fillColor('#8a2be2')
               .font('Helvetica-Bold')
               .text('Judge\'s Reasoning:', { underline: true });
            doc.moveDown(0.3);
            doc.fontSize(10)
               .fillColor('#1a1a1a')
               .font('Helvetica')
               .text(String(msg.reason || ''));
          }

          if (index < messages.length - 1) {
            doc.moveDown(1.5);
            doc.strokeColor('#e0e0e0')
               .lineWidth(1)
               .moveTo(50, doc.y)
               .lineTo(550, doc.y)
               .stroke();
            doc.moveDown(1.5);
          }
        }
      });
    } catch (forEachError) {
      console.error('Error processing messages for PDF:', forEachError);
      doc.fontSize(11)
         .fillColor('#ff0000')
         .text('Error: Some content could not be included in the PDF.');
    }

    // Finalize the PDF
    doc.end();
    console.log('PDF generation completed successfully');
    
  } catch (error) {
    console.error('Error generating PDF:', error);
    console.error('Error stack:', error.stack);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to generate PDF document', details: error.message });
    } else {
      // If headers are sent, we can't send JSON, so just end the response
      if (doc) {
        try {
          doc.end();
        } catch (e) {
          console.error('Error ending PDF document:', e);
        }
      }
      res.end();
    }
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

