import { useRef, useEffect, useState } from "react"
import mapboxgl from "mapbox-gl"

import getStreetMapStyle from "./getStreetMapStyle"
import getSatelliteMapStyle from "./getSatelliteMapStyle"

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN

import { useEventContext } from "@/utils/EventContext"
import { useMapStore } from "@/components/Map/useMapStore"

function removeLayer(map, layerName) {
  if (map.getLayer(layerName)) {
    try {
      map.removeLayer(layerName)
    } catch (err) {
      console.log(`Couldn't remove ${layerName} layer`, err)
    }
  }
}

function removeSource(map, sourceName) {
  if (map.getSource(sourceName)) {
    try {
      map.removeSource(sourceName)
    } catch (err) {
      console.log(`Couldn't remove ${sourceName} source`, err)
    }
  }
}

export default function MapboxMap() {
  const mapRef = useRef(null)
  const markerRef = useRef(null)
  const isFirstStyleRun = useRef(true)
  // map.isStyleLoaded() also waits for tiles, so track style readiness ourselves
  const isStyleReady = useRef(false)
  const [isLoaded, setIsLoaded] = useState(false)

  const { eventId } = useEventContext()

  const selectedItem = useMapStore((state) => state.selectedItem)
  const showSatellite = useMapStore((state) => state.showSatellite)
  const showFloodLayers = useMapStore((state) => state.showFloodLayers)

  const showPermanentWater = useMapStore((state) => state.showPermanentWater)
  const showCityLimits = useMapStore((state) => state.showCityLimits)
  const showIrrigationDistricts = useMapStore(
    (state) => state.showIrrigationDistricts
  )

  useEffect(() => {
    if (typeof window === "undefined") return
    if (mapRef.current) return
    if (isLoaded) return

    const map = new mapboxgl.Map({
      container: "map",
      style: showSatellite ? getSatelliteMapStyle() : getStreetMapStyle(),
      center: [-98.2, 26.3],
      zoom: 8,
      minZoom: 8,
      maxZoom: 16,
    })

    map.on("style.load", () => {
      isStyleReady.current = true
      setIsLoaded(true)

      map.addLayer({
        id: "add-3d-buildings",
        source: "composite",
        "source-layer": "building",
        filter: ["==", "extrude", "true"],
        type: "fill-extrusion",
        minzoom: 12,
        paint: {
          "fill-extrusion-color": "#aaa",
          "fill-extrusion-height": [
            "interpolate",
            ["linear"],
            ["zoom"],
            12,
            0,
            12.05,
            ["get", "height"],
          ],
          "fill-extrusion-base": [
            "interpolate",
            ["linear"],
            ["zoom"],
            12,
            0,
            12.05,
            ["get", "min_height"],
          ],
          "fill-extrusion-opacity": 0.9,
        },
      })
    })

    mapRef.current = map
  }, [])

  // Must run before the layers effect below, so isStyleReady is already false
  // when it runs after a satellite toggle
  useEffect(() => {
    if (typeof window === "undefined") return undefined
    if (!mapRef.current) return undefined
    // The map is created with the right style, so skip the initial run
    if (isFirstStyleRun.current) {
      isFirstStyleRun.current = false
      return undefined
    }
    const style = showSatellite ? getSatelliteMapStyle() : getStreetMapStyle()
    // diff: false avoids the "style is not done loading" warning on fast toggles
    isStyleReady.current = false
    mapRef.current.setStyle(style, { diff: false })
  }, [showSatellite])

  useEffect(() => {
    if (typeof window === "undefined") return undefined
    if (!mapRef.current) return undefined
    if (!isLoaded) return undefined
    if (!eventId) return undefined

    const map = mapRef.current
    let cancelled = false

    function updateLayers() {
      // const layers = map.getStyle().layers
      // const labelLayerId = layers.find(
      //   (layer) => layer.type === "symbol" && layer.layout["text-field"]
      // ).id

      // const allLayerIds = layers.map((d) => d.id)

      removeLayer(map, "perm-water-fill")
      removeSource(map, "perm-water")

      // removeLayer(map, "noflood-fill")
      // removeSource(map, "noflood")

      if (showPermanentWater) {
        map.addSource("perm-water", {
          type: "vector",
          tiles: [`${window.location.origin}/water/{z}/{x}/{y}.pbf`],
          minzoom: 0,
          maxzoom: 12,
        })
        map.addLayer(
          {
            id: "perm-water-fill",
            type: "fill",
            source: "perm-water",
            "source-layer": "waterlayer",
            paint: {
              "fill-color": "#002266",
              "fill-opacity": 0.8,
            },
          },
          "water"
        )
      }

      removeLayer(map, "flood-fill")
      removeSource(map, "flood")

      if (showFloodLayers) {
        map.addSource("flood", {
          type: "vector",
          tiles: [
            `${window.location.origin}/tiles/event-${eventId}/flood/{z}/{x}/{y}.pbf`,
          ],
          minzoom: 0,
          maxzoom: 12,
        })
        map.addLayer(
          {
            id: "flood-fill",
            type: "fill",
            source: "flood",
            "source-layer": "floodlayer",
            paint: {
              "fill-color": "#0066FF",
              "fill-opacity": 0.7,
            },
          },
          "water"
        )
      }

      removeLayer(mapRef.current, "cities-fill")
      removeLayer(mapRef.current, "cities-outline")
      removeSource(mapRef.current, "cities")

      if (showCityLimits) {
        fetch(`/data/rgv_cities-simplified.json`)
          .then((res) => res.json())
          .then((cities) => {
            // A newer run or a pending style.load will add the layers instead
            if (cancelled || !isStyleReady.current) return
            removeLayer(mapRef.current, "cities-fill")
            removeLayer(mapRef.current, "cities-outline")
            removeSource(mapRef.current, "cities")

            mapRef.current.addSource("cities", {
              "type": "geojson",
              "data": cities,
            })
            mapRef.current.addLayer(
              {
                "id": "cities-fill",
                "type": "fill",
                "source": "cities",
                "layout": {},
                "paint": {
                  "fill-color": "#FFF",
                  "fill-opacity": 0.15,
                },
              },
              "water"
            )
            mapRef.current.addLayer(
              {
                "id": "cities-outline",
                "type": "line",
                "source": "cities",
                "layout": {},
                "paint": {
                  "line-color": "#FFF",
                  "line-width": 1,
                },
              },
              "water"
            )
          })
      }

      removeLayer(mapRef.current, "irrigation-districts-fill")
      removeLayer(mapRef.current, "irrigation-districts-outline")
      removeSource(mapRef.current, "irrigation-districts")

      if (showIrrigationDistricts) {
        fetch(`/data/rgv_irrigation_districts-fixed.json`)
          .then((res) => res.json())
          .then((irrigationDistricts) => {
            // A newer run or a pending style.load will add the layers instead
            if (cancelled || !isStyleReady.current) return
            removeLayer(mapRef.current, "irrigation-districts-fill")
            removeLayer(mapRef.current, "irrigation-districts-outline")
            removeSource(mapRef.current, "irrigation-districts")

            mapRef.current.addSource("irrigation-districts", {
              "type": "geojson",
              "data": irrigationDistricts,
            })
            mapRef.current.addLayer(
              {
                "id": "irrigation-districts-fill",
                "type": "fill",
                "source": "irrigation-districts",
                "layout": {},
                "paint": {
                  "fill-color": "#99F5FF",
                  "fill-opacity": 0.15,
                },
              },
              "water"
            )
            mapRef.current.addLayer(
              {
                "id": "irrigation-districts-outline",
                "type": "line",
                "source": "irrigation-districts",
                "layout": {},
                "paint": {
                  "line-color": "#99F5FF",
                  "line-width": 1,
                },
              },
              "water"
            )
          })
      }
    }

    const onStyleLoad = () => updateLayers()

    map.on("style.load", onStyleLoad)
    if (isStyleReady.current) updateLayers()

    return () => {
      cancelled = true
      map.off("style.load", onStyleLoad)
    }
  }, [
    eventId,
    isLoaded,
    showSatellite,
    showFloodLayers,
    showCityLimits,
    showPermanentWater,
    showIrrigationDistricts,
  ])

  useEffect(() => {
    if (!mapRef.current) return undefined

    const coloniaFill = mapRef.current.getLayer("colonia-fill")
    if (coloniaFill) mapRef.current.removeLayer(coloniaFill.id)

    const coloniaOutline = mapRef.current.getLayer("colonia-outline")
    if (coloniaOutline) mapRef.current.removeLayer(coloniaOutline.id)

    const coloniaSource = mapRef.current.getSource("colonia")
    if (coloniaSource) mapRef.current.removeSource(coloniaSource.id)

    if (!selectedItem) {
      markerRef.current?.remove?.()
      mapRef.current.flyTo({
        center: [-98.2, 26.3],
        zoom: 8,
        essential: true,
      })
      return undefined
    }

    const { latitude, longitude } = selectedItem.coordinates

    markerRef.current?.remove?.()
    markerRef.current = new mapboxgl.Marker({ color: "#06F" })
      .setLngLat([longitude, latitude])
      .addTo(mapRef.current)

    mapRef.current.flyTo({
      center: [longitude, latitude],
      zoom: 15,
      essential: true,
    })

    if (!selectedItem.id) return undefined

    fetch(`/data/colonias/${selectedItem.id}.json`)
      .then((res) => res.json())
      .then((colonia) => {
        removeLayer(mapRef.current, "colonia-fill")
        removeLayer(mapRef.current, "colonia-outline")
        removeSource(mapRef.current, "colonia")

        const labelLayerId = mapRef.current
          .getStyle()
          .layers.find(
            (layer) => layer.type === "symbol" && layer.layout["text-field"]
          ).id

        mapRef.current.addSource("colonia", {
          "type": "geojson",
          "data": {
            "type": "Feature",
            "geometry": {
              "type": "Polygon",
              "coordinates": colonia.geometry.coordinates,
            },
          },
        })
        mapRef.current.addLayer(
          {
            "id": "colonia-fill",
            "type": "fill",
            "source": "colonia",
            "layout": {},
            "paint": {
              "fill-color": "#FFFFFF",
              "fill-opacity": 0.25,
            },
          },
          labelLayerId
        )
        mapRef.current.addLayer(
          {
            "id": "colonia-outline",
            "type": "line",
            "source": "colonia",
            "layout": {},
            "paint": {
              "line-color": "#FFF",
              "line-width": 4,
            },
          },
          labelLayerId
        )
      })
  }, [JSON.stringify(selectedItem)])

  const handleZoomIn = () => {
    const currentZoom = mapRef.current.getZoom()
    const zoom = Math.min(16, Math.round(currentZoom) + 1)
    mapRef.current.flyTo({ zoom })
  }

  const handleZoomOut = () => {
    const currentZoom = mapRef.current.getZoom()
    const zoom = Math.max(6, Math.round(currentZoom) - 1)
    mapRef.current.flyTo({ zoom })
  }

  const handleScreenshot = () => {
    function takeScreenshot(map) {
      return new Promise(function (resolve, reject) {
        map.once("render", function () {
          resolve(map.getCanvas().toDataURL())
        })
        map.setBearing(map.getBearing())
      })
    }
    takeScreenshot(mapRef.current).then(function (data) {
      var download = document.createElement("a")
      download.href = data
      download.download = "flujos-rgv-map.png"
      download.click()
    })
  }

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <div id="map" style={{ position: "absolute", inset: 0 }} />
      <div className="zoom-controls">
        <button onClick={handleZoomIn}>
          <svg viewBox="0 0 24 24" width="20" height="20">
            <title>{"Zoom in"}</title>
            <path
              d="M12,4L12,20M4,12L20,12"
              fill="none"
              strokeWidth={2}
              stroke="currentcolor"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        </button>
        <button onClick={handleZoomOut}>
          <svg viewBox="0 0 24 24" width="20" height="20">
            <title>{"Zoom out"}</title>
            <path
              d="M4,12L20,12"
              fill="none"
              strokeWidth={2}
              stroke="currentcolor"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        </button>
        <button onClick={handleScreenshot}>
          <svg viewBox="0 0 24 24" width="20" height="20">
            <title>{"Take screenshot"}</title>
            <path
              d="M10,10m4,0a4,4 0 1, 0 -8,0a4,4 0 1,0 8,0 M20 16a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V5c0-1.1.9-2 2-2h3l2-3h6l2 3h3a2 2 0 0 1 2 2v11z"
              fill="none"
              strokeWidth={2}
              stroke="currentcolor"
              vectorEffect="non-scaling-stroke"
              transform="translate(2 3)"
            />
          </svg>
        </button>
      </div>
    </div>
  )
}
