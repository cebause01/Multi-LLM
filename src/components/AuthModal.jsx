import { useState } from 'react'
import './Modal.css'

function AuthModal({ mode = 'login', onClose, onSwitchMode, onSubmit }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nickname, setNickname] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    onSubmit({ mode, email, password, nickname })
  }

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <div className="modal-header">
          <h3>{mode === 'signup' ? 'Create account' : 'Log in'}</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit} className="modal-body">
          <label>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <label>Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          {mode === 'signup' && (
            <>
              <label>Nickname (optional)</label>
              <input type="text" value={nickname} onChange={(e) => setNickname(e.target.value)} />
            </>
          )}
          <button type="submit" className="primary-btn">
            {mode === 'signup' ? 'Sign up' : 'Log in'}
          </button>
        </form>
        <div className="modal-footer">
          {mode === 'signup' ? (
            <span>Already have an account? <button className="link-btn" onClick={() => onSwitchMode('login')}>Log in</button></span>
          ) : (
            <span>No account? <button className="link-btn" onClick={() => onSwitchMode('signup')}>Sign up</button></span>
          )}
        </div>
      </div>
    </div>
  )
}

export default AuthModal

