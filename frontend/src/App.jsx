// src/App.jsx — Root routing
import { Routes, Route, Navigate } from 'react-router-dom';
import OnboardingWizard  from './pages/OnboardingWizard/OnboardingWizard';
import ThemeSelector     from './pages/ThemeSelector/ThemeSelector';
import EditorCanvas      from './pages/Editor/EditorCanvas';
import ProvisioningWait  from './pages/ProvisioningWait/ProvisioningWait';
import CustomThemeRequest from './pages/CustomThemeRequest/CustomThemeRequest';
import PublicBookingPage from './pages/PublicBookingPage/PublicBookingPage';
import PlatformConsole   from './pages/PlatformConsole/PlatformConsole';
import ForgotPassword    from './pages/Auth/ForgotPassword';
import ResetPassword     from './pages/Auth/ResetPassword';

function App() {
  return (
    <Routes>
      <Route path="/"             element={<Navigate to="/onboarding" replace />} />
      <Route path="/onboarding"   element={<OnboardingWizard />} />
      <Route path="/themes"       element={<ThemeSelector />} />
      <Route path="/provisioning" element={<ProvisioningWait />} />
      <Route path="/editor"       element={<EditorCanvas />} />
      <Route path="/custom-theme" element={<CustomThemeRequest />} />
      {/* Platform Owner Console — must be before /:slug wildcard */}
      <Route path="/platform"         element={<PlatformConsole />} />
      <Route path="/forgot-password"  element={<ForgotPassword />} />
      <Route path="/reset-password"   element={<ResetPassword />} />
      <Route path="/:slug"            element={<PublicBookingPage />} />
    </Routes>
  );
}

export default App;

