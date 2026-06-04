import React from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useClinicModules } from "@/hooks/useClinicModules";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  Users,
  Calendar,
  Activity,
  Settings,
  LogOut,
  ListTodo,
  UserCog,
  ClipboardList,
  Bell,
  Pill,
  FlaskConical,
  Receipt,
  Package,
  Truck,
  Wifi,
  BarChart2,
} from "lucide-react";
import { useListNotifications, getListNotificationsQueryKey } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";

type NavItem = {
  name: string;
  href: string;
  icon: React.ElementType;
  roles: string[];
  billingRequired?: boolean;
  /** Hide this item for these clinic types. */
  clinicTypeExclude?: string[];
};

const navItems: NavItem[] = [
  { name: "Dashboard",        href: "/dashboard",         icon: LayoutDashboard, roles: ["clinic_admin", "doctor", "nurse", "receptionist", "cashier", "pharmacist", "lab_technician"] },
  { name: "Live Queue",       href: "/queue",             icon: ListTodo,        roles: ["clinic_admin", "doctor", "nurse", "receptionist", "cashier", "pharmacist", "lab_technician"] },
  { name: "Patients",         href: "/patients",          icon: Users,           roles: ["clinic_admin", "doctor", "nurse", "receptionist", "cashier"] },
  { name: "Appointments",     href: "/appointments",      icon: Calendar,        roles: ["clinic_admin", "doctor", "receptionist"] },
  { name: "Billing",          href: "/billing",           icon: Receipt,         roles: ["clinic_admin", "cashier", "receptionist"], billingRequired: true, clinicTypeExclude: ["government"] },
  { name: "Pharmacy",         href: "/pharmacy",          icon: Pill,            roles: ["clinic_admin", "pharmacist", "nurse"],                                                        clinicTypeExclude: ["government"] },
  { name: "Laboratory",       href: "/lab",               icon: FlaskConical,    roles: ["clinic_admin", "lab_technician", "doctor"],                                                   clinicTypeExclude: ["government"] },
  { name: "Inventory",        href: "/inventory",         icon: Package,         roles: ["clinic_admin", "pharmacist"],                                                                 clinicTypeExclude: ["government"] },
  { name: "Suppliers",        href: "/suppliers",         icon: Truck,           roles: ["clinic_admin", "pharmacist"],                                                                 clinicTypeExclude: ["government"] },
  { name: "Staff Availability", href: "/staff-availability", icon: Wifi,         roles: ["clinic_admin", "doctor", "nurse", "receptionist"] },
  { name: "Staff",            href: "/staff",             icon: UserCog,         roles: ["clinic_admin"] },
  { name: "Analytics",        href: "/analytics",         icon: BarChart2,       roles: ["clinic_admin"] },
  { name: "Activity Logs",    href: "/activity",          icon: ClipboardList,   roles: ["clinic_admin"] },
  { name: "Settings",         href: "/settings",          icon: Settings,        roles: ["clinic_admin"] },
];

const roleLabel: Record<string, string> = {
  clinic_admin: "Clinic Admin",
  doctor: "Doctor",
  nurse: "Nurse",
  receptionist: "Receptionist",
  pharmacist: "Pharmacist",
  lab_technician: "Lab Technician",
  cashier: "Cashier",
  patient: "Patient",
};

export function AppSidebar() {
  const { user, clinicMembership, logout } = useAuth();
  const modules = useClinicModules();
  const [location] = useLocation();
  const role = clinicMembership?.role ?? "";
  const clinicId = clinicMembership?.clinicId ?? "";

  const { data: notifications } = useListNotifications(clinicId, {
    query: {
      enabled: !!clinicId,
      queryKey: getListNotificationsQueryKey(clinicId),
      refetchInterval: 30000,
    }
  });
  const unreadCount = notifications?.filter(n => !n.isRead).length ?? 0;

  const visibleNav = navItems.filter(item => {
    if (!item.roles.includes(role)) return false;
    if (item.billingRequired && !modules.hasBilling) return false;
    if (item.clinicTypeExclude?.includes(modules.clinicType)) return false;
    return true;
  });

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border pb-4 pt-6 px-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-sidebar-primary flex items-center justify-center shrink-0">
            <Activity className="h-5 w-5 text-sidebar-primary-foreground" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-bold text-sm tracking-tight truncate">
              {clinicMembership?.clinicName || "Smart Clinic"}
            </span>
            <span className="text-[10px] text-sidebar-foreground/60 font-mono">
              {clinicMembership?.clinicCode}
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleNav.map((item) => {
                const isActive = location === item.href || (item.href !== "/dashboard" && location.startsWith(item.href));
                return (
                  <SidebarMenuItem key={item.name}>
                    <SidebarMenuButton asChild isActive={isActive} tooltip={item.name}>
                      <Link href={item.href}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.name}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Notifications — always visible */}
        <SidebarGroup>
          <SidebarGroupLabel>Alerts</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/notifications"} tooltip="Notifications">
                  <Link href="/notifications">
                    <Bell className="h-4 w-4" />
                    <span>Notifications</span>
                    {unreadCount > 0 && (
                      <Badge className="ml-auto h-5 min-w-5 shrink-0 items-center justify-center rounded-full p-0 px-1 text-[10px]">
                        {unreadCount}
                      </Badge>
                    )}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm shrink-0">
            {user?.name?.charAt(0)?.toUpperCase()}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-semibold truncate">{user?.name}</span>
            <span className="text-xs text-sidebar-foreground/60">{roleLabel[role] ?? role}</span>
          </div>
        </div>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={logout} className="text-destructive hover:text-destructive hover:bg-destructive/10">
              <LogOut className="h-4 w-4" />
              <span>Sign out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
