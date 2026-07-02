import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import { NotificationProvider } from "./context/NotificationContext";
import { Header } from "./components/Header";
import { RequireAuth } from "./components/RequireAuth";
import { Home } from "./pages/Home";
import { Arena } from "./pages/Arena";
import { SampleDetail } from "./pages/SampleDetail";
import { Leaderboard } from "./pages/Leaderboard";
import { AuthPage } from "./pages/AuthPage";
import { UploadSample } from "./pages/UploadSample";
import { CertificatePage } from "./pages/CertificatePage";
import { Profile } from "./pages/Profile";
import { Dashboard } from "./pages/Dashboard";
import { Vault } from "./pages/Vault";
import { NotFound } from "./pages/NotFound";

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <NotificationProvider>
            <div className="min-h-screen bg-background">
              <Header />
              <main>
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/arena" element={<Arena />} />
                  <Route path="/sample/new" element={<RequireAuth><UploadSample /></RequireAuth>} />
                  <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
                  <Route path="/vault" element={<RequireAuth><Vault /></RequireAuth>} />
                  <Route path="/sample/:id" element={<SampleDetail />} />
                  <Route path="/leaderboard" element={<Leaderboard />} />
                  <Route path="/certificate/:code" element={<RequireAuth><CertificatePage /></RequireAuth>} />
                  <Route path="/u/:username" element={<Profile />} />
                  <Route path="/auth" element={<AuthPage />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </main>
            </div>
          </NotificationProvider>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
