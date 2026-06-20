import React from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { CheckCircle, Edit3, Shield, ArrowLeft } from 'lucide-react';

export default function ReviewPortal() {
  const { patientId, taskId } = useParams();
  const navigate = useNavigate();
  const [isSaving, setIsSaving] = React.useState(false);
  const [taskData, setTaskData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchTask = async () => {
      try {
        const res = await fetch(`/api/tasks/${taskId}`);
        if (res.ok) {
          const data = await res.json();
          setTaskData(data);
        }
      } catch (err) {
        console.error("Failed to load task:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchTask();
  }, [taskId]);

  const handleApprove = async () => {
    setIsSaving(true);
    try {
      await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve_referral', taskId: taskId, patientId: patientId })
      });
      alert('Referral Approved and Saved to EMR!');
      navigate('/');
    } catch (e) {
      alert('Failed to connect to backend.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-gray-900">
      {/* Header */}
      <header className="bg-white shadow-sm border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/" className="text-gray-400 hover:text-gray-600 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-blue-700">Smart Triage Review</h1>
            <p className="text-sm text-gray-500">Patient: {patientId} | Task: {taskId}</p>
          </div>
          <div className="ml-4 px-3 py-1 bg-green-50 border border-green-200 text-green-700 text-xs rounded-full flex items-center gap-1 shadow-sm">
            <Shield className="w-3 h-3" />
            Privacy by Design: Local Processing
          </div>
        </div>
        <div className="flex space-x-3">
          <button className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100 flex items-center gap-2">
            <Edit3 className="w-4 h-4" />
            Edit
          </button>
          <button 
            onClick={handleApprove}
            disabled={isSaving}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2 shadow-sm disabled:opacity-50 transition-colors">
            <CheckCircle className="w-4 h-4" />
            {isSaving ? 'Saving...' : 'Approve & Save'}
          </button>
        </div>
      </header>

      {/* Main Content Side-by-Side */}
      <main className="flex-1 flex overflow-hidden p-6 gap-6">
        
        {/* Left: Original Document */}
        <div className="flex-1 bg-white border border-gray-200 rounded-lg shadow-sm flex flex-col">
          <div className="bg-gray-100 border-b px-4 py-3 font-semibold text-gray-700 rounded-t-lg">
            Original Document (Incoming Fax)
          </div>
          <div className="p-6 overflow-y-auto whitespace-pre-wrap text-sm text-gray-800 flex-1 font-mono bg-gray-50">
{loading ? "Loading fax..." : (taskData?.fax_text || "No document found.")}
          </div>
        </div>

        {/* Right: Extracted Structured Form */}
        <div className="flex-1 bg-white border border-gray-200 rounded-lg shadow-sm flex flex-col">
          <div className="bg-blue-50 border-b border-blue-100 px-4 py-3 font-semibold text-blue-800 rounded-t-lg flex justify-between items-center">
            <span>AI Extracted Data</span>
            <span className="text-xs bg-blue-200 text-blue-800 px-2 py-1 rounded-full">High Confidence</span>
          </div>
          <div className="p-6 overflow-y-auto flex-1 space-y-6">
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Patient Name</label>
                <div className="bg-gray-50 px-3 py-2 border rounded-md font-medium text-gray-900">
                  {loading ? "..." : taskData?.extraction?.patient_name}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Specialist</label>
                <div className="bg-gray-50 px-3 py-2 border border-blue-200 bg-blue-50/50 rounded-md font-medium text-gray-900 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                  {loading ? "..." : taskData?.extraction?.specialist}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Urgency</label>
                <div className="bg-red-50 px-3 py-2 border border-red-200 rounded-md font-bold text-red-700 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                  {loading ? "..." : taskData?.extraction?.urgency}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Clinical Reason for Referral / Diagnosis</label>
              <textarea 
                readOnly
                className="w-full bg-gray-50 px-3 py-2 border rounded-md text-gray-900 min-h-[100px] resize-none"
                value={loading ? "..." : taskData?.extraction?.diagnosis}
              />
            </div>

          </div>
        </div>

      </main>
    </div>
  );
}
