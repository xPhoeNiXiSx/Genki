"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Icon, type IconName } from "./icons";

const TABS: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "Accueil", icon: "home" },
  { href: "/exercices", label: "Exos", icon: "dumbbell" },
  { href: "/programmes", label: "Programmes", icon: "list" },
  { href: "/suivi", label: "Suivi", icon: "chart" },
];

/** Menu flottant : l'onglet actif s'élargit en pastille volt avec son libellé. */
export function TabBar() {
  const pathname = usePathname();
  const active = (href: string) => (href === "/" ? pathname === "/" || pathname === "/metronome" : pathname.startsWith(href));

  return (
    <nav className="tabbar" aria-label="Navigation principale">
      {TABS.map((tab) => {
        const on = active(tab.href);
        return (
          <Link key={tab.href} href={tab.href} className={on ? "tab on" : "tab"} aria-current={on ? "page" : undefined} aria-label={tab.label}>
            <Icon name={tab.icon} size={on ? 18 : 22} />
            {on ? <span>{tab.label}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}
