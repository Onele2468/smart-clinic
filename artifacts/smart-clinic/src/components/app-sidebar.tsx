import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Users,
  CalendarClock,
  UserCheck,
  Settings,
  ClipboardList,
  LogOut,
  Activity,
  Bell,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/queue", label: "Live Queue", icon: ClipboardList },
  { href: "/patients", label: "Patients", icon: Users },
  { href: "/appointments", label: "Appointments", icon: CalendarClock },
  { href: "/staff", label: "Staff", icon: UserCheck },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { user, clinicMembership, logout } = useAuth();

  const clinicName = (clinicMembership as any)?.clinic?.name ?? "Your Clinic";
  const clinicCode = (clinicMembership as any)?.clinic?.code ?? "";
  const userRole = clinicMembership?.role ?? user?.role ?? "";

  return (
    <aside className="flex flex-col w-64 min-h-screen bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex-shrink-0">
      {/* Brand */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-sidebar-border">
        <div className="h-9 w-9 rounded-lg bg-sidebar-primary flex items-center justify-center flex-shrink-0">
          <Activity className="h-5 w-5 text-sidebar-primary-foreground" />
        </div>
        <div className="min-w-0">
          <p className="font-bold text-sm truncate leading-tight">{clinicName}</p>
          {clinicCode && (
            <p className="text-xs text-sidebar-foreground/50 font-mono">{clinicCode}</p>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = location === href || (href === "/dashboard" && location === "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
              )}
              data-testid={`nav-${label.toLowerCase().replace(" ", "-")}`}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="border-t border-sidebar-border px-3 py-4">
        <div className="flex items-center gap-3 px-3 py-2 mb-1">
          <div className="h-8 w-8 rounded-full bg-sidebar-accent flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-bold text-sidebar-accent-foreground">
              {user?.name?.charAt(0)?.toUpperCase() ?? "?"}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{user?.name}</p>
            <p className="text-xs text-sidebar-foreground/50 capitalize">{userRole.replace("_", " ")}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground transition-colors"
          data-testid="button-logout"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
