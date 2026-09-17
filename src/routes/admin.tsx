import { createFileRoute, Navigate } from "@tanstack/react-router";
import {
  Activity,
  Box,
  Calendar,
  Key,
  Users,
  ShieldCheck,
  Fingerprint,
  FileText,
  ShieldAlert,
  LogOut,
} from "lucide-react";
import { useState } from "react";

import { AppShell, PageHeading } from "@/components/AppShell";
import { AnimatedSection } from "@/components/crob/AnimatedSection";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";

import {
  OverviewSection,
  BookingsSection,
  LogsSection,
  UsersSection,
  LockerStatusSection,
  KeyStatusSection,
  DailyBookingsSection,
} from "@/components/admin/AdminComponents";

export const Route = createFileRoute("/admin")({
  component: AdminDashboard,
});

const TABS = [
  { id: "overview", label: "Overview", icon: Activity },
  { id: "bookings", label: "Booking Requests", icon: Calendar },
  { id: "lockers", label: "Locker Status", icon: Box },
  { id: "members", label: "Member List", icon: Users },
  { id: "execom", label: "ExeCom Members", icon: ShieldCheck },
  { id: "admins", label: "Admins", icon: ShieldAlert },
  { id: "fingerprints", label: "Fingerprint Data", icon: Fingerprint },
  { id: "logs", label: "Member Logs", icon: FileText },
];

function AdminDashboard() {
  const { user, profile, role, loading, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");
  const [bookingFilter, setBookingFilter] = useState("All");

  function handleNavigate(tab: string, filter?: string) {
    setActiveTab(tab);
    if (filter) setBookingFilter(filter);
  }

  if (loading) {
    return (
      <div className="flex min-h-screen bg-background items-center justify-center flex-col gap-4">
        <div className="size-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <div className="text-muted-foreground font-display tracking-wider animate-pulse">
          Loading C-ROB Smart Key Locker...
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (role !== "admin") {
    if (role === "execom") return <Navigate to="/execom" replace />;
    return <Navigate to="/member" replace />;
  }

  const customSidebar = (
    <>
      <div className="px-5 mb-4 shrink-0">
        <h2 className="text-lg font-bold font-display text-primary/90 tracking-tight">
          Admin Dashboard
        </h2>
        <p className="text-xs text-muted-foreground mt-1 leading-snug">
          System administration and oversight.
        </p>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar pb-4">
        <nav className="space-y-1 px-3">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm font-medium whitespace-nowrap ${
                  isActive
                    ? "bg-primary/15 text-primary border-l-2 border-primary"
                    : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground border-l-2 border-transparent"
                }`}
              >
                <Icon className="size-4 shrink-0" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>
      <div className="mt-auto shrink-0  p-4 hidden md:block">
        <Card className="panel border-sidebar-border bg-card/60 glow-subtle">
          <CardContent className="p-3">
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="size-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                  <ShieldAlert className="size-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    {profile?.full_name || "Admin Member"}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                  <p className="text-[10px] uppercase font-bold text-primary tracking-wider mt-0.5">
                    Admin Account
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={signOut}
                className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive h-8 text-xs"
              >
                <LogOut className="size-3 mr-2" />
                Sign Out
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );

  return (
    <AppShell customSidebar={customSidebar} hideMobileNav={true}>
      <div className="flex gap-2 overflow-x-auto border-b border-border/50 pb-2 mb-6 md:hidden custom-scrollbar">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-colors text-xs font-medium whitespace-nowrap ${
                isActive
                  ? "bg-primary/15 text-primary border border-primary/30"
                  : "text-muted-foreground bg-card/40 border border-transparent"
              }`}
            >
              <Icon className="size-3 shrink-0" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <AnimatedSection className="flex flex-col gap-6">
        <main className="flex-1 min-w-0">
          {activeTab === "overview" && <OverviewSection onNavigate={handleNavigate} />}
          {activeTab === "bookings" && <BookingsSection defaultStatus={bookingFilter} />}
          {activeTab === "daily-bookings" && <DailyBookingsSection />}
          {activeTab === "members" && <UsersSection filterRole="member" title="Member List" />}
          {activeTab === "admins" && <UsersSection filterRole="admin" title="Admins" />}
          {activeTab === "execom" && <UsersSection filterRole="execom" title="ExeCom Members" />}
          {activeTab === "logs" && <LogsSection />}

          {activeTab === "lockers" && <LockerStatusSection />}

          {activeTab === "fingerprints" && (
            <Card className="panel border-dashed fade-up">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <div className="rounded-full bg-muted/20 p-4 mb-4">
                  <Fingerprint className="size-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold">No data available</h3>
                <p className="text-sm text-muted-foreground mt-2 max-w-md">
                  Fingerprint data has not been integrated yet.
                </p>
              </CardContent>
            </Card>
          )}
        </main>
      </AnimatedSection>
    </AppShell>
  );
}
