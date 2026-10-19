import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Upload, Download, AlertCircle, FileText } from 'lucide-react';

const BACKEND_URL = 'http://localhost:5000/api/fir';

export default function App() {
  const [activeTab, setActiveTab] = useState('text');
  const [firText, setFirText] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [history, setHistory] = useState([]);

  const fetchHistory = async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/history`);
      setHistory(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleAnalyze = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);

    try {
      let res;
      if (activeTab === 'text') {
        if (firText.trim().length < 20) {
          setError('Please enter at least 20 characters.');
          setLoading(false);
          return;
        }
        res = await axios.post(`${BACKEND_URL}/analyze-text`, { text: firText, num_sentences: 2 });
      } else {
        if (!selectedFile) {
          setError('Please select an image file to upload.');
          setLoading(false);
          return;
        }
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('num_sentences', 2);
        res = await axios.post(`${BACKEND_URL}/analyze-image`, formData);
      }

      setResult(res.data);
      fetchHistory();
    } catch (err) {
      setError(err.response?.data?.error || 'Analysis failed. Please check backend connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = (caseId) => {
    window.open(`${BACKEND_URL}/download/${caseId}`, '_blank');
  };

  const formatDate = (val) => {
    if (!val) return 'N/A';
    const parsed = new Date(val);
    return isNaN(parsed.getTime()) ? val : parsed.toLocaleDateString();
  };

  return (
    <div style={{ fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', backgroundColor: '#ffffff', minHeight: '100vh', color: '#000000', padding: '32px 24px' }}>
      
      {/* Clean Header */}
      <header style={{ maxWidth: '1200px', margin: '0 auto 36px auto', borderBottom: '1px solid #e4e4e7', paddingBottom: '20px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '800', margin: 0, letterSpacing: '-0.02em', color: '#000000' }}>
          FIR Analysis & Investigation Portal
        </h1>
        <p style={{ margin: '6px 0 0 0', color: '#71717a', fontSize: '14px' }}>
          Incident summarization, section prediction, and evidence extraction
        </p>
      </header>

      {/* Main Content */}
      <main style={{ maxWidth: '1200px', margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1.15fr', gap: '32px' }}>
        
        {/* Left Column: Input Form */}
        <section style={{ backgroundColor: '#ffffff', borderRadius: '8px', padding: '24px', border: '1px solid #e4e4e7' }}>
          
          {/* Tabs */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', backgroundColor: '#f4f4f5', borderRadius: '6px', padding: '4px', marginBottom: '20px' }}>
            <button
              type="button"
              onClick={() => setActiveTab('text')}
              style={{ padding: '9px 12px', fontSize: '13px', fontWeight: '600', borderRadius: '4px', border: 'none', cursor: 'pointer', backgroundColor: activeTab === 'text' ? '#000000' : 'transparent', color: activeTab === 'text' ? '#ffffff' : '#71717a', transition: 'all 0.15s ease' }}>
              Text Input
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('image')}
              style={{ padding: '9px 12px', fontSize: '13px', fontWeight: '600', borderRadius: '4px', border: 'none', cursor: 'pointer', backgroundColor: activeTab === 'image' ? '#000000' : 'transparent', color: activeTab === 'image' ? '#ffffff' : '#71717a', transition: 'all 0.15s ease' }}>
              Upload Scanned Image
            </button>
          </div>

          <form onSubmit={handleAnalyze}>
            {activeTab === 'text' ? (
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', fontWeight: '600', color: '#000000' }}>
                  FIR Complaint Text
                </label>
                <textarea
                  rows="12"
                  placeholder="Paste or type FIR complaint narrative here..."
                  value={firText}
                  onChange={(e) => setFirText(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#ffffff', border: '1px solid #d4d4d8', borderRadius: '6px', padding: '14px', color: '#000000', fontSize: '13px', lineHeight: '1.6', resize: 'vertical', outline: 'none' }}
                />
              </div>
            ) : (
              <div style={{ border: '1px dashed #d4d4d8', borderRadius: '6px', padding: '48px 24px', textAlign: 'center', backgroundColor: '#fafafa' }}>
                <Upload size={28} color="#000000" style={{ margin: '0 auto 12px auto' }} />
                <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#000000', fontWeight: '500' }}>
                  Upload scanned FIR document (JPG, PNG)
                </p>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setSelectedFile(e.target.files[0])}
                  style={{ fontSize: '12px', color: '#71717a' }}
                />
              </div>
            )}

            {error && (
              <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '12px', borderRadius: '6px', marginTop: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                <AlertCircle size={16} /> {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{ width: '100%', marginTop: '20px', padding: '12px', backgroundColor: loading ? '#71717a' : '#000000', color: '#ffffff', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: '600', cursor: loading ? 'not-allowed' : 'pointer' }}>
              {loading ? 'Analyzing...' : 'Analyze FIR'}
            </button>
          </form>
        </section>

        {/* Right Column: Results Panel */}
        <section>
          {result ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              
              {/* Reference Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff', padding: '14px 18px', border: '1px solid #e4e4e7', borderRadius: '8px' }}>
                <div>
                  <span style={{ fontSize: '11px', color: '#71717a', fontWeight: '600', textTransform: 'uppercase' }}>Case ID</span>
                  <div style={{ fontSize: '15px', fontWeight: '700', color: '#000000', fontFamily: 'monospace' }}>{result.id}</div>
                </div>
                <button
                  onClick={() => handleDownload(result.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#000000', color: '#ffffff', border: 'none', padding: '8px 14px', borderRadius: '4px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
                  <Download size={14} /> Download Report
                </button>
              </div>

              {/* Summary */}
              <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', padding: '18px', border: '1px solid #e4e4e7' }}>
                <h3 style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 10px 0', color: '#71717a' }}>
                  Summary
                </h3>
                <p style={{ margin: 0, fontSize: '14px', lineHeight: '1.6', color: '#000000', backgroundColor: '#f8fafc', padding: '14px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                  "{result.summary}"
                </p>
              </div>

              {/* BNS Section */}
              <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', padding: '18px', border: '1px solid #e4e4e7' }}>
                <h3 style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 10px 0', color: '#71717a' }}>
                  Applicable BNS Section
                </h3>
                <div style={{ backgroundColor: '#f8fafc', padding: '14px 18px', borderRadius: '6px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '17px', fontWeight: '700', color: '#000000' }}>{result.predicted_bns_section}</div>
                    <div style={{ fontSize: '12px', color: '#71717a', marginTop: '2px' }}>Predicted primary offense</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '11px', color: '#71717a', fontWeight: '600', textTransform: 'uppercase' }}>Confidence</div>
                    <div style={{ fontSize: '18px', fontWeight: '700', color: '#000000' }}>{result.confidence_score}%</div>
                  </div>
                </div>
              </div>

              {/* Key Details */}
              <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', padding: '18px', border: '1px solid #e4e4e7' }}>
                <h3 style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 12px 0', color: '#71717a' }}>
                  Extracted Details
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '13px' }}>
                  <div style={{ backgroundColor: '#f8fafc', padding: '10px 12px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                    <div style={{ color: '#71717a', fontWeight: '600', fontSize: '11px' }}>Date</div>
                    <div style={{ color: '#000000', fontWeight: '500', marginTop: '2px' }}>{result.key_incident_details?.dates_mentioned?.join(', ') || 'Not specified'}</div>
                  </div>
                  <div style={{ backgroundColor: '#f8fafc', padding: '10px 12px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                    <div style={{ color: '#71717a', fontWeight: '600', fontSize: '11px' }}>Time</div>
                    <div style={{ color: '#000000', fontWeight: '500', marginTop: '2px' }}>{result.key_incident_details?.times_mentioned?.join(', ') || 'Not specified'}</div>
                  </div>
                  <div style={{ backgroundColor: '#f8fafc', padding: '10px 12px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                    <div style={{ color: '#71717a', fontWeight: '600', fontSize: '11px' }}>Monetary Loss</div>
                    <div style={{ color: '#000000', fontWeight: '500', marginTop: '2px' }}>{result.key_incident_details?.monetary_loss?.join(', ') || 'None reported'}</div>
                  </div>
                  <div style={{ backgroundColor: '#f8fafc', padding: '10px 12px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                    <div style={{ color: '#71717a', fontWeight: '600', fontSize: '11px' }}>Weapons / Implements</div>
                    <div style={{ color: '#000000', fontWeight: '500', marginTop: '2px' }}>{result.key_incident_details?.weapons_detected?.join(', ') || 'None reported'}</div>
                  </div>
                </div>
              </div>

            </div>
          ) : (
            <div style={{ height: '100%', minHeight: '380px', border: '1px dashed #d4d4d8', borderRadius: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#71717a', backgroundColor: '#fafafa' }}>
              <FileText size={32} style={{ marginBottom: '10px', opacity: 0.4, color: '#000000' }} />
              <p style={{ margin: 0, fontSize: '13px' }}>Submit an FIR to view the generated summary and prediction.</p>
            </div>
          )}
        </section>
      </main>

      {/* Case History Table */}
      {history.length > 0 && (
        <section style={{ maxWidth: '1200px', margin: '40px auto 0 auto', backgroundColor: '#ffffff', borderRadius: '8px', padding: '24px', border: '1px solid #e4e4e7' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '13px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0, color: '#000000' }}>
              Case History
            </h3>
            <span style={{ fontSize: '12px', color: '#71717a' }}>{history.length} cases</span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #000000', color: '#000000', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                <th style={{ padding: '10px' }}>Case ID</th>
                <th style={{ padding: '10px' }}>Date</th>
                <th style={{ padding: '10px' }}>Input Type</th>
                <th style={{ padding: '10px' }}>BNS Section</th>
                <th style={{ padding: '10px' }}>Confidence</th>
                <th style={{ padding: '10px', textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {history.map((row) => (
                <tr key={row.id} style={{ borderBottom: '1px solid #e4e4e7' }}>
                  <td style={{ padding: '12px 10px', fontFamily: 'monospace', color: '#000000', fontWeight: '600' }}>{row.id}</td>
                  <td style={{ padding: '12px 10px', color: '#52525b' }}>{formatDate(row.created_at || row.timestamp)}</td>
                  <td style={{ padding: '12px 10px', color: '#52525b' }}>{row.input_type}</td>
                  <td style={{ padding: '12px 10px', fontWeight: '600', color: '#000000' }}>{row.bns_section || row.predicted_bns_section || 'N/A'}</td>
                  <td style={{ padding: '12px 10px', color: '#000000' }}>{row.confidence_score}%</td>
                  <td style={{ padding: '12px 10px', textAlign: 'right' }}>
                    <button
                      onClick={() => handleDownload(row.id)}
                      style={{ background: '#ffffff', border: '1px solid #000000', color: '#000000', borderRadius: '4px', padding: '4px 10px', fontSize: '11px', fontWeight: '600', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <Download size={12} /> Report
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}