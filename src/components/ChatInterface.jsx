import { useState, useRef, useEffect } from 'react'
import MessageList from './MessageList'
import InputArea from './InputArea'
import './ChatInterface.css'

function ChatInterface({ selectedModels, judgeModel }) {
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

  const handleSend = async () => {
    if (!inputText.trim() && selectedImages.length === 0 && selectedFiles.length === 0) {
      return
    }

    if (selectedModels.length !== 5) {
      alert('Please select exactly 5 models')
      return
    }

    const userMessage = {
      id: Date.now(),
      role: 'user',
      content: inputText,
      images: selectedImages,
      files: selectedFiles
    }

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
            const base64String = reader.result.split(',')[1] // Remove data:image/...;base64, prefix
            const mimeType = image.type || 'image/png'
            resolve({
              data: base64String,
              mimeType: mimeType,
              name: image.name
            })
          }
          reader.onerror = reject
          reader.readAsDataURL(image)
        })
      })

      // Convert files to base64 or text
      const filePromises = selectedFiles.map(file => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => {
            if (file.type.startsWith('text/') || file.type === 'application/pdf') {
              // For text files, read as text
              resolve({
                type: 'text',
                content: reader.result,
                name: file.name,
                mimeType: file.type
              })
            } else {
              // For other files, convert to base64
              const base64String = reader.result.split(',')[1]
              resolve({
                type: 'base64',
                data: base64String,
                name: file.name,
                mimeType: file.type
              })
            }
          }
          reader.onerror = reject
          if (file.type.startsWith('text/') || file.type === 'application/pdf') {
            reader.readAsText(file)
          } else {
            reader.readAsDataURL(file)
          }
        })
      })

      // Wait for all conversions
      const imagesBase64 = await Promise.all(imageBase64Promises)
      const filesData = await Promise.all(filePromises)

      // Send as JSON instead of FormData
      const requestData = {
        text: inputText,
        models: selectedModels,
        judgeModel: judgeModel,
        images: imagesBase64,
        files: filesData
      }

      console.log('Sending request with base64 images:', imagesBase64.length)

      const response = await fetch('http://localhost:3001/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Server error: ${response.status}`)
      }

      const data = await response.json()

      const assistantMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: data.bestResponse.response,
        model: data.bestResponse.model,
        reason: data.bestResponse.reason,
        allResponses: data.allResponses,
        judgeResult: data.judgeResult
      }

      setMessages(prev => [...prev, assistantMessage])
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

  return (
    <div className="chat-interface">
      <div className="chat-header">
        <h2>Chat</h2>
        {selectedModels.length !== 5 && (
          <p className="warning">Select 5 models to start chatting</p>
        )}
      </div>

      <MessageList 
        messages={messages} 
        isLoading={isLoading}
        messagesEndRef={messagesEndRef}
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
        canSend={selectedModels.length === 5}
      />
    </div>
  )
}

export default ChatInterface

