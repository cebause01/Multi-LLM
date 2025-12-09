import { useRef, useEffect } from 'react'
import './InputArea.css'

function InputArea({
  inputText,
  setInputText,
  selectedImages,
  setSelectedImages,
  selectedFiles,
  setSelectedFiles,
  onSend,
  onKeyPress,
  isLoading,
  canSend
}) {
  const fileInputRef = useRef(null)
  const imageInputRef = useRef(null)
  const imageUrlsRef = useRef([])

  const handleImageSelect = (e) => {
    const files = Array.from(e.target.files)
    const maxSize = 10 * 1024 * 1024 // 10MB
    const validFiles = []
    
    files.forEach(file => {
      if (file.size > maxSize) {
        alert(`Image "${file.name}" is too large. Maximum size is 10MB.`)
        return
      }
      validFiles.push(file)
    })
    
    if (validFiles.length > 0) {
      setSelectedImages(prev => [...prev, ...validFiles])
    }
    e.target.value = ''
  }

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files)
    const maxSize = 10 * 1024 * 1024 // 10MB
    const validFiles = []
    
    files.forEach(file => {
      if (file.size > maxSize) {
        alert(`File "${file.name}" is too large. Maximum size is 10MB.`)
        return
      }
      validFiles.push(file)
    })
    
    if (validFiles.length > 0) {
      setSelectedFiles(prev => [...prev, ...validFiles])
    }
    e.target.value = ''
  }

  const removeImage = (index) => {
    // Clean up the object URL to prevent memory leaks
    // Note: URLs are created in render, so we'll clean up all and let them be recreated
    imageUrlsRef.current.forEach(url => URL.revokeObjectURL(url))
    imageUrlsRef.current = []
    setSelectedImages(prev => prev.filter((_, i) => i !== index))
  }

  const removeFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
  }

  // Cleanup object URLs when component unmounts or images change
  useEffect(() => {
    return () => {
      // Revoke all object URLs on unmount
      imageUrlsRef.current.forEach(url => URL.revokeObjectURL(url))
      imageUrlsRef.current = []
    }
  }, [])

  return (
    <div className="input-area">
      {(selectedImages.length > 0 || selectedFiles.length > 0) && (
        <div className="attachments-preview">
          {selectedImages.map((img, idx) => {
            const imageUrl = URL.createObjectURL(img)
            // Track the URL for cleanup
            if (!imageUrlsRef.current.includes(imageUrl)) {
              imageUrlsRef.current.push(imageUrl)
            }
            return (
              <div key={idx} className="attachment-item">
                <img 
                  src={imageUrl} 
                  alt={`Preview ${idx + 1}`}
                  className="attachment-preview"
                />
                <button 
                  className="remove-attachment"
                  onClick={() => removeImage(idx)}
                >
                  ×
                </button>
              </div>
            )
          })}
          {selectedFiles.map((file, idx) => (
            <div key={idx} className="attachment-item file">
              <span className="file-icon">File</span>
              <span className="file-name">{file.name}</span>
              <button 
                className="remove-attachment"
                onClick={() => removeFile(idx)}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="input-container">
        <div className="input-actions">
          <button
            className="action-button"
            onClick={() => imageInputRef.current?.click()}
            title="Upload image"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" fill="currentColor"/>
            </svg>
          </button>
          <button
            className="action-button"
            onClick={() => fileInputRef.current?.click()}
            title="Upload file"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" fill="currentColor"/>
            </svg>
          </button>
        </div>

        <textarea
          className="text-input"
          placeholder="Type your message..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={onKeyPress}
          rows={1}
          disabled={isLoading || !canSend}
        />

        <button
          className="send-button"
          onClick={onSend}
          disabled={isLoading || !canSend || (!inputText.trim() && selectedImages.length === 0 && selectedFiles.length === 0)}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" fill="currentColor"/>
          </svg>
        </button>

        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleImageSelect}
          style={{ display: 'none' }}
        />
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
      </div>
    </div>
  )
}

export default InputArea

