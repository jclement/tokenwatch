import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./auth";
import { StatsProvider } from "./data";
import { Spinner } from "./components/ui";
import { Layout } from "./Layout";
import { LoginPage } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { OverTime } from "./pages/OverTime";
import { ByModel } from "./pages/ByModel";
import { ByEngine } from "./pages/ByEngine";
import { Perspective } from "./pages/Perspective";
import { Confessional } from "./pages/Confessional";
import { NightOwl } from "./pages/NightOwl";
import { Streaks } from "./pages/Streaks";
import { HallOfFame } from "./pages/HallOfFame";
import { Environmental } from "./pages/Environmental";
import { GroupsPage } from "./pages/Groups";
import { GroupDetailPage } from "./pages/GroupDetail";
import { Settings } from "./pages/Settings";

export function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner className="!h-8 !w-8" />
      </div>
    );
  }

  if (!user) return <LoginPage />;

  return (
    <StatsProvider>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/over-time" element={<OverTime />} />
          <Route path="/by-model" element={<ByModel />} />
          <Route path="/by-engine" element={<ByEngine />} />
          <Route path="/perspective" element={<Perspective />} />
          <Route path="/confessional" element={<Confessional />} />
          <Route path="/night-owl" element={<NightOwl />} />
          <Route path="/streaks" element={<Streaks />} />
          <Route path="/hall-of-fame" element={<HallOfFame />} />
          <Route path="/environmental" element={<Environmental />} />
          <Route path="/groups" element={<GroupsPage />} />
          <Route path="/groups/:slug" element={<GroupDetailPage />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </StatsProvider>
  );
}
