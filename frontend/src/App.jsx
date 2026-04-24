// src/App.jsx — Root routing with lazy loading for performance
import { Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import LoadingOverlay from './components/ui/LoadingOverlay';

const OnboardingWizard  = lazy(() => import('./pages/OnboardingWizard/OnboardingWizard'));
const ThemeSelector     = lazy(() => import('./pages/ThemeSelector/ThemeSelector'));
const EditorCanvas      = lazy(() => import('./pages/Editor/EditorCanvas'));
const ProvisioningWait  = lazy(() => import('./pages/ProvisioningWait/ProvisioningWait'));
const CustomThemeRequest = lazy(() => import('./pages/CustomThemeRequest/CustomThemeRequest'));
const PublicBookingPage = lazy(() => import('./pages/PublicBookingPage/PublicBookingPage'));
const PlatformConsole   = lazy(() => import('./pages/PlatformConsole/PlatformConsole'));
const ForgotPassword    = lazy(() => import('./pages/Auth/ForgotPassword'));
const ResetPassword     = lazy(() => import('./pages/Auth/ResetPassword'));

function App() {
  return (
    <Suspense fallback={<LoadingOverlay />}>
      <Routes>
        {/* / is the marketing homepage — served by Express static (public/index.html).
            If someone hits the SPA root in dev, redirect to onboarding. */}
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
    </Suspense>
  );
}

export default App;
