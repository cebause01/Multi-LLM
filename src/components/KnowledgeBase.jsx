import { useState, useEffect } from 'react'
import './KnowledgeBase.css'

function KnowledgeBase({ cragEnabled, onCragToggle }) {
  const [documentCount, setDocumentCount] = useState(0)
  const [documents, setDocuments] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [showDocuments, setShowDocuments] = useState(false)

  useEffect(() => {
    if (cragEnabled) {
      fetchDocumentCount()
      if (showDocuments) {
        fetchDocuments()
      }
    }
  }, [showDocuments, cragEnabled])

  const fetchDocumentCount = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/crag/count')
      if (response.ok) {
        const data = await response.json()
        setDocumentCount(data.count || 0)
      }
    } catch (error) {
      console.error('Error fetching document count:', error)
    }
  }

  const fetchDocuments = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/crag/documents')
      if (response.ok) {
        const data = await response.json()
        setDocuments(data.documents || [])
      }
    } catch (error) {
      console.error('Error fetching documents:', error)
    }
  }

  const handleStoreFiles = async (files) => {
    if (!files || files.length === 0) return

    setIsLoading(true)
    try {
      // Process files
      const filePromises = Array.from(files).map(file => {
        return new Promise(async (resolve, reject) => {
          try {
            const isPDF = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
            
            if (isPDF) {
              // Import PDF.js dynamically
              const pdfjsLib = await import('pdfjs-dist')
              
              // Initialize worker
              if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
                pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
              }
              
              const arrayBuffer = await file.arrayBuffer()
              const pdf = await pdfjsLib.getDocument({ 
                data: arrayBuffer,
                useWorkerFetch: false,
                isEvalSupported: false,
                useSystemFonts: true
              }).promise
              
              let fullText = ''
              for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
                const page = await pdf.getPage(pageNum)
                const textContent = await page.getTextContent()
                const pageText = textContent.items.map(item => item.str).join(' ')
                fullText += `\n--- Page ${pageNum} ---\n${pageText}\n`
              }
              resolve({ type: 'text', content: fullText.trim(), name: file.name })
            } else {
              // Check if it's a text file
              const textFileTypes = ['text/plain', 'text/markdown', 'text/html', 'application/json']
              const isTextFile = textFileTypes.includes(file.type) || 
                file.name.endsWith('.txt') || file.name.endsWith('.md') || file.name.endsWith('.json')
              
              if (isTextFile) {
                const reader = new FileReader()
                reader.onload = () => resolve({ type: 'text', content: reader.result, name: file.name })
                reader.onerror = reject
                reader.readAsText(file)
              } else {
                resolve({ type: 'skip', name: file.name })
              }
            }
          } catch (error) {
            reject(error)
          }
        })
      })
      
      const processedFiles = await Promise.all(filePromises)
      
      // Store all text files to knowledge base
      let storedCount = 0
      let errorMessages = []
      
      for (const file of processedFiles) {
        if (file.type === 'text' && file.content && file.content.trim()) {
          try {
            const response = await fetch('http://localhost:3001/api/crag/store', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                text: file.content,
                metadata: { fileName: file.name, uploadedAt: new Date().toISOString() }
              })
            })
            
            if (response.ok) {
              storedCount++
            } else {
              const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
              errorMessages.push(`${file.name}: ${errorData.error || 'Failed to store'}`)
            }
          } catch (error) {
            console.error(`Error storing ${file.name}:`, error)
            errorMessages.push(`${file.name}: ${error.message}`)
          }
        }
      }
      
      // Refresh count and documents if CRAG is enabled
      if (cragEnabled) {
        await fetchDocumentCount()
        if (showDocuments) {
          await fetchDocuments()
        }
      }
      
      if (storedCount > 0) {
        const successMsg = `Successfully stored ${storedCount} file(s)!`
        if (errorMessages.length > 0) {
          alert(successMsg + '\n\nSome files had errors:\n' + errorMessages.join('\n'))
        } else {
          alert(successMsg)
        }
      } else {
        if (errorMessages.length > 0) {
          alert('Failed to store files:\n' + errorMessages.join('\n'))
        } else {
          alert('No text content found in selected files.')
        }
      }
    } catch (error) {
      console.error('Error storing files:', error)
      alert('Failed to store files: ' + error.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleFileSelect = (e) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleStoreFiles(files)
    }
    // Reset input
    e.target.value = ''
  }

  const handleDeleteDocument = async (docId) => {
    if (!confirm('Are you sure you want to delete this document?')) {
      return
    }

    try {
      const response = await fetch(`http://localhost:3001/api/crag/documents/${docId}`, {
        method: 'DELETE'
      })
      
      if (response.ok) {
        await fetchDocumentCount()
        await fetchDocuments()
      } else {
        alert('Failed to delete document')
      }
    } catch (error) {
      console.error('Error deleting document:', error)
      alert('Failed to delete document: ' + error.message)
    }
  }

  const handleClearAll = async () => {
    if (!confirm('Are you sure you want to clear all documents? This cannot be undone.')) {
      return
    }

    try {
      const response = await fetch('http://localhost:3001/api/crag/documents', {
        method: 'DELETE'
      })
      
      if (response.ok) {
        setDocumentCount(0)
        setDocuments([])
        setShowDocuments(false)
        alert('All documents cleared')
      } else {
        alert('Failed to clear documents')
      }
    } catch (error) {
      console.error('Error clearing documents:', error)
      alert('Failed to clear documents: ' + error.message)
    }
  }

  return (
    <div className="knowledge-base-section">
      <div className="kb-actions">
        <label className="kb-upload-button">
          <input
            type="file"
            multiple
            accept=".pdf,.txt,.md,.json"
            onChange={handleFileSelect}
            disabled={isLoading}
            style={{ display: 'none' }}
          />
          <span>{isLoading ? 'Uploading...' : 'Upload Documents'}</span>
        </label>

        {documentCount > 0 && (
          <>
            <button
              className="kb-view-button"
              onClick={() => setShowDocuments(!showDocuments)}
            >
              {showDocuments ? 'Hide' : 'View'} Documents
            </button>
            <button
              className="kb-clear-button"
              onClick={handleClearAll}
            >
              Clear All
            </button>
          </>
        )}
      </div>

      {showDocuments && documents.length > 0 && (
        <div className="kb-documents-list">
          {documents.map((doc) => (
            <div key={doc.docId} className="kb-document-item">
              <div className="kb-document-info">
                <div className="kb-document-name">
                  {doc.metadata?.fileName || 'Untitled Document'}
                </div>
                <div className="kb-document-preview">
                  {doc.text}
                </div>
                {doc.metadata?.uploadedAt && (
                  <div className="kb-document-date">
                    {new Date(doc.metadata.uploadedAt).toLocaleDateString()}
                  </div>
                )}
              </div>
              <button
                className="kb-delete-button"
                onClick={() => handleDeleteDocument(doc.docId)}
                title="Delete document"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {showDocuments && documents.length === 0 && (
        <div className="kb-empty-state">
          No documents in knowledge base
        </div>
      )}
    </div>
  )
}

export default KnowledgeBase

