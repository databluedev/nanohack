"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import type { Route, LatLng } from "@/lib/types";

type Props = {
  routes: Route[];
  driverPos?: LatLng | null;
  followDriver?: boolean;
};

const COLOR_BY_LEVEL: Record<string, string> = {
  high: "#dc2626",
  medium: "#f59e0b",
  low: "#10b981",
};

export default function MapView({ routes, driverPos, followDriver }: Props) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const routeLayerRef = useRef<L.LayerGroup | null>(null);
  const hazardLayerRef = useRef<L.LayerGroup | null>(null);
  const driverRef = useRef<L.CircleMarker | null>(null);

  // Init map once
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;
    const map = L.map(containerRef.current, { zoomControl: false }).setView(
      [13.05, 80.22],
      11
    );
    L.control.zoom({ position: "bottomright" }).addTo(map);
    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
      {
        attribution: "© OpenStreetMap, © CARTO",
        maxZoom: 19,
      }
    ).addTo(map);
    mapRef.current = map;
    routeLayerRef.current = L.layerGroup().addTo(map);
    hazardLayerRef.current = L.layerGroup().addTo(map);
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Render routes
  useEffect(() => {
    const map = mapRef.current;
    const routeLayer = routeLayerRef.current;
    const hazardLayer = hazardLayerRef.current;
    if (!map || !routeLayer || !hazardLayer) return;

    routeLayer.clearLayers();
    hazardLayer.clearLayers();

    if (routes.length === 0) return;

    const allBounds: LatLng[] = [];
    routes.forEach((r, idx) => {
      const isPrimary = idx === 0;
      r.segments.forEach((seg) => {
        const color = COLOR_BY_LEVEL[seg.level] ?? "#10b981";
        L.polyline(seg.polyline, {
          color,
          weight: isPrimary ? 6 : 4,
          opacity: isPrimary ? 0.95 : 0.4,
        }).addTo(routeLayer);
      });
      r.polyline.forEach((p) => allBounds.push(p));

      if (isPrimary) {
        r.assessment.waypoints.forEach((w) => {
          const icon = L.divIcon({
            className: "",
            html: `<div style="width:18px;height:18px;border-radius:50%;background:rgba(220,38,38,0.65);border:2px solid #fff;box-shadow:0 0 14px rgba(220,38,38,0.7);"></div>`,
            iconSize: [18, 18],
            iconAnchor: [9, 9],
          });
          const m = L.marker([w.lat, w.lng], { icon }).addTo(hazardLayer);
          m.bindPopup(
            `<div style="font-family:system-ui;font-size:13px;"><b>${w.name}</b><br/>Risk score: ${w.score}<br/><i style="opacity:0.8">${w.voice}</i></div>`
          );
        });
      }
    });

    if (allBounds.length) {
      map.fitBounds(allBounds as [number, number][], { padding: [60, 60] });
    }
  }, [routes]);

  // Driver marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!driverPos) {
      if (driverRef.current) {
        map.removeLayer(driverRef.current);
        driverRef.current = null;
      }
      return;
    }
    if (!driverRef.current) {
      driverRef.current = L.circleMarker(driverPos, {
        radius: 9,
        color: "#1d4ed8",
        fillColor: "#3b82f6",
        fillOpacity: 1,
        weight: 3,
      }).addTo(map);
    } else {
      driverRef.current.setLatLng(driverPos);
    }
    if (followDriver) {
      map.panTo(driverPos, { animate: true, duration: 0.25 });
    }
  }, [driverPos, followDriver]);

  return <div ref={containerRef} className="absolute inset-0" />;
}
