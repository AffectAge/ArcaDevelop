import { useEffect, useState } from "react";
import {
  BUILDING_ATLAS_FALLBACK_URL,
  getBuildingAtlasFrameIndex,
  getBuildingAtlasUrl,
  type BuildingAtlasState,
} from "../assets/buildingAtlas";

type Props = {
  scenarioId?: string | null;
  buildingId: string;
  state?: BuildingAtlasState;
  className?: string;
};

export function BuildingAtlasIcon({ scenarioId, buildingId, state = "working", className }: Props) {
  const [failed, setFailed] = useState(false);
  const frameIndex = getBuildingAtlasFrameIndex(state);
  const url = failed ? BUILDING_ATLAS_FALLBACK_URL : getBuildingAtlasUrl(scenarioId, buildingId);

  useEffect(() => {
    setFailed(false);
  }, [buildingId, scenarioId]);

  return (
    <span className={className} aria-hidden="true">
      <img
        src={url}
        alt=""
        draggable={false}
        onError={() => setFailed(true)}
        style={{
          width: "100%",
          height: "100%",
          maxWidth: "none",
          objectFit: "cover",
          objectPosition: `${frameIndex * 33.333333}% 50%`,
        }}
      />
    </span>
  );
}
