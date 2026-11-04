import * as React from "react"

import { VisibleIcon, InvisibleIcon } from "@/components/Icon"
import { useMapStore } from "@/components/Map/useMapStore"
import { useTranslationStore } from "@/utils/useTranslation"

export default function Layers() {
  const showSatellite = useMapStore((state) => state.showSatellite)
  const toggleSatellite = useMapStore((state) => state.toggleSatellite)
  const showFloodLayers = useMapStore((state) => state.showFloodLayers)
  const toggleFloodLayers = useMapStore((state) => state.toggleFloodLayers)

  const content = useTranslationStore((state) => state.content)

  const showPermanentWater = useMapStore((state) => state.showPermanentWater)
  const togglePermanentWater = useMapStore(
    (state) => state.togglePermanentWater
  )

  const showCityLimits = useMapStore((state) => state.showCityLimits)
  const toggleCityLimits = useMapStore((state) => state.toggleCityLimits)
  const showIrrigationDistricts = useMapStore(
    (state) => state.showIrrigationDistricts
  )
  const toggleIrrigationDistricts = useMapStore(
    (state) => state.toggleIrrigationDistricts
  )

  const [expanded, setExpanded] = React.useState(false)

  const filters = [
    {
      key: 1,
      label: content["flood"],
      visible: showFloodLayers,
      onClick: () => toggleFloodLayers(),
      color: "#06F",
    },
    {
      key: 2,
      label: content["satellite"],
      visible: showSatellite,
      onClick: () => toggleSatellite(),
      color: undefined,
    },
    {
      key: 3,
      label: content["water"],
      visible: showPermanentWater,
      onClick: () => togglePermanentWater(),
      color: "#026",
    },
    {
      key: 4,
      label: "Irrigation districts",
      visible: showIrrigationDistricts,
      onClick: () => toggleIrrigationDistricts(),
      color: "#FFF",
    },
    {
      key: 5,
      label: "City limits",
      visible: showCityLimits,
      onClick: () => toggleCityLimits(),
      color: "#FFF",
    },
  ]

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        flexWrap: "wrap",
        gap: "0.5rem",
        position: "absolute",
        left: 0,
        right: 0,
        top: "100%",
        marginTop: "0.75rem",
      }}
    >
      {filters.slice(0, expanded ? undefined : 2).map((d) => (
        <button
          key={d.key}
          className="btn"
          onClick={d.onClick}
          style={{ flex: "none", textTransform: "capitalize" }}
        >
          {d.visible ? <VisibleIcon /> : <InvisibleIcon />}
          {d.label}
          {d.color ? (
            <div
              style={{
                background: d.color,
                width: "1.25rem",
                height: "1.25rem",
                borderRadius: "100%",
              }}
            />
          ) : null}
        </button>
      ))}

      <button
        className="btn"
        onClick={() => setExpanded(!expanded)}
        style={{ flex: "none", textTransform: "capitalize" }}
      >
        <svg viewBox="0 0 24 24" width="20" height="20">
          <title>{"Zoom in"}</title>
          <path
            d={expanded ? "M4,12L20,12" : "M12,4L12,20M4,12L20,12"}
            fill="none"
            strokeWidth={2}
            stroke="currentcolor"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        {expanded ? "Less filters" : "More filters"}
      </button>
    </div>
  )
}
