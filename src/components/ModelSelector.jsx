import './ModelSelector.css'

function ModelSelector({ 
  availableModels, 
  selectedModels, 
  judgeModel, 
  onModelToggle, 
  onJudgeModelChange,
  isLoading 
}) {
  const popularModels = [
    'openrouter/bert-nebulon-alpha',
    'x-ai/grok-4.1-fast:free',
    'nvidia/nemotron-nano-12b-v2-vl:free',
    'google/gemma-3-4b-it:free',
    'google/gemma-3-12b-it:free',
    'google/gemma-3-27b-it:free',
    'google/gemini-2.0-flash-exp:free',
    'moonshotai/kimi-k2:free'
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

  const progressPercentage = (selectedModels.length / 5) * 100

  return (
    <div className="model-selector">
      <div className="selector-section">
        <div className="section-header">
          <h3>Select Models</h3>
          <div className="progress-indicator">
            <span className="progress-text">{selectedModels.length}/5</span>
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${progressPercentage}%` }}
              ></div>
            </div>
          </div>
        </div>
        <div className="model-list">
          {isLoading ? (
            <div className="loading">
              <div className="loading-spinner"></div>
              <span>Loading models...</span>
            </div>
          ) : (
            displayModels.map(model => {
              const isSelected = selectedModels.includes(model.id)
              const isDisabled = !isSelected && selectedModels.length >= 5
              const formatted = formatModelName(model.id)
              
              return (
                <div
                  key={model.id}
                  className={`model-item ${isSelected ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}`}
                  onClick={() => !isDisabled && onModelToggle(model.id)}
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
                  {isSelected && (
                    <span className="selected-badge">✓</span>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>

      <div className="selector-section">
        <div className="section-header">
          <h3>Judge Model</h3>
          <span className="section-subtitle">Evaluates all responses</span>
        </div>
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
      </div>
    </div>
  )
}

export default ModelSelector

