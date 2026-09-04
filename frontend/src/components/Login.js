import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import './Login.css';

function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [buttonPosition, setButtonPosition] = useState('center'); // 'center', 'left', 'right'

  const isFormValid = useCallback(() => {
    return username.trim() !== '' && password.trim() !== '';
  }, [username, password]);


  const handleButtonHover = () => {
    if (!isFormValid()) {
      // Dodge in the opposite direction of where the button currently is
      if (buttonPosition === 'center' || buttonPosition === 'right') {
        setButtonPosition('left');
      } else {
        setButtonPosition('right');
      }
    }
  };

  const getButtonClassName = () => {
    const baseClass = 'login-button';
    if (isLoading) return `${baseClass} loading`;
    if (isFormValid()) return `${baseClass} clickable`;
    if (buttonPosition === 'left') return `${baseClass} dodge-left`;
    if (buttonPosition === 'right') return `${baseClass} dodge-right`;
    return baseClass;
  };

  const handleSubmitAttempt = (e) => {
    e.preventDefault();
    if (!isFormValid()) {
      setButtonPosition(buttonPosition === 'center' ? 'left' : 'center');
      return;
    }
    handleSubmit(e);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isFormValid()) return;
    
    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append('username', username);
      formData.append('password', password);

      const response = await axios.post('http://localhost:8000/token', formData);
      onLogin(response.data.access_token);
    } catch (err) {
      setError('Invalid credentials');
      setIsLoading(false);
    }
  };

  // Reset button position when form becomes valid
  useEffect(() => {
    if (isFormValid()) {
      setButtonPosition('center');
    }
  }, [username, password, isFormValid]); // Added isFormValid to dependencies

  const fillDemoCredentials = () => {
    setUsername('admin');
    setPassword('admin123');
  };

  return (
    <div className="login-wrapper">
      <div className="circuit-background">
        <div className="circuit-lines"></div>
      </div>
      <div className="login-container two-column-card">
        {/* Left Section: AI Brand Visual */}
        <div className="login-visual">
          <div className="ai-circles"></div>
          <div className="ai-circles"></div>
          <div className="ai-circles"></div>
          <div className="brand-hero">
            <span className="brand-tag">AI PLATFORM</span>
            <h1 className="brand-title">WhatSenti AI</h1>
            <p className="brand-sub">Real-Time NLP Sentiment & Emotion Intelligence Studio</p>
          </div>
        </div>

        {/* Right Section: Form Inputs */}
        <div className="login-form-container">
          <div className="login-header">
            <h2>Welcome Back</h2>
            <p>Sign in to access your sentiment analytics studio</p>
          </div>

          {error && <div className="error-message">{error}</div>}

          <form onSubmit={handleSubmitAttempt}>
            <div className="form-group">
              <input
                type="text"
                id="username"
                required
                value={username}
                placeholder=" "
                onChange={(e) => setUsername(e.target.value)}
              />
              <label htmlFor="username">Username</label>
            </div>

            <div className="form-group">
              <input
                type="password"
                id="password"
                required
                value={password}
                placeholder=" "
                onChange={(e) => setPassword(e.target.value)}
              />
              <label htmlFor="password">Password</label>
            </div>

            <button 
              type="submit" 
              className={getButtonClassName()}
              onMouseEnter={handleButtonHover}
              disabled={isLoading || !isFormValid()}
            >
              {isLoading ? 'Authenticating...' : 'Sign In to Studio →'}
            </button>
          </form>

          <button 
            type="button" 
            className="demo-fill-btn"
            onClick={fillDemoCredentials}
          >
            ⚡ Auto-Fill Demo Credentials (admin / admin123)
          </button>
        </div>
      </div>
    </div>
  );
}

export default Login;
