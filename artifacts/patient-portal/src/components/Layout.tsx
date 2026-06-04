import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import {
  Home,
  Calendar,
  Pill,
  FlaskConical,
  FileText,
  Receipt,
  User,
  LogOut,
  Heart,
  Menu,
  X,
  CreditCard,
  Activity,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  useGetPatientPortalMe,
  getGetPatientPortalMeQueryKey,
  useGetPatientPortalQueueStatus,
  getGetPatientPortalQueueStatusQueryKey,
} from "@workspace/api-client-react";

const BASE_NAV = [
  { href: "/", label: "Home", icon: Home },
  { href: "/queue", label: "Live Queue", icon: Activity },
  { href: "/appointments", label: "Appointments", icon: Calendar },
  { href: "/prescriptions", label: "Prescriptions", icon: Pill },
  { href: "/lab-results", label: "Lab Results", icon: FlaskConical },
  { href: "/medical-records", label: "Medical Records", icon: FileText },
  { href: "/invoices", label: "Invoices", icon: Receipt, billing: true },
  { href: "/clinic-card", label: "Clinic Card", icon: CreditCard },
  { href: "/profile", label: "Profile", icon: User },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const { data: profile } = useGetPatientPortalMe({
    query: { queryKey: getGetPatientPortalMeQueryKey(), staleTime: 300_000, enabled: !!user },
  });
  const { data: queueStatus } = useGetPatientPortalQueueStatus({
    query: { queryKey: getGetPatientPortalQueueStatusQueryKey(), refetchInterval: 30_000, enabled: !!user },
  });
  const isGovClinic = profile?.clinic?.clinicType === "government";
  const navItems = BASE_NAV.filter(item => !(item.billing && isGovClinic));
  const inQueue = queueStatus?.inQueue && queueStatus.status && queueStatus.status !== "completed" && queueStatus.status !== "skipped";

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-sidebar border-r border-sidebar-border fixed inset-y-0 z-20">
        <div className="flex items-center gap-2 px-6 py-5 border-b border-sidebar-border">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Heart className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <p className="font-semibold text-sm text-sidebar-foreground leading-none">Patient Portal</p>
            <p className="text-xs text-muted-foreground mt-0.5">Smart Clinic</p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto" data-testid="nav-sidebar">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = location === href;
            const showQueueDot = href === "/queue" && inQueue;
            return (
              <Link
                key={href}
                href={href}
                data-testid={`nav-link-${label.toLowerCase().replace(/ /g, "-")}`}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent"
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="flex-1">{label}</span>
                {showQueueDot && (
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse shrink-0" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="px-3 py-4 border-t border-sidebar-border">
          <div className="flex items-center gap-3 px-3 py-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
              <span className="text-xs font-semibold text-primary">
                {user?.name?.charAt(0)?.toUpperCase() ?? "P"}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">{user?.name ?? "Patient"}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email ?? ""}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-muted-foreground hover:text-destructive"
            onClick={logout}
            data-testid="button-logout"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </Button>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="md:hidden fixed top-0 inset-x-0 z-30 bg-background border-b border-border flex items-center justify-between px-4 h-14">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center">
            <Heart className="w-3.5 h-3.5 text-primary-foreground" />
          </div>
          <span className="font-semibold text-sm">Patient Portal</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setMobileOpen(!mobileOpen)}
          data-testid="button-mobile-menu"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </Button>
      </header>

      {/* Mobile Nav Drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-20 bg-background/80 backdrop-blur-sm" onClick={() => setMobileOpen(false)}>
          <nav className="fixed top-14 left-0 bottom-0 w-64 bg-sidebar border-r border-sidebar-border p-3 space-y-0.5 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {navItems.map(({ href, label, icon: Icon }) => {
              const active = location === href;
              const showQueueDot = href === "/queue" && inQueue;
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    active ? "bg-primary text-primary-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent"
                  )}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="flex-1">{label}</span>
                  {showQueueDot && (
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse shrink-0" />
                  )}
                </Link>
              );
            })}
            <div className="pt-2 border-t border-sidebar-border mt-2">
              <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-muted-foreground" onClick={logout}>
                <LogOut className="w-4 h-4" />
                Sign out
              </Button>
            </div>
          </nav>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 md:ml-64 min-h-screen">
        <div className="md:hidden h-14" />
        {children}
      </main>
    </div>
  );
}
