import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ReviewPortal from './pages/ReviewPortal';
import LoopPortal from './pages/LoopPortal';
import Dashboard from './pages/Dashboard';
import IntegrationGuide from './pages/IntegrationGuide';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/portal/review/:patientId/:taskId" element={<ReviewPortal />} />
        <Route path="/portal/loop/:loopId" element={<LoopPortal />} />
        <Route path="/guide" element={<IntegrationGuide />} />
        <Route path="*" element={<div className="p-10">404 - Page Not Found</div>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
