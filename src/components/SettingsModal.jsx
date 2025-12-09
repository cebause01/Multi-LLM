import { useState, useEffect } from 'react'
import './Modal.css'

function SettingsModal({ user, summaries = [], onClose, onSave, onSummariesUpdate }) {
  const [activeTab, setActiveTab] = useState('profile')
  const [showManageMemories, setShowManageMemories] = useState(false)
  const [localSummaries, setLocalSummaries] = useState(summaries)
  const [nickname, setNickname] = useState(user?.nickname || '')
  const [occupation, setOccupation] = useState(user?.occupation || '')
  const [moreAboutYou, setMoreAboutYou] = useState(user?.moreAboutYou || '')
  const [instructions, setInstructions] = useState(user?.instructions || '')
  const [baseStyle, setBaseStyle] = useState(user?.baseStyle || 'default')
  const [concise, setConcise] = useState(user?.concise || 'default')
  const [warm, setWarm] = useState(user?.warm || 'default')
  const [enthusiastic, setEnthusiastic] = useState(user?.enthusiastic || 'default')
  const [formal, setFormal] = useState(user?.formal || 'default')
  const [headersLists, setHeadersLists] = useState(user?.headersLists || 'default')
  const [emoji, setEmoji] = useState(user?.emoji || 'default')
  const [referenceSavedMemories, setReferenceSavedMemories] = useState(user?.referenceSavedMemories !== false)
  const [referenceChatHistory, setReferenceChatHistory] = useState(user?.referenceChatHistory !== false)

  useEffect(() => {
    if (user) {
      setNickname(user.nickname || '')
      setOccupation(user.occupation || '')
      setMoreAboutYou(user.moreAboutYou || '')
      setInstructions(user.instructions || '')
      setBaseStyle(user.baseStyle || 'default')
      setConcise(user.concise || 'default')
      setWarm(user.warm || 'default')
      setEnthusiastic(user.enthusiastic || 'default')
      setFormal(user.formal || 'default')
      setHeadersLists(user.headersLists || 'default')
      setEmoji(user.emoji || 'default')
      setReferenceSavedMemories(user.referenceSavedMemories !== false)
      setReferenceChatHistory(user.referenceChatHistory !== false)
    }
  }, [user])

  useEffect(() => {
    setLocalSummaries(summaries)
  }, [summaries])

  const handleSave = (e) => {
    e.preventDefault()
    onSave({ 
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
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Settings</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        
        <div className="settings-content">
          <div className="settings-tabs">
            <button
              className={`settings-tab ${activeTab === 'profile' ? 'active' : ''}`}
              onClick={() => setActiveTab('profile')}
            >
              Profile
            </button>
            <button
              className={`settings-tab ${activeTab === 'personalization' ? 'active' : ''}`}
              onClick={() => setActiveTab('personalization')}
            >
              Personalization
            </button>
            <button
              className={`settings-tab ${activeTab === 'data' ? 'active' : ''}`}
              onClick={() => setActiveTab('data')}
            >
              Data
            </button>
          </div>

          <div className="settings-panel">
            {activeTab === 'profile' && (
              <div className="settings-section">
                <h4>About you</h4>
                <form onSubmit={handleSave} className="modal-body">
                  <div className="form-group">
                    <label>Nickname</label>
                    <input 
                      type="text" 
                      value={nickname} 
                      onChange={(e) => setNickname(e.target.value)}
                      placeholder="What should the AI call you?"
                    />
                  </div>

                  <div className="form-group">
                    <label>Occupation</label>
                    <input 
                      type="text" 
                      value={occupation} 
                      onChange={(e) => setOccupation(e.target.value)}
                      placeholder="What do you do?"
                    />
                  </div>

                  <div className="form-group">
                    <label>More about you</label>
                    <textarea
                      rows={4}
                      value={moreAboutYou}
                      onChange={(e) => setMoreAboutYou(e.target.value)}
                      placeholder="Interests, values, or preferences to keep in mind"
                    />
                  </div>

                  <button type="submit" className="primary-btn">Save</button>
                </form>
              </div>
            )}

            {activeTab === 'personalization' && (
              <div className="settings-section">
                <form onSubmit={handleSave} className="modal-body">
                  <div className="personalization-section">
                    <h4>Base style and tone</h4>
                    <p className="section-description">
                      Set the style and tone of how the AI responds to you. This doesn't impact the AI's capabilities.
                    </p>
                    <div className="form-group">
                      <label>Style preset</label>
                      <select 
                        value={baseStyle} 
                        onChange={(e) => setBaseStyle(e.target.value)}
                        className="style-select"
                      >
                        <option value="default">Default: Preset style and tone</option>
                        <option value="professional">Professional: Polished and precise</option>
                        <option value="friendly">Friendly: Warm and chatty</option>
                        <option value="candid">Candid: Direct and encouraging</option>
                        <option value="quirky">Quirky: Playful and imaginative</option>
                        <option value="efficient">Efficient: Concise and plain</option>
                        <option value="formal">Formal</option>
                        <option value="nerdy">Nerdy: Exploratory and enthusiastic</option>
                        <option value="cynical">Cynical: Critical and sarcastic</option>
                      </select>
                    </div>

                  <div className="style-options">
                    <div className="style-option-item">
                      <label className="style-dropdown-label">
                        <span className="style-option-name">Concise</span>
                        <select
                          value={concise}
                          onChange={(e) => setConcise(e.target.value)}
                          className="style-dropdown"
                        >
                          <option value="more">More (Shorter and more focused)</option>
                          <option value="default">Default</option>
                          <option value="less">Less (More detail and explanation)</option>
                        </select>
                      </label>
                    </div>
                    <div className="style-option-item">
                      <label className="style-dropdown-label">
                        <span className="style-option-name">Warm</span>
                        <select
                          value={warm}
                          onChange={(e) => setWarm(e.target.value)}
                          className="style-dropdown"
                        >
                          <option value="more">More</option>
                          <option value="default">Default</option>
                          <option value="less">Less</option>
                        </select>
                      </label>
                    </div>
                    <div className="style-option-item">
                      <label className="style-dropdown-label">
                        <span className="style-option-name">Enthusiastic</span>
                        <select
                          value={enthusiastic}
                          onChange={(e) => setEnthusiastic(e.target.value)}
                          className="style-dropdown"
                        >
                          <option value="more">More</option>
                          <option value="default">Default</option>
                          <option value="less">Less</option>
                        </select>
                      </label>
                    </div>
                    <div className="style-option-item">
                      <label className="style-dropdown-label">
                        <span className="style-option-name">Formal</span>
                        <select
                          value={formal}
                          onChange={(e) => setFormal(e.target.value)}
                          className="style-dropdown"
                        >
                          <option value="more">More</option>
                          <option value="default">Default</option>
                          <option value="less">Less</option>
                        </select>
                      </label>
                    </div>
                    <div className="style-option-item">
                      <label className="style-dropdown-label">
                        <span className="style-option-name">Headers & Lists</span>
                        <select
                          value={headersLists}
                          onChange={(e) => setHeadersLists(e.target.value)}
                          className="style-dropdown"
                        >
                          <option value="more">More</option>
                          <option value="default">Default</option>
                          <option value="less">Less</option>
                        </select>
                      </label>
                    </div>
                    <div className="style-option-item">
                      <label className="style-dropdown-label">
                        <span className="style-option-name">Emoji</span>
                        <select
                          value={emoji}
                          onChange={(e) => setEmoji(e.target.value)}
                          className="style-dropdown"
                        >
                          <option value="more">More</option>
                          <option value="default">Default</option>
                          <option value="less">Less</option>
                        </select>
                      </label>
                    </div>
                  </div>
                </div>

                    <div className="settings-divider"></div>

                    <div className="personalization-section">
                      <h4>Custom instructions</h4>
                      <div className="form-group">
                        <label>Additional behavior, style, and tone preferences</label>
                        <textarea
                          rows={6}
                          value={instructions}
                          onChange={(e) => setInstructions(e.target.value)}
                          placeholder="Tell the model how to respond, preferences, tone, etc."
                        />
                      </div>
                    </div>

                    <div className="settings-divider"></div>

                    <div className="personalization-section">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <h4 style={{ margin: 0 }}>Memory</h4>
                        <button 
                          type="button" 
                          className="small-button"
                          onClick={() => setShowManageMemories(true)}
                        >
                          Manage
                        </button>
                      </div>
                      <div className="memory-toggle-wrapper">
                        <label className="memory-toggle-label">
                          <input
                            type="checkbox"
                            checked={referenceSavedMemories}
                            onChange={(e) => setReferenceSavedMemories(e.target.checked)}
                            className="memory-toggle-input"
                          />
                          <span className="memory-toggle-slider"></span>
                          <div className="memory-toggle-text">
                            <span className="memory-toggle-title">Reference saved memories</span>
                            <span className="memory-toggle-description">Let the AI save and use memories when responding.</span>
                          </div>
                        </label>
                      </div>
                      <div className="memory-toggle-wrapper">
                        <label className="memory-toggle-label">
                          <input
                            type="checkbox"
                            checked={referenceChatHistory}
                            onChange={(e) => setReferenceChatHistory(e.target.checked)}
                            className="memory-toggle-input"
                          />
                          <span className="memory-toggle-slider"></span>
                          <div className="memory-toggle-text">
                            <span className="memory-toggle-title">Reference chat history</span>
                            <span className="memory-toggle-description">Let the AI reference recent conversations when responding.</span>
                          </div>
                        </label>
                      </div>
                      <p className="memory-info-text">
                        The AI may use Memory to personalize queries to search providers. <a href="#" className="link-text">Learn more</a>
                      </p>
                    </div>

                    <button type="submit" className="primary-btn">Save</button>
                  </form>
              </div>
            )}

            {activeTab === 'data' && (
              <div className="settings-section">
                <h4>Personal RAG summaries</h4>
                <p className="section-description">
                  Your chat session summaries are stored here to provide personalized context.
                </p>
                {summaries.length === 0 ? (
                  <p className="muted">No summaries yet. Chat, and they will appear here.</p>
                ) : (
                  <div className="summary-list">
                    {summaries.map((s) => (
                      <div key={s.id} className="summary-card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                          <div>
                            <div className="summary-title">{s.title || 'Session'}</div>
                            <div className="summary-date">{new Date(s.createdAt).toLocaleString()}</div>
                          </div>
                          <button
                            className="small-button"
                            onClick={async () => {
                              if (confirm('Are you sure you want to delete this summary?')) {
                                try {
                                  const response = await fetch(`http://localhost:3001/api/session/summaries/${s._id || s.id}`, {
                                    method: 'DELETE',
                                    headers: { 
                                      'Authorization': `Bearer ${localStorage.getItem('authToken')}` 
                                    }
                                  })
                                  if (response.ok) {
                                    // Notify parent to refresh
                                    if (onSummariesUpdate) {
                                      onSummariesUpdate()
                                    }
                                  } else {
                                    const errorData = await response.json().catch(() => ({ error: 'Failed to delete summary' }))
                                    alert(errorData.error || 'Failed to delete summary')
                                  }
                                } catch (error) {
                                  console.error('Error deleting summary:', error)
                                  alert('Failed to delete summary: ' + error.message)
                                }
                              }
                            }}
                            style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                          >
                            Delete
                          </button>
                        </div>
                        <div className="summary-content">{s.summary}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {showManageMemories && (
        <div className="modal-backdrop" onClick={() => setShowManageMemories(false)}>
          <div className="modal manage-memories-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Manage Memories</h3>
              <button className="close-btn" onClick={() => setShowManageMemories(false)}>×</button>
            </div>
            <div className="modal-body">
              <p className="section-description">
                Your Personal RAG summaries serve as long-term memory. These are facts and context the AI learns about you from your conversations.
              </p>
              {localSummaries.length === 0 ? (
                <p className="muted" style={{ marginTop: '20px', textAlign: 'center' }}>
                  No memories yet. Start chatting and they will appear here.
                </p>
              ) : (
                <div className="summary-list" style={{ marginTop: '20px', maxHeight: '400px', overflowY: 'auto' }}>
                  {localSummaries.map((s) => (
                    <div key={s.id} className="summary-card">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <div>
                          <div className="summary-title">{s.title || 'Session'}</div>
                          <div className="summary-date">{new Date(s.createdAt).toLocaleString()}</div>
                        </div>
                        <button
                          className="small-button"
                          onClick={async () => {
                            if (confirm('Are you sure you want to delete this memory?')) {
                              try {
                                const response = await fetch(`http://localhost:3001/api/session/summaries/${s._id || s.id}`, {
                                  method: 'DELETE',
                                  headers: { 
                                    'Authorization': `Bearer ${localStorage.getItem('authToken')}` 
                                  }
                                })
                                if (response.ok) {
                                  // Remove from local state
                                  setLocalSummaries(prev => prev.filter(summary => (summary._id || summary.id) !== (s._id || s.id)))
                                  // Notify parent to refresh
                                  if (onSummariesUpdate) {
                                    onSummariesUpdate()
                                  }
                                } else {
                                  const errorData = await response.json().catch(() => ({ error: 'Failed to delete memory' }))
                                  alert(errorData.error || 'Failed to delete memory')
                                }
                              } catch (error) {
                                console.error('Error deleting memory:', error)
                                alert('Failed to delete memory: ' + error.message)
                              }
                            }
                          }}
                          style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                        >
                          Delete
                        </button>
                      </div>
                      <div className="summary-content">{s.summary}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SettingsModal

