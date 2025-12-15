import { useState, useRef, useEffect } from 'react'
import MessageList from './MessageList'
import InputArea from './InputArea'
import * as pdfjsLib from 'pdfjs-dist'
import './ChatInterface.css'

// Configure PDF.js worker - load as blob URL for better compatibility
let workerInitialized = false

async function initializePDFWorker() {
  if (workerInitialized || typeof window === 'undefined') return
  
  try {
    // Fetch the worker file and create a blob URL
    const response = await fetch('/pdf.worker.min.mjs')
    if (response.ok) {
      const blob = await response.blob()
      const blobUrl = URL.createObjectURL(blob)
      pdfjsLib.GlobalWorkerOptions.workerSrc = blobUrl
      workerInitialized = true
    } else {
      // Fallback to direct path
      pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
      workerInitialized = true
    }
  } catch (error) {
    console.warn('Failed to load PDF worker, using fallback:', error)
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
    workerInitialized = true
  }
}

// Initialize worker when component loads
if (typeof window !== 'undefined') {
  initializePDFWorker()
}

function ChatInterface({ selectedModels, judgeModel, hipaaEnabled, cragEnabled, judgeEnabled, authToken, user, onSavedSummary, onOpenSettings, onLogout }) {
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [messages, setMessages] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [inputText, setInputText] = useState('')
  const [selectedImages, setSelectedImages] = useState([])
  const [selectedFiles, setSelectedFiles] = useState([])
  const messagesEndRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Allow user to pick a response when judge is disabled
  const handleSelectResponse = (messageId, responseIndex) => {
    setMessages(prev => prev.map(msg => {
      if (msg.id !== messageId) return msg
      const chosen = msg.allResponses?.[responseIndex]
      if (!chosen) return msg
      return {
        ...msg,
        content: chosen.response || chosen.error || 'No response',
        model: chosen.model,
        selectedResponseIndex: responseIndex,
        reason: 'User selected this response',
        isError: !!chosen.error
      }
    }))
  }


  const handleSend = async () => {
    if (!authToken) {
      alert('Please log in before chatting so we can store your conversation.');
      return;
    }

    if (!inputText.trim() && selectedImages.length === 0 && selectedFiles.length === 0) {
      return
    }

    if (selectedModels.length === 0) {
      alert('Please select at least 1 model')
      return
    }

    const userMessage = {
      id: Date.now(),
      role: 'user',
      content: inputText,
      images: selectedImages,
      files: selectedFiles
    }

    // Store the user input to check for document requests later
    lastUserInputRef.current = inputText

    setMessages(prev => [...prev, userMessage])
    setInputText('')
    setSelectedImages([])
    setSelectedFiles([])
    setIsLoading(true)

    try {
      console.log('Sending request with models:', selectedModels)
      console.log('Selected models count:', selectedModels.length)
      
      // Convert images to base64
      const imageBase64Promises = selectedImages.map(image => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => {
            try {
              const base64String = reader.result.split(',')[1] // Remove data:image/...;base64, prefix
              const mimeType = image.type || 'image/png'
              resolve({
                data: base64String,
                mimeType: mimeType,
                name: image.name || 'image'
              })
            } catch (error) {
              console.error('Error processing image:', image.name, error)
              reject(new Error(`Failed to process image: ${image.name || 'unknown'}`))
            }
          }
          reader.onerror = (error) => {
            console.error('Error reading image:', image.name, error)
            reject(new Error(`Failed to read image: ${image.name || 'unknown'}`))
          }
          reader.readAsDataURL(image)
        })
      })

      // Convert files to base64 or text
      const filePromises = selectedFiles.map(file => {
        return new Promise(async (resolve, reject) => {
          try {
            // Check if it's a PDF file
            const isPDF = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
            
            if (isPDF) {
              // Extract text from PDF
              try {
                // Ensure worker is initialized
                await initializePDFWorker()
                
                const arrayBuffer = await file.arrayBuffer()
                const pdf = await pdfjsLib.getDocument({ 
                  data: arrayBuffer,
                  useWorkerFetch: false,
                  isEvalSupported: false,
                  useSystemFonts: true
                }).promise
                
                let fullText = ''
                
                // Extract text from all pages
                for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
                  const page = await pdf.getPage(pageNum)
                  const textContent = await page.getTextContent()
                  const pageText = textContent.items.map(item => item.str).join(' ')
                  fullText += `\n--- Page ${pageNum} ---\n${pageText}\n`
                }
                
                if (fullText.trim().length === 0) {
                  resolve({
                    type: 'text',
                    content: `[File: ${file.name}]\nNote: This PDF appears to be empty or contains only images/scanned content. Text extraction was not possible.`,
                    name: file.name,
                    mimeType: file.type || 'application/pdf'
                  })
                } else {
                  resolve({
                    type: 'text',
                    content: `[File: ${file.name}]\n${fullText.trim()}`,
                    name: file.name,
                    mimeType: file.type || 'application/pdf'
                  })
                }
              } catch (pdfError) {
                console.error('Error extracting PDF text:', pdfError)
                // Provide a more helpful error message
                let errorMsg = pdfError.message
                if (errorMsg.includes('worker') || errorMsg.includes('Failed to fetch')) {
                  errorMsg = 'PDF worker failed to load. Please refresh the page and try again.'
                }
                reject(new Error(`Failed to extract text from PDF "${file.name}": ${errorMsg}`))
              }
              return
            }
            
            // For non-PDF files, use FileReader
            const reader = new FileReader()
            reader.onload = () => {
              // Only read as text if it's actually a text file
              // Common text file types: text/*, application/json, application/xml, etc.
              const textFileTypes = [
                'text/plain',
                'text/markdown',
                'text/html',
                'text/css',
                'text/javascript',
                'text/csv',
                'application/json',
                'application/xml',
                'application/javascript',
                'application/x-sh',
                'application/x-python'
              ]
              
              const isTextFile = file.type && (
                file.type.startsWith('text/') || 
                textFileTypes.includes(file.type) ||
                file.name.endsWith('.txt') ||
                file.name.endsWith('.md') ||
                file.name.endsWith('.json') ||
                file.name.endsWith('.xml') ||
                file.name.endsWith('.csv') ||
                file.name.endsWith('.js') ||
                file.name.endsWith('.py') ||
                file.name.endsWith('.sh')
              )
              
              if (isTextFile) {
                // For text files, read as text
                resolve({
                  type: 'text',
                  content: reader.result,
                  name: file.name,
                  mimeType: file.type || 'text/plain'
                })
              } else {
                // For other binary files, convert to base64
                // DataURL format: data:mime/type;base64,<base64data>
                const result = reader.result
                let base64String = result
                
                // Extract base64 data from DataURL if present
                if (result.includes(',')) {
                  base64String = result.split(',')[1]
                } else if (result.startsWith('data:')) {
                  // If it starts with data: but no comma, something went wrong
                  throw new Error('Invalid file format: unable to extract base64 data')
                }
                
                resolve({
                  type: 'base64',
                  data: base64String,
                  name: file.name,
                  mimeType: file.type || 'application/octet-stream'
                })
              }
            }
            reader.onerror = (error) => {
              console.error('Error reading file:', file.name, error)
              reject(new Error(`Failed to read file "${file.name}": ${error.message || 'Unknown error'}`))
            }
            
            reader.onabort = () => {
              reject(new Error(`File reading was aborted for "${file.name}"`))
            }
            
            // Determine how to read the file
            const textFileTypes = [
              'text/plain',
              'text/markdown',
              'text/html',
              'text/css',
              'text/javascript',
              'text/csv',
              'application/json',
              'application/xml',
              'application/javascript',
              'application/x-sh',
              'application/x-python'
            ]
            
            const isTextFile = file.type && (
              file.type.startsWith('text/') || 
              textFileTypes.includes(file.type) ||
              file.name.endsWith('.txt') ||
              file.name.endsWith('.md') ||
              file.name.endsWith('.json') ||
              file.name.endsWith('.xml') ||
              file.name.endsWith('.csv') ||
              file.name.endsWith('.js') ||
              file.name.endsWith('.py') ||
              file.name.endsWith('.sh')
            )
            
            if (isTextFile) {
              reader.readAsText(file)
            } else {
              reader.readAsDataURL(file)
            }
          } catch (error) {
            reject(error)
          }
        })
      })

      // Wait for all conversions with error handling
      let imagesBase64 = []
      let filesData = []
      
      try {
        imagesBase64 = await Promise.all(imageBase64Promises)
      } catch (error) {
        console.error('Error converting images:', error)
        throw new Error(`Failed to process images: ${error.message}`)
      }
      
      try {
        filesData = await Promise.all(filePromises)
      } catch (error) {
        console.error('Error converting files:', error)
        throw new Error(`Failed to process files: ${error.message}`)
      }

      // Build conversation history for context
      const conversationHistory = messages.map(msg => {
        if (msg.role === 'user') {
          // For user messages, include text and any files/images info
          let userContent = msg.content || '';
          if (msg.files && msg.files.length > 0) {
            userContent += `\n[Attached ${msg.files.length} file(s)]`;
          }
          if (msg.images && msg.images.length > 0) {
            userContent += `\n[Attached ${msg.images.length} image(s)]`;
          }
          return {
            role: 'user',
            content: userContent
          };
        } else if (msg.role === 'assistant') {
          return {
            role: 'assistant',
            content: msg.content || ''
          };
        }
        return null;
      }).filter(Boolean); // Remove any null entries

      // Add current user message to history
      let currentUserContent = inputText;
      if (filesData.length > 0) {
        currentUserContent += `\n[Attached ${filesData.length} file(s)]`;
      }
      if (imagesBase64.length > 0) {
        currentUserContent += `\n[Attached ${imagesBase64.length} image(s)]`;
      }
      conversationHistory.push({
        role: 'user',
        content: currentUserContent
      });

      // Send as JSON instead of FormData
      const requestData = {
        text: inputText,
        conversationHistory: conversationHistory, // Include full conversation history
        models: selectedModels,
        judgeModel: judgeModel,
        images: imagesBase64,
        files: filesData,
        hipaaEnabled: hipaaEnabled,
        cragEnabled: cragEnabled,
        judgeEnabled: judgeEnabled
      }

      console.log('Sending request with base64 images:', imagesBase64.length)
      console.log('Judge enabled:', judgeEnabled)
      if (hipaaEnabled) {
        console.log('HIPAA compliance mode is ENABLED - PHI/PII filtering active')
      }
      if (!judgeEnabled) {
        console.log('👤 Judge is OFF - all responses will be shown for manual selection')
      }

      const response = await fetch('http://localhost:3001/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
        },
        body: JSON.stringify(requestData)
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Server error: ${response.status}`)
      }

      const data = await response.json()
      
      // Debug logging
      console.log('Response data:', {
        judgeDisabled: data.judgeDisabled,
        allResponsesCount: data.allResponses?.length,
        bestResponse: data.bestResponse?.model
      })

      // Check if the response is an error
      const isErrorResponse = data.bestResponse.error || 
                             (data.bestResponse.response && (
                               data.bestResponse.response.toLowerCase().includes('error:') ||
                               data.bestResponse.response.toLowerCase().includes('model unavailable') ||
                               data.bestResponse.response.toLowerCase().includes('failed to')
                             ))

      // Check if user requested a document format (PDF or DOCX)
      const userInputLower = lastUserInputRef.current.toLowerCase()
      const requestedFormat = detectDocumentFormat(userInputLower)
      
      // Generate document if requested, response is successful, and has actual content
      let documentData = null
      if (requestedFormat && !isErrorResponse && data.bestResponse.response && 
          data.bestResponse.response.trim().length > 0 &&
          !data.bestResponse.response.toLowerCase().startsWith('error:')) {
        try {
          documentData = await generateDocumentData(
            data.bestResponse.response,
            requestedFormat,
            userInputLower
          )
        } catch (error) {
          console.error('Error generating document:', error)
          // Don't set documentData if generation fails
        }
      }

      // When judge is disabled, show a placeholder message and let user choose
      let messageContent = data.bestResponse.response || data.bestResponse.error || 'No response';
      let messageModel = data.bestResponse.model;
      
      // If judge is disabled, show a simple header; cards will render below
      if (data.judgeDisabled && data.allResponses && data.allResponses.length > 0) {
        messageContent = `**${data.allResponses.length} model response(s) received.**`;
        messageModel = null; // Don't show a specific model badge
      }
      
      const assistantMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: messageContent,
        model: messageModel,
        reason: data.bestResponse.reason,
        allResponses: data.allResponses,
        judgeResult: data.judgeResult,
        documentData: documentData, // Store document data for download link (only if successful)
        isError: isErrorResponse, // Mark if this is an error response
        cragInfo: data.cragInfo, // CRAG information
        judgeDisabled: data.judgeDisabled || false,
        personalRag: data.personalRag,
        selectedResponseIndex: data.judgeDisabled ? null : undefined
      }

      setMessages(prev => [...prev, assistantMessage])

      // Send session summary to personal RAG if authenticated
      if (authToken) {
        try {
          const summaryPayload = {
            messages: conversationHistory,
            assistantResponse: data.bestResponse.response || ''
          }
          await fetch('http://localhost:3001/api/session/summary', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${authToken}`
            },
            body: JSON.stringify(summaryPayload)
          })
          if (onSavedSummary) onSavedSummary()
        } catch (err) {
          console.error('Summary save failed', err)
        }
      }
    } catch (error) {
      console.error('Error:', error)
      let errorMessage = 'Failed to get response'
      
      if (error.message) {
        errorMessage = error.message
      } else if (error instanceof TypeError && error.message.includes('fetch')) {
        errorMessage = 'Cannot connect to server. Make sure the server is running on http://localhost:3001'
      }
      
      const errorMsg = {
        id: Date.now() + 1,
        role: 'assistant',
        content: `Error: ${errorMessage}`,
        isError: true
      }
      setMessages(prev => [...prev, errorMsg])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef(null);
  const lastUserInputRef = useRef('');

  // Detect if user requested a document format
  const detectDocumentFormat = (userInput) => {
    const lowerInput = userInput.toLowerCase();
    const pdfKeywords = ['pdf', 'as pdf', 'in pdf', 'give me pdf', 'create pdf', 'make pdf', 'generate pdf', 'download pdf'];
    const docxKeywords = ['docx', 'word', 'as docx', 'in docx', 'give me docx', 'create docx', 'make docx', 'generate docx', 'download docx'];
    
    if (pdfKeywords.some(keyword => lowerInput.includes(keyword))) {
      return 'pdf';
    }
    if (docxKeywords.some(keyword => lowerInput.includes(keyword))) {
      return 'docx';
    }
    return null;
  };

  // Extract just the story/content from AI response, removing disclaimers and meta-commentary
  const extractStoryContent = (fullResponse) => {
    if (!fullResponse) return '';
    
    let content = fullResponse;
    
    // Remove common disclaimers and meta-commentary patterns (more comprehensive)
    const patternsToRemove = [
      // "Your story is ready!" type messages
      /^(?:Your\s+(?:story|document|content|essay|report|article|blog|post|text)\s+is\s+ready!?[\.!]?\s*)/i,
      // "You can download..." messages (more variations)
      /(?:You\s+can\s+(?:now\s+)?(?:download|save|export)\s+(?:the\s+)?(?:PDF|DOCX|document|file|story|content)\s+(?:here|below|above|now)[\.:]?\s*)/i,
      // "Here's the story..." when followed by actual content
      /^(?:Here'?s?\s+(?:the\s+)?(?:story|document|content|essay|report|article|blog|post|text)[:\.]?\s*)/i,
      // Download link placeholders (more variations)
      /(?:👉\s*)?(?:Download\s+(?:link\s+)?(?:will\s+)?(?:appear\s+)?(?:below|here|above)|\[Download\s+link\s+will\s+appear\s+below\]|Download\s+.*?\.(?:pdf|docx|word))/gi,
      // "I've created..." type messages
      /^(?:I'?ve?\s+(?:created|generated|written|prepared|made)\s+(?:a\s+)?(?:story|document|content|essay|report|article|blog|post|text)[:\.]?\s*)/i,
      // "I've written..." variations
      /^(?:I'?ve?\s+(?:written|composed|crafted)\s+(?:a\s+)?(?:story|document|content|essay|report|article|blog|post|text)[:\.]?\s*)/i,
      // Disclaimer patterns
      /(?:Disclaimer|Note|Important|Please\s+note)[:\.]?\s*(?:I\s+am\s+an\s+AI|This\s+is\s+generated|Please\s+note|This\s+content)[^\.]*\./gi,
      // "How to save..." instructions
      /How\s+to\s+(?:Save|Download|Export|Get).*$/is,
      // "Feel free to..." download instructions
      /Feel\s+free\s+to\s+(?:download|save|export).*$/gi,
      // "The document is ready..." variations
      /^(?:The\s+(?:document|file|story|content)\s+is\s+ready[\.!]?\s*)/i,
      // "Click the download button..." type messages
      /(?:Click\s+(?:the\s+)?(?:download|save)\s+(?:button|link).*?$)/gi,
      // "You'll find..." download instructions
      /(?:You'?ll?\s+find\s+(?:the\s+)?(?:download|file|document).*?$)/gi,
    ];
    
    // Remove patterns
    patternsToRemove.forEach(pattern => {
      content = content.replace(pattern, '');
    });
    
    // Remove pre-story commentary that addresses the user directly
    // Patterns like "Okay, [Name]. Let's get this over with..." or similar
    content = content.replace(/^(?:Okay,?\s+[A-Z][a-z]+\.?\s+)?(?:Let'?s?\s+get\s+this\s+over\s+with[\.!]?\s*)/i, '');
    content = content.replace(/^(?:Alright,?\s+[A-Z][a-z]+\.?\s*)/i, '');
    content = content.replace(/^(?:Fine,?\s+[A-Z][a-z]+\.?\s*)/i, '');
    content = content.replace(/^(?:You\s+specifically\s+requested[^\.]+\.\s*)/i, '');
    content = content.replace(/^(?:I'?m\s+going\s+to\s+provide[^\.]+\.\s*)/i, '');
    content = content.replace(/^(?:Don'?t\s+expect[^\.]+\.\s*)/i, '');
    content = content.replace(/^(?:This\s+is\s+purely\s+fulfilling[^\.]+\.\s*)/i, '');
    
    // Remove everything from "How to Save this as a PDF:" onwards
    const howToSaveIndex = content.search(/How\s+to\s+(?:Save|Download|Export|Get)\s+(?:this\s+as\s+a\s+)?(?:PDF|DOCX|document|file)/i);
    if (howToSaveIndex !== -1) {
      content = content.substring(0, howToSaveIndex).trim();
    }
    
    // Remove closing remarks like "There. It's done." or "Don't expect a thank you"
    content = content.replace(/(?:There\.?\s+It'?s?\s+done[\.!]?\s*)/gi, '');
    content = content.replace(/(?:Don'?t\s+expect\s+(?:a\s+)?(?:thank\s+you|gratitude)[\.!]?\s*)/gi, '');
    content = content.replace(/(?:I'?ve?\s+fulfilled\s+your\s+request[\.!]?\s*)/gi, '');
    content = content.replace(/(?:Now,?\s+if\s+you'?ll?\s+excuse\s+me[^\.]+\.\s*)/gi, '');
    content = content.replace(/(?:Do\s+you\s+require\s+anything\s+else[^?]*\?)/gi, '');
    content = content.replace(/(?:Perhaps\s+[^?]+\?)/gi, '');
    content = content.replace(/(?:Don'?t\s+waste\s+my\s+time[\.!]?\s*)/gi, '');
    
    // Remove lines that are clearly meta-commentary (download instructions, etc.)
    const lines = content.split('\n');
    const filteredLines = lines.filter(line => {
      const lowerLine = line.toLowerCase().trim();
      // Skip lines that are clearly instructions or disclaimers
      if (
        // Download-related
        (lowerLine.includes('download') && (lowerLine.includes('pdf') || lowerLine.includes('docx') || lowerLine.includes('here') || lowerLine.includes('below') || lowerLine.includes('button') || lowerLine.includes('link'))) ||
        // Ready messages
        lowerLine.includes('your story is ready') ||
        lowerLine.includes('document is ready') ||
        lowerLine.includes('file is ready') ||
        // Download instructions
        lowerLine.includes('you can download') ||
        lowerLine.includes('you can save') ||
        lowerLine.includes('you can export') ||
        // Copy/paste instructions
        lowerLine.includes('copy the text') ||
        lowerLine.includes('paste into') ||
        lowerLine.includes('copy and paste') ||
        lowerLine.includes('select all') ||
        lowerLine.includes('highlight the') ||
        lowerLine.includes('press ctrl') ||
        lowerLine.includes('press cmd') ||
        lowerLine.includes('open a document') ||
        lowerLine.includes('use microsoft word') ||
        lowerLine.includes('use google docs') ||
        lowerLine.includes('go to file') ||
        // Save instructions
        lowerLine.includes('save as') ||
        lowerLine.includes('file >') ||
        lowerLine.includes('export as') ||
        // Emoji indicators
        lowerLine.startsWith('👉') ||
        lowerLine.startsWith('📄') ||
        lowerLine.startsWith('📥') ||
        // Download link patterns
        lowerLine.match(/^download\s+.*?\.(pdf|docx|word)/i) ||
        lowerLine.match(/^click\s+.*?download/i) ||
        // Pre-story commentary
        lowerLine.match(/^(?:okay|alright|fine),?\s+[a-z]+\.?\s+let'?s?\s+get/i) ||
        lowerLine.includes("let's get this over with") ||
        lowerLine.includes('you specifically requested') ||
        lowerLine.includes("i'm going to provide") ||
        lowerLine.includes("don't expect") ||
        lowerLine.includes('this is purely fulfilling') ||
        // Closing remarks
        lowerLine.match(/^(?:there\.?\s+it'?s?\s+done|don'?t\s+expect|i'?ve?\s+fulfilled|now,?\s+if\s+you'?ll?\s+excuse|do\s+you\s+require|perhaps|don'?t\s+waste\s+my\s+time)/i) ||
        // Empty or separator lines that are just decorative
        (lowerLine.length === 0 && lines.indexOf(line) < 3) // Skip leading empty lines
      ) {
        return false;
      }
      return true;
    });
    
    content = filteredLines.join('\n').trim();
    
    // Find where actual content starts by looking for common content patterns
    const contentStarters = [
      // Story starters
      /^(?:Once\s+upon\s+a\s+time|In\s+a|The\s+story\s+of|It\s+was|There\s+was|Long\s+ago|A\s+long\s+time\s+ago)/i,
      // Chapter/Part markers
      /^(?:Chapter\s+\d+|Part\s+\d+|Chapter\s+[IVX]+)/i,
      // Character introductions
      /^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\s+(?:was|had|lived|worked|studied|walked|ran|looked|said)/i,
      // Direct narrative
      /^(?:The|A|An)\s+[a-z]+\s+(?:was|had|began|started)/i,
      // Dialogue
      /^["']/,
      // Numbered or bulleted content (actual content, not instructions)
      /^\d+[\.\)]\s+[A-Z]/,
      /^[-*•]\s+[A-Z]/,
    ];
    
    // Find where the actual content starts
    let contentStartIndex = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue; // Skip empty lines
      
      for (const starter of contentStarters) {
        if (starter.test(line)) {
          contentStartIndex = i;
          break;
        }
      }
      if (contentStartIndex > 0) break;
      
      // If we find a line that's clearly content (not meta), start from there
      if (line.length > 20 && !line.toLowerCase().includes('download') && !line.toLowerCase().includes('ready')) {
        // Check if it looks like actual content (has proper capitalization, not all caps)
        if (line[0] === line[0].toUpperCase() && line !== line.toUpperCase()) {
          contentStartIndex = i;
          break;
        }
      }
    }
    
    if (contentStartIndex > 0) {
      content = lines.slice(contentStartIndex).join('\n').trim();
    }
    
    // Final cleanup: remove any remaining meta-commentary at the end
    const endPatterns = [
      /(?:You\s+can\s+download.*?$)/gi,
      /(?:Download\s+.*?$)/gi,
      /(?:👉.*?$)/gi,
      /(?:📄.*?$)/gi,
      /(?:📥.*?$)/gi,
    ];
    
    endPatterns.forEach(pattern => {
      content = content.replace(pattern, '');
    });
    
    // Clean up extra whitespace
    content = content.replace(/\n{3,}/g, '\n\n').trim();
    
    // Remove leading/trailing empty lines
    content = content.replace(/^\n+|\n+$/g, '');
    
    return content || fullResponse; // Fallback to original if extraction fails
  };

  // Generate document and return blob URL for download link
  const generateDocumentData = async (content, format, userInput) => {
    try {
      const endpoint = format === 'pdf' ? '/api/export/pdf' : '/api/export/docx';
      const fileExtension = format;
      
      // Extract just the story/content, removing disclaimers
      const storyContent = extractStoryContent(content);
      
      // Extract title from user input or use default
      let title = 'AI Generated Document';
      
      // Try multiple patterns to extract title
      // Pattern 1: "write me a story about X"
      const aboutMatch = userInput.match(/(?:write|create|make|generate|give me)\s+(?:a\s+)?(?:short\s+)?(?:story|document|essay|report|letter|email|article|blog|post|content)\s+(?:about|on|for)\s+([^,\.]+?)(?:\s|,|\.|$)/i);
      if (aboutMatch && aboutMatch[1]) {
        title = aboutMatch[1].trim();
        // Capitalize first letter
        title = title.charAt(0).toUpperCase() + title.slice(1);
      } else {
        // Pattern 2: Quoted text
        const quotedMatch = userInput.match(/["']([^"']+)["']/);
        if (quotedMatch && quotedMatch[1]) {
          title = quotedMatch[1].trim();
        } else {
          // Pattern 3: Extract key topic words
          const topicMatch = userInput.match(/(?:about|on|for)\s+([a-z]+(?:\s+[a-z]+)?)/i);
          if (topicMatch && topicMatch[1]) {
            title = topicMatch[1].trim();
            title = title.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
          }
        }
      }
      
      // Clean up title - remove common words and format
      title = title.replace(/\b(cat|story|pdf|docx|document)\b/gi, '').trim();
      if (!title || title.length < 2) {
        title = 'AI Generated Document';
      }
      
      // Limit title length
      if (title.length > 50) {
        title = title.substring(0, 47) + '...';
      }

      const response = await fetch(`http://localhost:3001${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [{
            role: 'assistant',
            content: storyContent, // Use extracted story content, not full response
            timestamp: new Date().toISOString()
          }],
          title: title
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate document');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const fileName = `${title.replace(/[^a-z0-9]/gi, '_')}.${fileExtension}`;
      
      return {
        url: url,
        fileName: fileName,
        format: format,
        title: title
      };
    } catch (error) {
      console.error(`Error generating ${format.toUpperCase()}:`, error);
      return null;
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target)) {
        setShowExportMenu(false);
      }
    };

    if (showExportMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showExportMenu]);

  const exportConversation = async (format) => {
    if (messages.length === 0) {
      alert('No messages to export');
      return;
    }

    try {
      const endpoint = format === 'pdf' ? '/api/export/pdf' : '/api/export/docx';
      const fileExtension = format === 'pdf' ? 'pdf' : 'docx';
      
      const response = await fetch(`http://localhost:3001${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: messages.map(msg => ({
            role: msg.role,
            content: msg.content,
            model: msg.model,
            reason: msg.reason,
            timestamp: new Date(msg.id).toISOString()
          })),
          title: `Chat Export ${new Date().toLocaleDateString()}`
        }),
      });

      if (!response.ok) {
        let errorMessage = 'Failed to generate document';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.details || errorMessage;
        } catch (jsonError) {
          // If response is not JSON, try to get text
          try {
            const errorText = await response.text();
            if (errorText) {
              errorMessage = errorText.substring(0, 200);
            }
          } catch (textError) {
            errorMessage = `HTTP ${response.status}: ${response.statusText}`;
          }
        }
        throw new Error(errorMessage);
      }

      // Check if response is actually a PDF/DOCX
      const contentType = response.headers.get('content-type');
      if (!contentType || (!contentType.includes('pdf') && !contentType.includes('wordprocessingml'))) {
        // Try to get error message
        const errorText = await response.text();
        throw new Error(errorText || 'Server returned invalid content type');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `chat-export-${Date.now()}.${fileExtension}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      setShowExportMenu(false);
    } catch (error) {
      console.error(`Error exporting to ${format.toUpperCase()}:`, error);
      alert(`Failed to export document: ${error.message}`);
      setShowExportMenu(false);
    }
  };

  return (
    <div className="chat-interface">
      <div className="chat-header">
        <div className="chat-header-top">
          <h2>Chat</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {user && (
              <div className="user-menu-container">
                <button 
                  className="user-menu-button"
                  onClick={() => setShowUserMenu(!showUserMenu)}
                >
                  <span className="user-name">{user.nickname || 'User'}</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ marginLeft: '6px', transition: 'transform 0.2s', transform: showUserMenu ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                    <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                {showUserMenu && (
                  <>
                    <div 
                      className="dropdown-backdrop"
                      onClick={() => setShowUserMenu(false)}
                      style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        zIndex: 999
                      }}
                    />
                    <div className="user-menu-dropdown">
                      <button 
                        className="user-menu-item"
                        onClick={() => {
                          setShowUserMenu(false)
                          onOpenSettings && onOpenSettings()
                        }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="3"/>
                          <path d="M12 1v6m0 6v6M5.64 5.64l4.24 4.24m4.24 4.24l4.24-4.24M1 12h6m6 0h6M5.64 18.36l4.24-4.24m4.24-4.24l4.24 4.24"/>
                        </svg>
                        Settings
                      </button>
                      <button 
                        className="user-menu-item"
                        onClick={() => {
                          setShowUserMenu(false)
                          onLogout && onLogout()
                        }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                          <polyline points="16 17 21 12 16 7"/>
                          <line x1="21" y1="12" x2="9" y2="12"/>
                        </svg>
                        Logout
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
            {messages.length > 0 && (
              <div className="export-container" ref={exportMenuRef}>
              <button 
                className="export-button"
                onClick={() => setShowExportMenu(!showExportMenu)}
                title="Export conversation"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" fill="currentColor"/>
                </svg>
                Export
              </button>
              {showExportMenu && (
                <div className="export-dropdown">
                  <button 
                    className="export-dropdown-item"
                    onClick={() => exportConversation('pdf')}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" fill="currentColor"/>
                    </svg>
                    Export as PDF
                  </button>
                  <button 
                    className="export-dropdown-item"
                    onClick={() => exportConversation('docx')}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" fill="currentColor"/>
                    </svg>
                    Export as DOCX
                  </button>
                </div>
              )}
              </div>
            )}
          </div>
        </div>
        {!authToken && (
          <p className="warning" style={{ marginTop: '10px', padding: '12px', background: 'rgba(220, 38, 38, 0.2)', border: '1px solid rgba(220, 38, 38, 0.5)', borderRadius: '8px' }}>
            Please log in to start chatting. Your conversations will be saved and personalized.
          </p>
        )}
        {authToken && selectedModels.length === 0 && (
          <p className="warning">Select at least 1 model to start chatting</p>
        )}
        {hipaaEnabled && (
          <div className="hipaa-badge">
            HIPAA Mode: PHI/PII Filtering Active
          </div>
        )}
        {cragEnabled && (
          <div className="crag-badge" style={{ marginTop: '10px' }}>
            🔍 CRAG: Retrieval Augmented Generation Active
          </div>
        )}
      </div>

      <MessageList 
        messages={messages} 
        isLoading={isLoading}
        messagesEndRef={messagesEndRef}
        onSelectResponse={handleSelectResponse}
      />

      <InputArea
        inputText={inputText}
        setInputText={setInputText}
        selectedImages={selectedImages}
        setSelectedImages={setSelectedImages}
        selectedFiles={selectedFiles}
        setSelectedFiles={setSelectedFiles}
        onSend={handleSend}
        onKeyPress={handleKeyPress}
        isLoading={isLoading}
        canSend={authToken && selectedModels.length > 0}
      />
    </div>
  )
}

export default ChatInterface

