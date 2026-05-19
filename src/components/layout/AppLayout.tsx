import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  Bot,
  ChevronRight,
  Gauge,
  GitFork,
  LayoutDashboard,
  LogOut,
  MessageSquareText,
  Network,
} from "lucide-react";
import { CyberBackground } from "@/components/layout/CyberBackground";
import { Button } from "@/components/ui/button";
import { queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { clearAuthStorage, getStoredAuthUser, type StoredAuthUser } from "@/services/authStorage";

const navigation = [
  { to: "/chat", label: "Chat", icon: MessageSquareText },
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { to: "/knowledge-graph", label: "Knowledge Graph", icon: Network },
  { to: "/entities", label: "Entities", icon: Gauge },
  { to: "/relations", label: "Relations", icon: GitFork },
];

function formatGender(value: StoredAuthUser["gender"]) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  if (String(value) === "1") {
    return "Male";
  }
  if (String(value) === "2") {
    return "Female";
  }
  return String(value);
}

function UserProfileCard({ user, onSignOut, compact = false }: { user: StoredAuthUser | null; onSignOut: () => void; compact?: boolean }) {
  const displayName = user?.name || user?.username || "Signed in user";
  const username = user?.username;
  const initial = displayName.trim().charAt(0).toUpperCase() || "M";
  const gender = formatGender(user?.gender);

  return (
    <div className={cn("carbon-panel rounded-[18px] p-3", compact && "min-w-72")}>
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-gradient-to-br from-blue-700/55 to-neon-cyan/25 text-sm font-black text-foreground shadow-glow ring-1 ring-neon-cyan/35">
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-black uppercase tracking-wide text-foreground">{displayName}</p>
          {username ? <p className="truncate text-xs text-muted-foreground">@{username}</p> : null}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-[0.68rem] font-bold uppercase tracking-wide text-muted-foreground">
        {user?.role ? <span className="rounded border border-neon-cyan/25 bg-neon-cyan/10 px-2 py-1">{user.role}</span> : null}
        {user?.age !== undefined ? <span className="rounded border border-border bg-carbon-950/55 px-2 py-1">Age {user.age}</span> : null}
        {gender ? <span className="rounded border border-border bg-carbon-950/55 px-2 py-1">{gender}</span> : null}
      </div>
      <Button type="button" variant="ghost" className="mt-3 w-full justify-start" onClick={onSignOut}>
        <LogOut className="h-4 w-4" />
        Sign out
      </Button>
    </div>
  );
}

export function AppLayout() {
  const navigate = useNavigate();
  const user = getStoredAuthUser();

  function onSignOut() {
    clearAuthStorage();
    queryClient.clear();
    navigate("/login", { replace: true });
  }

  return (
    <div className="min-h-screen">
      <CyberBackground />
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-72 bg-carbon-950/78 p-4 shadow-showroom backdrop-blur-xl lg:block">
        <div className="absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-neon-cyan/25 to-transparent" />
        <div className="ai-light-sheen opacity-35" />
        <div className="flex h-full flex-col">
          <div className="relative mb-8 px-2 pt-1">
            <div className="mb-3 h-px w-20 bg-gradient-to-r from-blue-600 via-neon-cyan to-transparent" />
            <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-gradient-to-br from-blue-700/30 to-neon-cyan/15 shadow-glow ring-1 ring-neon-cyan/35">
              <Bot className="h-6 w-6 text-neon-cyan" />
            </div>
            <div>
              <p className="moto-heading text-lg">MotoAI</p>
              <p className="text-[0.68rem] font-bold uppercase tracking-[0.22em] text-muted-foreground">AI Control Center</p>
            </div>
            </div>
          </div>
          <nav className="relative space-y-1.5">
            {navigation.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    "group flex items-center gap-3 px-3 py-2.5 text-sm font-semibold text-muted-foreground transition duration-200",
                    "rounded-[14px] hover:bg-graphite-800/50 hover:text-foreground",
                    isActive &&
                      "active-nav-rail bg-gradient-to-r from-blue-700/20 via-neon-cyan/10 to-transparent text-foreground shadow-glow",
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <item.icon className={cn("h-4 w-4 transition", isActive ? "text-neon-cyan" : "text-neon-steel group-hover:text-neon-cyan")} />
                    <span className="flex-1">{item.label}</span>
                    <ChevronRight className={cn("h-3.5 w-3.5 transition", isActive ? "translate-x-0 text-neon-cyan opacity-100" : "-translate-x-1 text-muted-foreground opacity-0 group-hover:translate-x-0 group-hover:opacity-70")} />
                  </>
                )}
              </NavLink>
            ))}
          </nav>
          <div className="mt-auto">
            <UserProfileCard user={user} onSignOut={onSignOut} />
          </div>
        </div>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-10 bg-carbon-950/90 px-4 py-3 shadow-showroom backdrop-blur-xl lg:hidden">
          <div className="flex items-center justify-between">
            <div className="moto-heading flex items-center gap-2 text-sm">
              <Bot className="h-5 w-5 text-neon-cyan" />
              MotoAI
            </div>
          </div>
          <nav className="premium-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
            {navigation.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    "inline-flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-xs font-bold text-muted-foreground",
                    isActive && "bg-neon-cyan/10 text-foreground shadow-glow ring-1 ring-neon-cyan/25",
                  )
                }
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            ))}
            <UserProfileCard user={user} onSignOut={onSignOut} compact />
          </nav>
        </header>
        <main className="mx-auto min-h-screen w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
