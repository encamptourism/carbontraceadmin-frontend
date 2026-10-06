import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState, useSyncExternalStore } from "react";
import { PUBLIC_ROUTES, isAuthed, logout } from "@/lib/api";
import { Icon } from "@/lib/ui";
import { Inter } from "next/font/google";
import "@/styles/globals.css";

const inter = Inter({ subsets: ["latin"] });

const noop = () => () => {};

const NAV = [
  ["Overview", [["Dashboard", "/", "dashboard"]]],
  ["Operations", [["Sales & Orders", "/sales", "sales"], ["Projects", "/projects", "projects"], ["Inquiries", "/inquiries", "inquiries"]]],
  ["Finance", [["Billing", "/billing", "billing"], ["Accounts", "/accounts", "accounts"], ["Wallet", "/wallet", "wallet"], ["Rewards", "/rewards", "rewards"]]],
  ["System", [["Notifications", "/notifications", "bell"], ["Tools", "/tools", "tools"], ["Logs", "/logs", "logs"], ["Settings", "/settings", "settings"]]],
];

const COLLAPSE_KEY = "sidebar-collapsed";
const readCollapsed = () => { try { return localStorage.getItem(COLLAPSE_KEY) === "1"; } catch { return false; } };

export default function App({ Component, pageProps }) {
  const router = useRouter();
  const { pathname } = router;
  // false during SSR, true in the browser, so localStorage is only read client-side
  const hydrated = useSyncExternalStore(noop, () => true, () => false);
  const authed = hydrated && isAuthed();
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(readCollapsed);

  useEffect(() => {
    if (hydrated && !authed && !PUBLIC_ROUTES.includes(pathname)) router.replace("/login");
  }, [hydrated, authed, pathname, router]);

  if (PUBLIC_ROUTES.includes(pathname)) return <div className={inter.className}><Component {...pageProps} /></div>;
  if (!authed) return null;

  async function onLogout() {
    await logout();
    router.replace("/login");
  }
  function toggleCollapsed() {
    setCollapsed(!collapsed);
    try { localStorage.setItem(COLLAPSE_KEY, collapsed ? "0" : "1"); } catch {}
  }
  const isActive = (href) => pathname === href || (href !== "/" && pathname.startsWith(href));

  return (
    <div className={`shell ${inter.className}${collapsed ? " collapsed" : ""}`}>
      <aside className="sidebar">
        <div className="sidebar-top">
          <Link href="/" className="brand" aria-label="CarbonTrace home">
            <span className="brand-mark" aria-hidden><Icon name="leaf" size={16} /></span>
            <span className="brand-text">CarbonTrace</span>
          </Link>
          <button className="menu-btn" aria-expanded={menuOpen} aria-controls="main-nav" aria-label={menuOpen ? "Close menu" : "Open menu"} onClick={() => setMenuOpen(!menuOpen)}>
            <span className={`burger${menuOpen ? " open" : ""}`} aria-hidden><i /><i /><i /></span>
          </button>
        </div>

        <nav id="main-nav" className={menuOpen ? "open" : ""}>
          {NAV.map(([group, items]) => (
            <div key={group} className="nav-group">
              <span className="nav-label">{group}</span>
              {items.map(([label, href, icon]) => (
                <Link key={href} href={href} onClick={() => setMenuOpen(false)} className={isActive(href) ? "active" : ""} aria-current={isActive(href) ? "page" : undefined} title={collapsed ? label : undefined}>
                  <Icon name={icon} size={18} />
                  <span>{label}</span>
                </Link>
              ))}
            </div>
          ))}
          <div className="nav-foot">
            <div className="me">
              <span className="me-avatar" aria-hidden>CT</span>
              <span className="me-text"><strong>Admin</strong><small>CarbonTrace console</small></span>
            </div>
            <button className="logout" onClick={onLogout} title="Log out"><Icon name="logout" size={18} /><span>Log out</span></button>
          </div>
        </nav>

        <button className="collapse-btn" onClick={toggleCollapsed} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} title={collapsed ? "Expand" : "Collapse"}>
          <Icon name="back" size={14} />
        </button>
      </aside>
      {menuOpen && <div className="nav-scrim" onClick={() => setMenuOpen(false)} aria-hidden />}
      <main className="content" key={pathname}>
        <Component {...pageProps} />
      </main>
    </div>
  );
}
