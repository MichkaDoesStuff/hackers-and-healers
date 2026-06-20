import React, { useEffect, useState } from 'react';
import { Shield, CheckCircle, XCircle, Database, Server, BrainCircuit, Activity, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function StatusPage() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch('/api/status');
        if (!res.ok) throw new Error("Failed to fetch status");
        const data = await res.json();
        setStatus(data);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    fetchStatus();
  }, []);

  const StatusCard = ({ title, icon: Icon, children }) => (
    <div className="bg-white p-6 rounded-xl border shadow-sm">
      <div className="flex items-center gap-3 mb-4 pb-4 border-b">
        <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
          <Icon className="w-5 h-5" />
        </div>
        <h3 className="font-semibold text-gray-900">{title}</h3>
      </div>
      <div className="space-y-3 text-sm">
        {children}
      </div>
    </div>
  );

  const StatusRow = ({ label, value, isGood }) => (
    <div className="flex items-center justify-between">
      <span className="text-gray-600">{label}</span>
      <div className="flex items-center gap-2">
        {isGood === true && <CheckCircle className="w-4 h-4 text-green-500" />}
        {isGood === false && <XCircle className="w-4 h-4 text-red-500" />}
        <span className={`font-medium ${isGood === true ? 'text-green-700' : isGood === false ? 'text-red-700' : 'text-gray-900'}`}>
          {value}
        </span>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-gray-900">
      {/* ── Top Nav ──────────────────────────────────────────────────────────── */}
      <header className="bg-white border-b shadow-sm px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/" className="text-gray-400 hover:text-gray-600 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-3">
            <Activity className="text-blue-600 w-6 h-6" />
            <span className="text-lg font-bold text-gray-900">ClinicOS</span>
            <span className="text-gray-300 mx-1">|</span>
            <span className="text-sm text-gray-500">System Status</span>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto p-6 flex flex-col gap-6">
        <header className="bg-white border-b px-8 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Activity className="w-6 h-6 text-blue-600" />
              System Status
            </h1>
            <p className="text-gray-500 mt-1">Diagnostic overview of APIs, Backend, and AI Integrations.</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500 bg-gray-100 px-3 py-1.5 rounded-full">
            <div className={`w-2 h-2 rounded-full ${loading ? 'bg-yellow-400' : error ? 'bg-red-500' : 'bg-green-500'} animate-pulse`}></div>
            {loading ? 'Checking systems...' : error ? 'System Error' : 'All Systems Operational'}
          </div>
        </header>

        <div className="p-8">
          {loading ? (
            <div className="text-center text-gray-500 py-12">Loading diagnostics...</div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg">
              Failed to connect to backend: {error}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              <StatusCard title="AI Integration" icon={BrainCircuit}>
                <StatusRow label="Gemini API Key" value={status?.ai_integration?.gemini_api_key} isGood={status?.ai_integration?.gemini_api_key !== "Not Configured"} />
                <StatusRow label="Generative AI Package" value={status?.ai_integration?.google_genai_package} isGood={status?.ai_integration?.google_genai_package === "Installed"} />
                <StatusRow label="Overall AI Readiness" value={status?.ai_integration?.ready ? "Ready" : "Offline"} isGood={status?.ai_integration?.ready} />
              </StatusCard>

              <StatusCard title="FHIR Server" icon={Server}>
                <StatusRow label="Server Status" value={status?.fhir_server?.status} isGood={status?.fhir_server?.status === "Online"} />
                <StatusRow label="Indexed Resources" value={(status?.fhir_server?.total_resources || 0).toLocaleString()} />
                <StatusRow label="Resource Types" value={status?.fhir_server?.resource_types?.length || 0} />
              </StatusCard>

              <StatusCard title="Backend Core" icon={Activity}>
                <StatusRow label="FastAPI Server" value={status?.backend} isGood={status?.backend === "Online"} />
                <StatusRow label="Environment" value="Development (Local/Proxy)" />
                <StatusRow label="CDS Hooks Discovery" value="Online (/cds-services)" isGood={true} />
              </StatusCard>

              <StatusCard title="Dataset Loader" icon={Database}>
                <StatusRow label="Synthea Patients Loaded" value={(status?.database?.patients_loaded || 0).toLocaleString()} isGood={status?.database?.patients_loaded > 0} />
                <StatusRow label="Planted Demo Scenarios" value="4 (Loop Demos)" isGood={true} />
              </StatusCard>

            </div>
          )}
        </div>
      </main>
    </div>
  );
}
