import { motion } from "framer-motion";
import { Bell, Landmark, Wallet, HandCoins, Hammer, Users, Handshake, Shield, Eye, LineChart, Globe2, Network, SlidersHorizontal, ScrollText } from "lucide-react";
import type { UiTextKey } from "../i18n/uiText";
import { useUiText } from "../i18n/useUiText";

const navItems = [
  { key: "politics", labelKey: "sideNav.politics", icon: Landmark },
  { key: "technology", labelKey: "sideNav.technology", icon: Network },
  { key: "modifiers", labelKey: "sideNav.modifiers", icon: SlidersHorizontal },
  { key: "decisions", labelKey: "sideNav.decisions", icon: ScrollText },
  { key: "events", labelKey: "sideNav.events", icon: Bell },
  { key: "budget", labelKey: "sideNav.budget", icon: Wallet },
  { key: "trade", labelKey: "sideNav.trade", icon: HandCoins },
  { key: "market", labelKey: "sideNav.market", icon: LineChart },
  { key: "globalMarket", labelKey: "sideNav.globalMarket", icon: Globe2 },
  { key: "buildings", labelKey: "sideNav.buildings", icon: Hammer },
  { key: "population", labelKey: "sideNav.population", icon: Users },
  { key: "diplomacy", labelKey: "sideNav.diplomacy", icon: Handshake },
  { key: "army", labelKey: "sideNav.army", icon: Shield },
  { key: "intel", labelKey: "sideNav.intel", icon: Eye },
] satisfies Array<{ key: string; labelKey: UiTextKey; icon: typeof Landmark }>;

export type SideNavItemKey = (typeof navItems)[number]["key"];

type Props = {
  onItemClick?: (key: SideNavItemKey) => void;
};

export function SideNav({ onItemClick }: Props) {
  const { t } = useUiText();

  return (
    <aside className="pointer-events-auto absolute left-4 top-36 z-40 hidden flex-col gap-2 xl:flex">
      {navItems.map((item) => {
        const Icon = item.icon;
        const label = t(item.labelKey);
        return (
          <motion.button
            key={item.key}
            type="button"
            aria-label={label}
            title={label}
            whileHover={{ x: 6, scale: 1.02 }}
            transition={{ type: "tween", duration: 0.12 }}
            className="arc-hud-button-solid group relative flex h-10 w-10 items-center justify-start overflow-hidden rounded-[var(--arc-radius-md)] px-3 transition-[width,color,background-color,border-color,filter] duration-150 hover:w-[164px]"
            onClick={() => onItemClick?.(item.key)}
          >
            <Icon
              size={17}
              className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 transition-all duration-150 group-hover:left-3 group-hover:translate-x-0"
            />
            <span className="relative z-10 ml-6 max-w-0 overflow-hidden whitespace-nowrap text-xs font-semibold text-[var(--arc-color-gold)] opacity-0 transition-all duration-150 group-hover:max-w-[118px] group-hover:opacity-100">
              {label}
            </span>
          </motion.button>
        );
      })}
    </aside>
  );
}
