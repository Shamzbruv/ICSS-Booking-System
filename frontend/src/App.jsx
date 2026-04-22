// src/App.jsx — Root routing
import { Routes, Route, Navigate } from 'react-router-dom';
import OnboardingWizard from './pages/OnboardingWizard/OnboardingWizard';
import ThemeSelector from './pages/ThemeSelector/ThemeSelector';
import EditorCanvas from './pages/Editor/EditorCanvas';
import ProvisioningWait from './pages/ProvisioningWait/ProvisioningWait';
import CustomThemeRequest from './pages/CustomThemeRequest/CustomThemeRequest';

import PublicBookingPage from './pages/PublicBookingPage/PublicBookingPage';

function App() {
  return (
    <Routes>
      <Route path="/"            element={<Navigate to="/onboarding" replace />} />
      <Route path="/onboarding"  element={<OnboardingWizard />} />
      <Route path="/themes"      element={<ThemeSelector />} />
      <Route path="/provisioning" element={<ProvisioningWait />} />
      <Route path="/editor"      element={<EditorCanvas />} />
      <Route path="/custom-theme" element={<CustomThemeRequest />} />
      <Route path="/:slug"       element={<PublicBookingPage />} />
    </Routes>
  );
}

export default App;
