import type { ReactNode } from "react";
import { cn } from "./classNames";

export type GamePlotTooltipYield = {
  id: string;
  icon: ReactNode;
  value: ReactNode;
  label?: ReactNode;
};

export type GamePlotTooltipSection = {
  title: ReactNode;
  rows: ReactNode[];
};

type GamePlotTooltipCardProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  location?: ReactNode;
  route?: ReactNode;
  yields?: GamePlotTooltipYield[];
  resource?: {
    icon: ReactNode;
    name: ReactNode;
    description?: ReactNode;
  };
  ownerLines?: ReactNode[];
  sections?: GamePlotTooltipSection[];
  className?: string;
};

export function GamePlotTooltipCard({
  title,
  subtitle,
  location,
  route,
  yields = [],
  resource,
  ownerLines = [],
  sections = [],
  className = "",
}: GamePlotTooltipCardProps) {
  return (
    <div className={cn("arc-kit-plot-tooltip", className)} role="tooltip">
      <div className="arc-kit-plot-tooltip__title">{title}</div>
      {subtitle ? <div className="arc-kit-plot-tooltip__subtitle">{subtitle}</div> : null}
      {location ? <div className="arc-kit-plot-tooltip__line">{location}</div> : null}
      {route ? <div className="arc-kit-plot-tooltip__line">{route}</div> : null}

      {yields.length ? (
        <div className="arc-kit-plot-tooltip__yields">
          {yields.map((item) => (
            <div key={item.id} className="arc-kit-plot-tooltip__yield" title={typeof item.label === "string" ? item.label : undefined}>
              <span className="arc-kit-plot-tooltip__yield-icon">{item.icon}</span>
              <strong>{item.value}</strong>
            </div>
          ))}
        </div>
      ) : null}

      {resource ? (
        <div className="arc-kit-plot-tooltip__resource">
          <span className="arc-kit-plot-tooltip__resource-icon">{resource.icon}</span>
          <span>
            <strong>{resource.name}</strong>
            {resource.description ? <span>{resource.description}</span> : null}
          </span>
        </div>
      ) : null}

      {ownerLines.length ? (
        <div className="arc-kit-plot-tooltip__owners">
          {ownerLines.map((line, index) => (
            <div key={index}>{line}</div>
          ))}
        </div>
      ) : null}

      {sections.map((section, index) => (
        <section key={index} className="arc-kit-plot-tooltip__section">
          <div className="arc-kit-plot-tooltip__section-title">
            <span>{section.title}</span>
          </div>
          <div className="arc-kit-plot-tooltip__section-rows">
            {section.rows.map((row, rowIndex) => (
              <div key={rowIndex}>{row}</div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
