import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import './MessageList.css'

function MessageList({ messages, isLoading, messagesEndRef, onSelectResponse }) {
  const [expandedMessage, setExpandedMessage] = useState(null)

  if (messages.length === 0) {
    return (
      <div className="message-list empty">
        <div className="empty-state">
          <h3>Start a conversation</h3>
          <p>Select at least 1 model and send a message to compare their responses</p>
        </div>
        <div ref={messagesEndRef} />
      </div>
    )
  }

  return (
    <div className="message-list">
      {messages.map(message => (
        <Message 
          key={message.id} 
          message={message}
          isExpanded={expandedMessage === message.id}
          onToggleExpand={() => setExpandedMessage(
            expandedMessage === message.id ? null : message.id
          )}
          onSelectResponse={onSelectResponse}
        />
      ))}
      {isLoading && (
        <div className="message assistant">
          <div className="message-content">
            <div className="loading-dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        </div>
      )}
      <div ref={messagesEndRef} />
    </div>
  )
}

function Message({ message, isExpanded, onToggleExpand, onSelectResponse }) {
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef(null);

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

  const exportMessage = async (format) => {
    try {
      const endpoint = format === 'pdf' ? '/api/export/pdf' : '/api/export/docx';
      const fileExtension = format === 'pdf' ? 'pdf' : 'docx';
      
      const response = await fetch(`http://localhost:3001${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [{
            role: message.role,
            content: message.content,
            model: message.model,
            reason: message.reason,
            timestamp: new Date(message.id).toISOString()
          }],
          title: `Response Export ${new Date().toLocaleDateString()}`
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to generate document');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `response-export-${Date.now()}.${fileExtension}`;
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

  if (message.role === 'user') {
    return (
      <div className="message user">
        <div className="message-content">
          {message.content && <p>{message.content}</p>}
          {message.images && message.images.length > 0 && (
            <div className="image-preview-container">
              {Array.from(message.images).map((img, idx) => (
                <img 
                  key={idx} 
                  src={URL.createObjectURL(img)} 
                  alt={`Upload ${idx + 1}`}
                  className="preview-image"
                />
              ))}
            </div>
          )}
          {message.files && message.files.length > 0 && (
            <div className="file-list">
              {Array.from(message.files).map((file, idx) => (
                <div key={idx} className="file-item">
                  {file.name}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={`message assistant ${message.isError ? 'error' : ''}`}>
      <div className="message-content">
        <div className="message-header-actions">
          {/* Only show model badge when judge is enabled (single selected response) */}
          {!message.judgeDisabled && message.model && (
            <div className="model-badge">
              {message.model}
            </div>
          )}
          <div className="message-export-container" ref={exportMenuRef}>
            <button 
              className="message-export-button"
              onClick={() => setShowExportMenu(!showExportMenu)}
              title="Export this response"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" fill="currentColor"/>
              </svg>
            </button>
            {showExportMenu && (
              <div className="export-dropdown">
                <button 
                  className="export-dropdown-item"
                  onClick={() => exportMessage('pdf')}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" fill="currentColor"/>
                  </svg>
                  Export as PDF
                </button>
                <button 
                  className="export-dropdown-item"
                  onClick={() => exportMessage('docx')}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" fill="currentColor"/>
                  </svg>
                  Export as DOCX
                </button>
              </div>
            )}
          </div>
        </div>
        {/* When judge is disabled, show all responses horizontally side by side */}
        {message.judgeDisabled && message.allResponses && message.allResponses.length > 0 ? (
          <div className="all-responses-grid">
            <div className="all-responses-header">
              <strong>{message.allResponses.length} model response(s):</strong>
            </div>
            <div className="all-responses-list horizontal">
              {message.allResponses.map((resp, idx) => (
                <div 
                  key={idx} 
                  className="response-card"
                >
                  <div className="response-card-model">
                    {resp.model || `Response ${idx + 1}`}
                  </div>
                  <div className="response-card-content">
                    <ReactMarkdown>{resp.response || resp.error || 'No response'}</ReactMarkdown>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="message-text">
              <ReactMarkdown>{message.content}</ReactMarkdown>
            </div>
          </>
        )}
        {message.documentData && !message.isError && (
          <div className="document-download-section">
            <a
              href={message.documentData.url}
              download={message.documentData.fileName}
              className="document-download-link"
              onClick={(e) => {
                // Clean up the blob URL after download starts
                setTimeout(() => {
                  URL.revokeObjectURL(message.documentData.url);
                }, 100);
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              Download {message.documentData.fileName}
            </a>
          </div>
        )}
        {message.cragInfo && message.cragInfo.enabled && (
          <div className="crag-info" style={{
            marginTop: '10px',
            padding: '10px 12px',
            background: 'rgba(59, 130, 246, 0.12)',
            border: '1px solid rgba(59, 130, 246, 0.5)',
            borderRadius: '8px',
            fontSize: '12px',
            color: '#e5edff'
          }}>
            <strong>🔍 CRAG Retrieval:</strong>
            <div style={{ marginTop: '4px' }}>
              {message.cragInfo.documentsRetrieved > 0 ? (
                <>
                  Retrieved {message.cragInfo.documentsRetrieved} document(s) from knowledge base
                  {message.cragInfo.relevanceScore !== undefined && (
                    <span style={{ marginLeft: '8px', color: message.cragInfo.isRelevant ? '#10b981' : '#f59e0b' }}>
                      (Relevance: {(message.cragInfo.relevanceScore * 100).toFixed(1)}%)
                    </span>
                  )}
                  {message.cragInfo.corrected && message.cragInfo.refinedQuery && (
                    <div style={{ marginTop: '4px', fontSize: '11px', color: '#666' }}>
                      Query refined: "{message.cragInfo.refinedQuery}"
                    </div>
                  )}
                </>
              ) : (
                <span style={{ color: '#f59e0b' }}>No documents found in knowledge base</span>
              )}
            </div>
          </div>
        )}
        {/* Only show "Why this response was selected" when judge is enabled */}
        {!message.judgeDisabled && message.reason && (
          <button 
            className="expand-button"
            onClick={onToggleExpand}
          >
            {isExpanded ? 'Hide' : 'Show'} Why this response was selected
          </button>
        )}
        {!message.judgeDisabled && isExpanded && message.allResponses && (
          <div className="expanded-details">
            <div className="reason-section">
              <strong>Judge's Reasoning:</strong>
              <div className="reason-content">
                <ReactMarkdown>{message.reason}</ReactMarkdown>
              </div>
            </div>
            <div className="all-responses">
              <strong>All Model Responses:</strong>
              {message.allResponses.map((resp, idx) => (
                <div key={idx} className="response-item">
                  <div className="response-header">
                    <span className="response-model">{resp.model}</span>
                    {resp.error && (
                      <span className="error-badge">Error</span>
                    )}
                  </div>
                  <div className="response-content">
                    <ReactMarkdown>{resp.response || resp.error || 'No response'}</ReactMarkdown>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default MessageList

