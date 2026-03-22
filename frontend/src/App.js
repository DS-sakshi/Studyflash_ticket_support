import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { Toaster } from "@/components/ui/sonner";
import Sidebar from "@/components/Sidebar";
import LoginPage from "@/pages/LoginPage";
import DashboardPage from "@/pages/DashboardPage";
import TicketsPage from "@/pages/TicketsPage";
import TicketDetailPage from "@/pages/TicketDetailPage";
import TeamPage from "@/pages/TeamPage";

function AppLayout() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="dark min-h-screen bg-[hsl(220,18%,8%)] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[hsl(174,72%,45%)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <LoginPage />;

  return (
    <div className="dark min-h-screen bg-[hsl(220,18%,8%)] flex">
      <Sidebar />
      <main className="flex-1 p-6 overflow-auto min-h-screen" data-testid="main-content">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/tickets" element={<TicketsPage />} />
          <Route path="/tickets/:ticketId" element={<TicketDetailPage />} />
          <Route path="/team" element={<TeamPage />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppLayout />
        <Toaster position="bottom-right" theme="dark" />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
