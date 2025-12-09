import { useState } from 'react'
import './LoginPage.css'

function LoginPage({ onLogin, onSignup }) {
  const [isSignup, setIsSignup] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nickname, setNickname] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      if (isSignup) {
        await onSignup({ email, password, nickname })
      } else {
        await onLogin({ email, password })
      }
    } catch (err) {
      setError(err.message || 'Authentication failed')
      setIsLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-header">
          <h1 className="logo">Aura AI</h1>
        </div>

        <div className="login-card">
          <div className="login-tabs">
            <button
              className={!isSignup ? 'active' : ''}
              onClick={() => {
                setIsSignup(false)
                setError('')
              }}
            >
              Login
            </button>
            <button
              className={isSignup ? 'active' : ''}
              onClick={() => {
                setIsSignup(true)
                setError('')
              }}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="login-form">
            {error && (
              <div className="error-message">
                {error}
              </div>
            )}

            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="your@email.com"
                disabled={isLoading}
              />
            </div>

            {isSignup && (
              <div className="form-group">
                <label>Nickname (optional)</label>
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="How should we call you?"
                  disabled={isLoading}
                />
              </div>
            )}

            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                disabled={isLoading}
                minLength={6}
              />
            </div>

            <button
              type="submit"
              className="login-button"
              disabled={isLoading}
            >
              {isLoading ? 'Please wait...' : (isSignup ? 'Sign Up' : 'Login')}
            </button>
          </form>

          <div className="login-footer">
            <p>
              {isSignup ? (
                <>Already have an account? <button className="link-button" onClick={() => setIsSignup(false)}>Login</button></>
              ) : (
                <>Don't have an account? <button className="link-button" onClick={() => setIsSignup(true)}>Sign Up</button></>
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LoginPage

