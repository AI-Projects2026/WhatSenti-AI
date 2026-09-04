import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import './Dashboard.css';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

function Dashboard({ token, onLogout }) {
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [activeTab, setActiveTab] = useState('csv'); // 'csv' or 'text'
  
  // Single Text State
  const [singleText, setSingleText] = useState('');
  const [singleResult, setSingleResult] = useState(null);
  const [isAnalyzingText, setIsAnalyzingText] = useState(false);

  // Table Filter & Search State
  const [searchTerm, setSearchTerm] = useState('');
  const [sentimentFilter, setSentimentFilter] = useState('all');

  useEffect(() => {
    const handleScroll = () => {
      const totalScroll = document.documentElement.scrollHeight - window.innerHeight;
      const currentScroll = window.pageYOffset;
      const progress = totalScroll > 0 ? (currentScroll / totalScroll) * 100 : 0;
      setScrollProgress(progress);
      setShowScrollTop(currentScroll > 300);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      await handleFileUpload(file);
    }
  };

  const handleFileUpload = async (file) => {
    if (!file) return;
    setIsUploading(true);
    setError('');
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post('http://localhost:8000/analyze', formData, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setResults(response.data);
    } catch (err) {
      if (err.response?.status === 401) {
        onLogout();
        return;
      }
      setError(err.response?.data?.detail || 'Error analyzing CSV file. Please upload a valid CSV containing text data.');
      setResults(null);
    }
    setIsUploading(false);
  };



  const handleSingleTextSubmit = async (e) => {
    e?.preventDefault();
    if (!singleText.trim()) return;
    setIsAnalyzingText(true);
    setError('');

    try {
      const response = await axios.post(
        'http://localhost:8000/analyze-text',
        { text: singleText },
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      setSingleResult(response.data);
    } catch (err) {
      if (err.response?.status === 401) {
        onLogout();
        return;
      }
      setError(err.response?.data?.detail || 'Error analyzing text. Please check server logs.');
      setSingleResult(null);
    }
    setIsAnalyzingText(false);
  };

  const handleExportCSV = () => {
    if (!results || !results.results) return;
    const headers = ['id', 'text', 'sentiment', 'polarity', 'timestamp'];
    const rows = results.results.map(r => [
      r.id,
      `"${r.text.replace(/"/g, '""')}"`,
      r.sentiment,
      r.polarity || 0,
      r.timestamp
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'analyzed_sentiment_results.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtered Results
  const filteredResults = results?.results.filter(item => {
    const matchesSearch = item.text.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          String(item.id).toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = sentimentFilter === 'all' || item.sentiment === sentimentFilter;
    return matchesSearch && matchesFilter;
  }) || [];

  // Summary Metrics
  const totalCount = results?.results.length || 0;
  const positiveCount = results?.statistics.positive || 0;
  const neutralCount = results?.statistics.neutral || 0;
  const negativeCount = results?.statistics.negative || 0;

  const posPct = totalCount > 0 ? ((positiveCount / totalCount) * 100).toFixed(1) : 0;
  const neuPct = totalCount > 0 ? ((neutralCount / totalCount) * 100).toFixed(1) : 0;
  const negPct = totalCount > 0 ? ((negativeCount / totalCount) * 100).toFixed(1) : 0;
  const netScore = totalCount > 0 ? (((positiveCount - negativeCount) / totalCount) * 100).toFixed(1) : 0;

  const chartData = results ? {
    labels: ['Positive', 'Neutral', 'Negative'],
    datasets: [{
      label: 'Volume Count',
      data: [positiveCount, neutralCount, negativeCount],
      backgroundColor: [
        'rgba(16, 185, 129, 0.85)',
        'rgba(245, 158, 11, 0.85)',
        'rgba(244, 63, 94, 0.85)',
      ],
      borderColor: [
        '#10b981',
        '#f59e0b',
        '#f43f5e',
      ],
      borderWidth: 2,
      borderRadius: 8,
    }],
  } : null;

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: true,
        text: 'Sentiment Category Distribution',
        color: '#f8fafc',
        font: { size: 16, weight: '700', family: 'Plus Jakarta Sans' }
      },
      tooltip: {
        backgroundColor: '#0f172a',
        borderColor: '#06b6d4',
        borderWidth: 1,
        titleColor: '#ffffff',
        bodyColor: '#cbd5e1',
        padding: 12,
      }
    },
    scales: {
      x: {
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: { color: '#94a3b8', font: { family: 'Plus Jakarta Sans', weight: '600' } }
      },
      y: {
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: { color: '#94a3b8', font: { family: 'Plus Jakarta Sans' } }
      }
    }
  };

  return (
    <div className="dashboard-wrapper">
      <div 
        className="scroll-progress" 
        style={{ transform: `scaleX(${scrollProgress / 100})` }}
      />

      <div 
        className={`scroll-top ${showScrollTop ? 'visible' : ''}`}
        onClick={scrollToTop}
      >
        ↑
      </div>

      <nav className="dashboard-nav">
        <div className="nav-brand">
          <span className="nav-badge">WHATSENTI AI</span>
          <h1>WhatSenti AI — Sentiment Engine</h1>
        </div>
        <div className="nav-actions">
          <span className="user-badge">⚡ Admin Active</span>
          <button onClick={onLogout} className="logout-button">
            Sign Out
          </button>
        </div>
      </nav>

      <div className="dashboard-content">
        {/* Workspace Mode Header */}
        <div className="workspace-header">
          <h2>WhatSenti AI Analytics Engine</h2>
          <p>Analyze real-time customer reviews, text inputs, or upload CSV files for instant batch analytics.</p>
        </div>

        {/* Tab Selection */}
        <div className="tabs-container">
          <button 
            className={`tab-btn ${activeTab === 'csv' ? 'active' : ''}`}
            onClick={() => setActiveTab('csv')}
          >
            📊 Batch CSV Analyzer
          </button>
          <button 
            className={`tab-btn ${activeTab === 'text' ? 'active' : ''}`}
            onClick={() => setActiveTab('text')}
          >
            ✨ Quick Text Analyzer
          </button>
        </div>

        {/* TAB 1: CSV FILE ANALYSIS */}
        {activeTab === 'csv' && (
          <div className="upload-section">
            <input
              type="file"
              accept=".csv"
              onChange={(e) => handleFileUpload(e.target.files[0])}
              className="file-input"
              id="file-input"
            />
            
            <label htmlFor="file-input" className={`drop-zone ${dragActive ? 'drag-active' : ''}`}
                   onDragEnter={handleDrag}
                   onDragLeave={handleDrag}
                   onDragOver={handleDrag}
                   onDrop={handleDrop}>
              <div className="upload-icon-box">
                <span className="upload-emoji">📁</span>
              </div>
              <h3 className="drop-title">Drag & Drop CSV File Here</h3>
              <p className="drop-sub">CSV must contain <code>id</code> and <code>text</code> columns</p>
              
              {isUploading ? (
                <div className="loader-container">
                  <div className="loader"></div>
                  <p>Processing NLP Sentiment Analysis...</p>
                </div>
              ) : (
                <div className="drop-actions">
                  <span className="browse-btn">Browse Local File</span>
                </div>
              )}
            </label>
          </div>
        )}

        {/* TAB 2: SINGLE TEXT ANALYZER */}
        {activeTab === 'text' && (
          <div className="single-text-card">
            <h3>Instant Single-Sentence Analysis</h3>
            <p className="section-sub">Type or paste any text to classify its sentiment polarity and subjectivity instantly.</p>
            
            <form onSubmit={handleSingleTextSubmit} className="text-form">
              <textarea
                value={singleText}
                onChange={(e) => setSingleText(e.target.value)}
                placeholder="e.g. 'The product quality exceeded my expectations! Highly recommended.'"
                rows="4"
                className="text-input"
              />
              
              <div className="preset-buttons">
                <span className="preset-label">Sample Presets:</span>
                <button type="button" onClick={() => setSingleText("The new user experience is exceptionally smooth, fast, and delightful!")}>Positive</button>
                <button type="button" onClick={() => setSingleText("The app crashes every time I open the report page. Extremely frustrated.")}>Negative</button>
                <button type="button" onClick={() => setSingleText("The project status update meeting will occur tomorrow at 2 PM.")}>Neutral</button>
              </div>

              <button 
                type="submit" 
                className="analyze-text-btn"
                disabled={isAnalyzingText || !singleText.trim()}
              >
                {isAnalyzingText ? 'Analyzing Sentiment...' : 'Analyze Text Sentiment →'}
              </button>
            </form>

            {singleResult && (
              <div className="single-result-box">
                <div className="result-header">
                  <span className={`sentiment-badge ${singleResult.sentiment}`}>
                    {singleResult.sentiment.toUpperCase()}
                  </span>
                  <span className="result-text-preview">"{singleResult.text}"</span>
                </div>
                
                <div className="metrics-grid">
                  <div className="metric-box">
                    <span className="metric-label">Polarity Score</span>
                    <span className="metric-val">{singleResult.polarity > 0 ? `+${singleResult.polarity}` : singleResult.polarity}</span>
                    <div className="progress-bar-bg">
                      <div 
                        className={`progress-bar-fill ${singleResult.sentiment}`} 
                        style={{ width: `${Math.min(100, Math.max(10, (singleResult.polarity + 1) * 50))}%` }}
                      ></div>
                    </div>
                    <span className="metric-hint">-1.0 (Negative) to +1.0 (Positive)</span>
                  </div>

                  <div className="metric-box">
                    <span className="metric-label">Subjectivity</span>
                    <span className="metric-val">{singleResult.subjectivity}</span>
                    <div className="progress-bar-bg">
                      <div 
                        className="progress-bar-fill neutral" 
                        style={{ width: `${singleResult.subjectivity * 100}%` }}
                      ></div>
                    </div>
                    <span className="metric-hint">0.0 (Objective) to 1.0 (Subjective)</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {error && <div className="error-message">{error}</div>}

        {/* CSV RESULTS DASHBOARD SECTION */}
        {results && (
          <div className="results-container">
            {/* KPI STAT CARDS */}
            <div className="kpi-grid">
              <div className="kpi-card total">
                <div className="kpi-icon">📊</div>
                <div className="kpi-info">
                  <span className="kpi-title">Total Analyzed</span>
                  <span className="kpi-value">{totalCount}</span>
                  <span className="kpi-sub">Total CSV Rows</span>
                </div>
              </div>

              <div className="kpi-card positive">
                <div className="kpi-icon">😊</div>
                <div className="kpi-info">
                  <span className="kpi-title">Positive</span>
                  <span className="kpi-value">{positiveCount} <small>({posPct}%)</small></span>
                  <span className="kpi-sub">Favorable Sentiment</span>
                </div>
              </div>

              <div className="kpi-card neutral">
                <div className="kpi-icon">😐</div>
                <div className="kpi-info">
                  <span className="kpi-title">Neutral</span>
                  <span className="kpi-value">{neutralCount} <small>({neuPct}%)</small></span>
                  <span className="kpi-sub">Informational Text</span>
                </div>
              </div>

              <div className="kpi-card negative">
                <div className="kpi-icon">🙁</div>
                <div className="kpi-info">
                  <span className="kpi-title">Negative</span>
                  <span className="kpi-value">{negativeCount} <small>({negPct}%)</small></span>
                  <span className="kpi-sub">Critical / Unfavorable</span>
                </div>
              </div>

              <div className="kpi-card score">
                <div className="kpi-icon">📈</div>
                <div className="kpi-info">
                  <span className="kpi-title">Net Sentiment Index</span>
                  <span className="kpi-value">{netScore > 0 ? `+${netScore}` : netScore}</span>
                  <span className="kpi-sub">(Pos - Neg) Ratio</span>
                </div>
              </div>
            </div>

            {/* CHART VISUALIZATION */}
            <div className="chart-section">
              <div className="chart-container-box">
                <Bar data={chartData} options={chartOptions} />
              </div>
            </div>

            {/* DETAILED RESULTS TABLE WITH SEARCH & FILTER */}
            <div className="table-section">
              <div className="table-header-controls">
                <div>
                  <h3 className="section-title">Detailed Sentiment Breakdown</h3>
                  <p className="section-sub">Individual record classifications and NLP polarity scores</p>
                </div>
                
                <button className="export-btn" onClick={handleExportCSV}>
                  ⬇️ Export to CSV
                </button>
              </div>

              <div className="filter-bar">
                <div className="search-box">
                  <span className="search-icon">🔍</span>
                  <input
                    type="text"
                    placeholder="Search by text content or ID..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>

                <div className="filter-pills">
                  <button 
                    className={`pill ${sentimentFilter === 'all' ? 'active' : ''}`}
                    onClick={() => setSentimentFilter('all')}
                  >
                    All ({totalCount})
                  </button>
                  <button 
                    className={`pill positive ${sentimentFilter === 'positive' ? 'active' : ''}`}
                    onClick={() => setSentimentFilter('positive')}
                  >
                    Positive ({positiveCount})
                  </button>
                  <button 
                    className={`pill neutral ${sentimentFilter === 'neutral' ? 'active' : ''}`}
                    onClick={() => setSentimentFilter('neutral')}
                  >
                    Neutral ({neutralCount})
                  </button>
                  <button 
                    className={`pill negative ${sentimentFilter === 'negative' ? 'active' : ''}`}
                    onClick={() => setSentimentFilter('negative')}
                  >
                    Negative ({negativeCount})
                  </button>
                </div>
              </div>

              <div className="table-wrapper">
                {filteredResults.length === 0 ? (
                  <div className="no-results">No records match your search query or filter.</div>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Text Payload</th>
                        <th>Sentiment Category</th>
                        <th>Polarity Score</th>
                        <th>Timestamp</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredResults.map((result) => (
                        <tr key={result.id} className={`sentiment-row-${result.sentiment}`}>
                          <td className="cell-id">#{result.id}</td>
                          <td className="cell-text">{result.text}</td>
                          <td>
                            <span className={`sentiment-badge ${result.sentiment}`}>
                              {result.sentiment.toUpperCase()}
                            </span>
                          </td>
                          <td className="cell-polarity">
                            <span className={`polarity-tag ${result.sentiment}`}>
                              {result.polarity !== undefined ? (result.polarity > 0 ? `+${result.polarity}` : result.polarity) : 'N/A'}
                            </span>
                          </td>
                          <td className="cell-time">{result.timestamp}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Dashboard;

