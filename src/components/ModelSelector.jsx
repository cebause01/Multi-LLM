import { useState, useEffect, useRef } from 'react'
import './ModelSelector.css'
import KnowledgeBase from './KnowledgeBase'

function ModelSelector({ 
  availableModels, 
  selectedModels, 
  judgeModel, 
  onModelToggle, 
  onJudgeModelChange,
  isLoading,
  hipaaEnabled,
  onHipaaToggle,
  cragEnabled,
  onCragToggle,
  judgeEnabled,
  onJudgeToggle
}) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const dropdownRef = useRef(null)

  const popularModels = [
    'nvidia/nemotron-nano-12b-v2-vl:free',
    'google/gemma-3-4b-it:free',
    'google/gemma-3-12b-it:free',
    'google/gemma-3-27b-it:free'
  ]

  // Format model names for better display
  const formatModelName = (modelId) => {
    const parts = modelId.split('/')
    if (parts.length === 2) {
      const [provider, model] = parts
      const cleanProvider = provider.charAt(0).toUpperCase() + provider.slice(1)
      const cleanModel = model.split(':')[0].replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
      return { provider: cleanProvider, model: cleanModel }
    }
    return { provider: modelId, model: '' }
  }

  const displayModels = availableModels.length > 0 
    ? availableModels.filter(m => popularModels.includes(m.id))
    : popularModels.map(id => ({ id, name: id }))

  const progressPercentage = Math.min((selectedModels.length / 3) * 100, 100)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false)
      }
    }

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isDropdownOpen])

  const getSelectedModelsText = () => {
    if (selectedModels.length === 0) {
      return 'Select models (max 3)'
    }
    if (selectedModels.length === 1) {
      const formatted = formatModelName(selectedModels[0])
      return `${formatted.provider} - ${formatted.model || selectedModels[0]}`
    }
    return `${selectedModels.length} models selected`
  }

  return (
    <div className="model-selector">
      <div className="selector-section">
        <div className="section-header">
          <h3>Select Models</h3>
          <div className="progress-indicator">
            <span className="progress-text">{selectedModels.length} selected</span>
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${progressPercentage}%` }}
              ></div>
            </div>
          </div>
        </div>
        <div className="model-dropdown-wrapper" ref={dropdownRef}>
          <button
            className="model-dropdown-button"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            disabled={isLoading}
          >
            <span className="dropdown-text">{isLoading ? 'Loading models...' : getSelectedModelsText()}</span>
            <span className={`dropdown-arrow ${isDropdownOpen ? 'open' : ''}`}>▼</span>
          </button>
          {isDropdownOpen && !isLoading && (
            <div className="model-dropdown-menu">
              {displayModels.map(model => {
                const isSelected = selectedModels.includes(model.id)
                const isDisabled = !isSelected && selectedModels.length >= 3
                const formatted = formatModelName(model.id)
                
                return (
                  <div
                    key={model.id}
                    className={`model-dropdown-item ${isSelected ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}`}
                    onClick={() => {
                      if (!isDisabled) {
                        onModelToggle(model.id)
                      }
                    }}
                  >
                    <div className="checkbox-wrapper">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        disabled={isDisabled}
                        className="model-checkbox"
                      />
                      <span className="checkmark"></span>
                    </div>
                    <div className="model-info">
                      <span className="model-provider">{formatted.provider}</span>
                      <span className="model-name">{formatted.model || model.id}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <div className="selector-section">
        <div className="section-header">
          <h3>Judge Model</h3>
          <span className="section-subtitle">Evaluates all responses</span>
        </div>
        <div className="hipaa-toggle-wrapper" style={{ marginBottom: '8px' }}>
          <label className="hipaa-toggle-label">
            <input
              type="checkbox"
              checked={judgeEnabled}
              onChange={(e) => onJudgeToggle(e.target.checked)}
              className="hipaa-toggle-input"
            />
            <span className="hipaa-toggle-slider"></span>
            <span className="hipaa-toggle-text">Auto-select best (Judge)</span>
          </label>
          {!judgeEnabled && (
            <span className="hipaa-description">Showing all answers; you choose</span>
          )}
        </div>
        {judgeEnabled ? (
          <div className="judge-select-wrapper">
            <select 
              value={judgeModel} 
              onChange={(e) => onJudgeModelChange(e.target.value)}
              className="judge-select"
            >
              {displayModels.map(model => {
                const formatted = formatModelName(model.id)
                return (
                  <option key={model.id} value={model.id}>
                    {formatted.provider} - {formatted.model || model.id}
                  </option>
                )
              })}
            </select>
          </div>
        ) : null}
        
        <div className="hipaa-toggle-wrapper">
          <label className="hipaa-toggle-label">
            <input
              type="checkbox"
              checked={hipaaEnabled}
              onChange={(e) => onHipaaToggle(e.target.checked)}
              className="hipaa-toggle-input"
            />
            <span className="hipaa-toggle-slider"></span>
            <span className="hipaa-toggle-text">HIPAA</span>
          </label>
          {hipaaEnabled && (
            <span className="hipaa-description">PHI/PII filtering enabled</span>
          )}
        </div>

        <div className="hipaa-toggle-wrapper">
          <label className="hipaa-toggle-label">
            <input
              type="checkbox"
              checked={cragEnabled}
              onChange={(e) => onCragToggle(e.target.checked)}
              className="hipaa-toggle-input"
            />
            <span className="hipaa-toggle-slider"></span>
            <span className="hipaa-toggle-text">CRAG</span>
          </label>
          {cragEnabled && (
            <span className="hipaa-description">Retrieval Augmented Generation active</span>
          )}
        </div>
      </div>

      {cragEnabled && (
        <KnowledgeBase 
          cragEnabled={cragEnabled}
          onCragToggle={onCragToggle}
        />
      )}
    </div>
  )
}

export default ModelSelector

