import { useState, useEffect } from 'react'
import ChatInterface from './components/ChatInterface'
import ModelSelector from './components/ModelSelector'
import LoginPage from './components/LoginPage'
import SettingsModal from './components/SettingsModal'
import './App.css'

function App() {
  const [selectedModels, setSelectedModels] = useState([])
  const [judgeModel, setJudgeModel] = useState('google/gemini-2.0-flash-exp:free')
  const [availableModels, setAvailableModels] = useState([])
  const [isLoadingModels, setIsLoadingModels] = useState(true)
  const [hipaaEnabled, setHipaaEnabled] = useState(false)
  const [cragEnabled, setCragEnabled] = useState(false)
  const [judgeEnabled, setJudgeEnabled] = useState(true)
  const [authToken, setAuthToken] = useState(null)
  const [user, setUser] = useState(null)
  const [showSettings, setShowSettings] = useState(false)
  const [personalSummaries, setPersonalSummaries] = useState([])
  const [showUserMenu, setShowUserMenu] = useState(false)

  useEffect(() => {
    fetchAvailableModels()
    const stored = localStorage.getItem('authToken')
    if (stored) {
      setAuthToken(stored)
      fetchProfile(stored)
    }
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
      } else if (prev.length < 3) {
        return [...prev, modelId]
      }
      return prev
    })
  }

  const fetchProfile = async (token) => {
    try {
      const res = await fetch('http://localhost:3001/api/user/profile', {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setUser(data)
      }
    } catch (err) {
      console.error('Profile fetch failed', err)
    }
  }

  const handleLogin = async ({ email, password }) => {
    try {
      const res = await fetch('http://localhost:3001/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })
      
      // Check if response is ok before parsing JSON
      if (!res.ok) {
        const text = await res.text()
        let errorMsg = 'Login failed'
        try {
          const errorData = JSON.parse(text)
          errorMsg = errorData.error || errorMsg
        } catch {
          errorMsg = text || `Server error: ${res.status}`
        }
        throw new Error(errorMsg)
      }
      
      const data = await res.json()
      setAuthToken(data.token)
      localStorage.setItem('authToken', data.token)
      setUser(data.user)
    } catch (err) {
      throw err
    }
  }

  const handleSignup = async ({ email, password, nickname }) => {
    try {
      const res = await fetch('http://localhost:3001/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, nickname })
      })
      
      // Check if response is ok before parsing JSON
      if (!res.ok) {
        const text = await res.text()
        let errorMsg = 'Signup failed'
        try {
          const errorData = JSON.parse(text)
          errorMsg = errorData.error || errorMsg
        } catch {
          errorMsg = text || `Server error: ${res.status}`
        }
        throw new Error(errorMsg)
      }
      
      const data = await res.json()
      setAuthToken(data.token)
      localStorage.setItem('authToken', data.token)
      setUser(data.user)
    } catch (err) {
      throw err
    }
  }

  const handleLogout = () => {
    setAuthToken(null)
    setUser(null)
    localStorage.removeItem('authToken')
  }

  const openSettings = async () => {
    if (!authToken) return
    await fetchProfile(authToken)
    await fetchSummaries()
    setShowSettings(true)
  }

  const fetchSummaries = async () => {
    if (!authToken) return
    try {
      const res = await fetch('http://localhost:3001/api/session/summaries', {
        headers: { Authorization: `Bearer ${authToken}` }
      })
      const data = await res.json()
      if (res.ok) setPersonalSummaries(data.summaries || [])
    } catch (err) {
      console.error('Failed to fetch summaries', err)
    }
  }

  const saveProfile = async ({ 
    nickname,
    occupation,
    moreAboutYou,
    instructions,
    baseStyle,
    concise,
    warm,
    enthusiastic,
    formal,
    headersLists,
    emoji,
    referenceSavedMemories,
    referenceChatHistory
  }) => {
    if (!authToken) {
      alert('Please login to save your profile')
      return
    }
    try {
      const res = await fetch('http://localhost:3001/api/user/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ 
          nickname,
          occupation,
          moreAboutYou,
          instructions,
          baseStyle,
          concise,
          warm,
          enthusiastic,
          formal,
          headersLists,
          emoji,
          referenceSavedMemories,
          referenceChatHistory
        })
      })
      const data = await res.json()
      if (res.ok) {
        // Update local user state with saved profile
        setUser(data)
        alert('Profile saved successfully!')
        setShowSettings(false)
      } else {
        console.error('Failed to save profile:', data.error)
        alert(`Failed to save profile: ${data.error || 'Unknown error'}`)
      }
    } catch (err) {
      console.error('Failed to save profile', err)
    }
  }

  // Show login page if not authenticated
  if (!authToken || !user) {
    return (
      <LoginPage
        onLogin={handleLogin}
        onSignup={handleSignup}
      />
    )
  }

  return (
    <div className="app">
      <div className="sidebar">
        <div className="sidebar-header">
          <h1 className="logo">Aura AI</h1>
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
          cragEnabled={cragEnabled}
          onCragToggle={setCragEnabled}
          judgeEnabled={judgeEnabled}
          onJudgeToggle={setJudgeEnabled}
        />
      </div>

      <div className="main-content">
        <ChatInterface
          selectedModels={selectedModels}
          judgeModel={judgeModel}
          hipaaEnabled={hipaaEnabled}
          cragEnabled={cragEnabled}
          judgeEnabled={judgeEnabled}
          authToken={authToken}
          user={user}
          onSavedSummary={fetchSummaries}
          onOpenSettings={openSettings}
          onLogout={handleLogout}
        />
      </div>

      {showSettings && user && (
        <SettingsModal
          user={user}
          summaries={personalSummaries}
          onClose={() => setShowSettings(false)}
          onSave={saveProfile}
          onSummariesUpdate={fetchSummaries}
        />
      )}
      
      {/* Close dropdown when clicking outside */}
      {showUserMenu && (
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
      )}
    </div>
  )
}

export default App

