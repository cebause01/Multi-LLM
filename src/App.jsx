import { useState, useEffect } from 'react'
import ChatInterface from './components/ChatInterface'
import ModelSelector from './components/ModelSelector'
import './App.css'

function App() {
  const [selectedModels, setSelectedModels] = useState([])
  const [judgeModel, setJudgeModel] = useState('google/gemini-2.0-flash-exp:free')
  const [availableModels, setAvailableModels] = useState([])
  const [isLoadingModels, setIsLoadingModels] = useState(true)
  const [hipaaEnabled, setHipaaEnabled] = useState(false)

  useEffect(() => {
    fetchAvailableModels()
  }, [])

  const fetchAvailableModels = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/models')
      const data = await response.json()
      if (data.data) {
        setAvailableModels(data.data)
      }
    } catch (error) {
      console.error('Failed to fetch models:', error)
    } finally {
      setIsLoadingModels(false)
    }
  }

  const handleModelToggle = (modelId) => {
    setSelectedModels(prev => {
      if (prev.includes(modelId)) {
        return prev.filter(id => id !== modelId)
      } else if (prev.length < 5) {
        return [...prev, modelId]
      }
      return prev
    })
  }

  return (
    <div className="app">
      <div className="sidebar">
        <div className="sidebar-header">
          <h1>Multi-LLM Chat</h1>
          <p className="subtitle">Compare responses from 5 AI models</p>
        </div>
        
        <ModelSelector
          availableModels={availableModels}
          selectedModels={selectedModels}
          judgeModel={judgeModel}
          onModelToggle={handleModelToggle}
          onJudgeModelChange={setJudgeModel}
          isLoading={isLoadingModels}
          hipaaEnabled={hipaaEnabled}
          onHipaaToggle={setHipaaEnabled}
        />
      </div>

      <div className="main-content">
        <ChatInterface
          selectedModels={selectedModels}
          judgeModel={judgeModel}
          hipaaEnabled={hipaaEnabled}
        />
      </div>
    </div>
  )
}

export default App

