import { motion } from "framer-motion";
import { Bell, Landmark, Wallet, HandCoins, Hammer, Users, Handshake, Shield, Eye, LineChart, Globe2, Network, SlidersHorizontal, ScrollText } from "lucide-react";

const navItems = [
  { key: "politics", label: "Политика", icon: Landmark },
  { key: "technology", label: "Технологии", icon: Network },
  { key: "modifiers", label: "Модификаторы", icon: SlidersHorizontal },
  { key: "decisions", label: "Решения", icon: ScrollText },
  { key: "events", label: "Ивенты", icon: Bell },
  { key: "budget", label: "Бюджет", icon: Wallet },
  { key: "trade", label: "Торговля", icon: HandCoins },
  { key: "market", label: "Рынок", icon: LineChart },
  { key: "globalMarket", label: "Глобальный рынок", icon: Globe2 },
  { key: "buildings", label: "Постройки", icon: Hammer },
  { key: "population", label: "Население", icon: Users },
  { key: "diplomacy", label: "Дипломатия", icon: Handshake },
  { key: "army", label: "Армия", icon: Shield },
  { key: "intel", label: "Спецслужбы", icon: Eye },
];

export type SideNavItemKey = (typeof navItems)[number]["key"];

type Props = {
  onItemClick?: (key: SideNavItemKey) => void;
};

export function SideNav({ onItemClick }: Props) {
  return (
    <aside className="pointer-events-auto absolute left-4 top-36 z-40 hidden flex-col gap-2 xl:flex">
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <motion.button
            key={item.key}
            type="button"
            whileHover={{ x: 6, scale: 1.02 }}
            transition={{ type: "tween", duration: 0.12 }}
            className="arc-hud-button-solid group relative flex h-10 w-10 items-center justify-start overflow-hidden rounded-xl px-3 transition-[width,color,background-color,border-color,filter] duration-150 hover:w-[164px]"
            onClick={() => onItemClick?.(item.key)}
          >
            <Icon
              size={17}
              className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 transition-all duration-150 group-hover:left-3 group-hover:translate-x-0"
            />
            <span className="relative z-10 ml-6 max-w-0 overflow-hidden whitespace-nowrap text-xs font-semibold text-[var(--arc-color-gold)] opacity-0 transition-all duration-150 group-hover:max-w-[118px] group-hover:opacity-100">
              {item.label}
            </span>
          </motion.button>
        );
      })}
    </aside>
  );
}
