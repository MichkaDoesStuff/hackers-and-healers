import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { AlertCircle, CheckCircle, Shield, ArrowLeft } from 'lucide-react';

export default function LoopPortal() {
  const { loopId } = useParams();
  const navigate = useNavigate();
  const [isSaving, setIsSaving] = useState(false);

  // Mocking the loop detail fetch based on the ID
  const mockLoopData = {
    loopId: loopId,
    patientName: 'James Wallace',
    type: 'abnormal_lab',
    severity: 'CRITICAL',
    summary: 'Unreviewed Potassium result — 6.2 mEq/L (CRITICAL HIGH)',
    daysOpen: 21,
    context: {
      test: 'Potassium [Moles/volume] in Serum or Plasma',
      value: '6.2 mEq/L',
      normalRange: '3.5 - 5.0 mEq/L',
      note: 'Value critically elevated. Patient on spironolactone + ramipril.',
      activeProblems: ['Essential hypertension', 'Chronic kidney disease stage 2']
    }
  };

  const handleAction = async () => {
    setIsSaving(true);
    try {
      await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'close_loop', id: loopId })
      });
      alert('Action completed and saved to EHR!');
      navigate('/');
    } catch (e) {
      alert('Failed to connect to backend.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-gray-900">
      <header className="bg-white shadow-sm border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/" className="text-gray-400 hover:text-gray-600 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-red-700 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              Critical Loop Review
            </h1>
            <p className="text-sm text-gray-500">Patient: {mockLoopData.patientName} | Loop: {loopId}</p>
          </div>
          <div className="ml-4 px-3 py-1 bg-green-50 border border-green-200 text-green-700 text-xs rounded-full flex items-center gap-1 shadow-sm">
            <Shield className="w-3 h-3" />
            Privacy by Design: Local Processing
          </div>
        </div>
        <div className="flex space-x-3">
          <button 
            onClick={handleAction}
            disabled={isSaving}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 flex items-center gap-2 shadow-sm disabled:opacity-50 transition-colors">
            <CheckCircle className="w-4 h-4" />
            {isSaving ? 'Saving...' : 'Acknowledge & Schedule Recall'}
          </button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden p-6 justify-center">
        <div className="w-full max-w-3xl bg-white border border-gray-200 rounded-lg shadow-sm flex flex-col">
          <div className="bg-red-50 border-b border-red-100 px-4 py-3 font-semibold text-red-800 rounded-t-lg">
            Loop Details: {mockLoopData.summary}
          </div>
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Test Name</label>
                <div className="bg-gray-50 px-3 py-2 border rounded-md font-medium text-gray-900">{mockLoopData.context.test}</div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Days Unreviewed</label>
                <div className="bg-red-100 px-3 py-2 border border-red-200 rounded-md font-bold text-red-800">{mockLoopData.daysOpen} Days</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Reported Value</label>
                <div className="bg-gray-50 px-3 py-2 border border-red-300 text-red-700 font-bold rounded-md flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                  {mockLoopData.context.value}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Normal Range</label>
                <div className="bg-gray-50 px-3 py-2 border rounded-md text-gray-600">{mockLoopData.context.normalRange}</div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Clinical Note / Context</label>
              <div className="bg-yellow-50 px-4 py-3 border border-yellow-200 rounded-md text-yellow-800 text-sm">
                {mockLoopData.context.note}
              </div>
            </div>
            
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Active Problems</label>
              <ul className="list-disc list-inside bg-gray-50 border rounded-md p-3 text-sm text-gray-700">
                {mockLoopData.context.activeProblems.map((p, idx) => (
                  <li key={idx}>{p}</li>
                ))}
              </ul>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}
