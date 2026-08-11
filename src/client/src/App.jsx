import { useState, useEffect } from 'react';
import { fetchHealthStatus, fetchUnknownRoute } from './services/api';
import './App.css';

export default function App() {
  const [healthData, setHealthData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [testResult, setTestResult] = useState(null);

  const loadHealth = async () => {
    setLoading(true);
    const response = await fetchHealthStatus();
    setHealthData(response);
    setLoading(false);
  };

  useEffect(() => {
    loadHealth();
  }, []);

  const handleTest404 = async () => {
    const result = await fetchUnknownRoute();
    setTestResult(result);
  };

  return (
    <div className="container">
      <header className="header">
        <h1 className="title">QFlow Platform</h1>
        <p className="subtitle">Phase 01 — Foundation & Health Communication Test</p>
      </header>

      <main>
        <section className="card">
          <div className="info-row">
            <span className="info-label">API Health</span>
            <span className="info-value">
              {loading ? (
                'Checking...'
              ) : healthData?.ok ? (
                <span className="status-badge status-connected">RUNNING</span>
              ) : (
                <span className="status-badge status-disconnected">OFFLINE</span>
              )}
            </span>
          </div>

          <div className="info-row">
            <span className="info-label">Database Connection</span>
            <span className="info-value">
              {loading ? (
                'Checking...'
              ) : healthData?.data?.database === 'connected' ? (
                <span className="status-badge status-connected">CONNECTED</span>
              ) : (
                <span className="status-badge status-warning">
                  {healthData?.data?.database || 'DISCONNECTED'}
                </span>
              )}
            </span>
          </div>

          <div className="info-row">
            <span className="info-label">Backend Message</span>
            <span className="info-value">
              {healthData?.data?.message || healthData?.error || 'N/A'}
            </span>
          </div>

          <div className="info-row">
            <span className="info-label">Timestamp</span>
            <span className="info-value">
              {healthData?.data?.timestamp ? new Date(healthData.data.timestamp).toLocaleTimeString() : 'N/A'}
            </span>
          </div>
        </section>

        <div className="actions">
          <button className="btn btn-primary" onClick={loadHealth} disabled={loading}>
            {loading ? 'Refreshing...' : 'Re-test Health API'}
          </button>
          <button className="btn btn-secondary" onClick={handleTest404}>
            Test 404 Route
          </button>
        </div>

        {testResult && (
          <div className="test-output">
            <strong>404 Route Test Response (HTTP {testResult.status}):</strong>
            <br />
            {JSON.stringify(testResult.data || testResult.error, null, 2)}
          </div>
        )}
      </main>
    </div>
  );
}
