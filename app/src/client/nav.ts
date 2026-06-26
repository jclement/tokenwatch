// Sidebar navigation — personal tabs mirror the Swift app, plus social + settings.
export interface NavItem {
  to: string;
  label: string;
  icon: string;
  group: "personal" | "social";
}

export const NAV: NavItem[] = [
  { to: "/", label: "Dashboard", icon: "📊", group: "personal" },
  { to: "/over-time", label: "Over Time", icon: "📈", group: "personal" },
  { to: "/by-model", label: "By Model", icon: "🧠", group: "personal" },
  { to: "/by-engine", label: "By Engine", icon: "⚡️", group: "personal" },
  { to: "/perspective", label: "Perspective", icon: "🔭", group: "personal" },
  { to: "/confessional", label: "Confessional", icon: "🤬", group: "personal" },
  { to: "/night-owl", label: "Night Owl", icon: "🌙", group: "personal" },
  { to: "/streaks", label: "Streaks", icon: "🔥", group: "personal" },
  { to: "/hall-of-fame", label: "Hall of Fame", icon: "🏆", group: "personal" },
  { to: "/environmental", label: "Environmental", icon: "🌍", group: "personal" },
  { to: "/groups", label: "Groups", icon: "👥", group: "social" },
  { to: "/settings", label: "Settings", icon: "⚙️", group: "social" },
];
