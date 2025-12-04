import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import './MessageList.css'

function MessageList({ messages, isLoading, messagesEndRef }) {
  const [expandedMessage, setExpandedMessage] = useState(null)

  if (messages.length === 0) {
    return (
      <div className="message-list empty">
        <div className="empty-state">
          <h3>Start a conversation</h3>
          <p>Select 5 models and send a message to compare their responses</p>
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

function Message({ message, isExpanded, onToggleExpand }) {
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
                  📄 {file.name}
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
        {message.model && (
          <div className="model-badge">
            {message.model}
          </div>
        )}
        <div className="message-text">
          <ReactMarkdown>{message.content}</ReactMarkdown>
        </div>
        {message.reason && (
          <button 
            className="expand-button"
            onClick={onToggleExpand}
          >
            {isExpanded ? '▼' : '▶'} Why this response was selected
          </button>
        )}
        {isExpanded && message.allResponses && (
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

