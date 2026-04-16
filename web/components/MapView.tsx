"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import type { Route, LatLng, EmergencyService, SafeZone, AreaRiskCell, CommunityReport, TrafficCell } from "@/lib/types";

type Props = {
  routes: Route[];
  driverPos?: LatLng | null;
  followDriver?: boolean;
  emergencyServices?: EmergencyService[];
  safeZones?: SafeZone[];
  areaRiskCells?: AreaRiskCell[];
  communityReports?: CommunityReport[];
  trafficCells?: TrafficCell[];
  showJunctions?: boolean;
};

const COLOR_BY_LEVEL: Record<string, string> = {
  high: "#dc2626",
  medium: "#f59e0b",
  low: "#10b981",
};

const EMERGENCY_ICON_COLOR: Record<string, string> = {
  hospital: "#22c55e",
  police: "#3b82f6",
  fire: "#f97316",
};

const EMERGENCY_ICON_SYMBOL: Record<string, string> = {
  hospital: "+",
  police: "\u2605",
  fire: "\u2666",
};

const JUNCTION_ICON: Record<string, string> = {
  cloverleaf: "\u2B50",
  roundabout: "\u{1F504}",
  signal: "\u{1F6A6}",
  flyover: "\u{1F309}",
  bridge: "\u{1F309}",
  "u-turn": "\u21A9",
  highway: "\u{1F6E3}",
  arterial: "\u{1F6E3}",
  corridor: "\u{1F6B6}",
};

const REPORT_ICON: Record<string, string> = {
  pothole: "\u{1F6A7}",
  blind_turn: "\u21A9",
  accident_spot: "\u26A0",
  waterlogging: "\u{1F30A}",
  construction: "\u{1F3D7}",
  other: "\u2753",
};

export default function MapView({
  routes, driverPos, followDriver, emergencyServices,
  safeZones, areaRiskCells, communityReports, trafficCells, showJunctions,
}: Props) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const routeLayerRef = useRef<L.LayerGroup | null>(null);
  const hazardLayerRef = useRef<L.LayerGroup | null>(null);
  const driverRef = useRef<L.CircleMarker | null>(null);
  const emergencyLayerRef = useRef<L.LayerGroup | null>(null);
  const overlayLayerRef = useRef<L.LayerGroup | null>(null);

  // Init map once
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;
    const map = L.map(containerRef.current, { zoomControl: false }).setView([13.05, 80.22], 11);
    L.control.zoom({ position: "bottomright" }).addTo(map);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: "\u00A9 OpenStreetMap, \u00A9 CARTO",
      maxZoom: 19,
    }).addTo(map);
    mapRef.current = map;
    routeLayerRef.current = L.layerGroup().addTo(map);
    hazardLayerRef.current = L.layerGroup().addTo(map);
    emergencyLayerRef.current = L.layerGroup().addTo(map);
    overlayLayerRef.current = L.layerGroup().addTo(map);
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // Render routes + junction markers
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
          color, weight: isPrimary ? 6 : 4, opacity: isPrimary ? 0.95 : 0.4,
        }).addTo(routeLayer);
      });
      r.polyline.forEach((p) => allBounds.push(p));

      if (isPrimary) {
        r.assessment.waypoints.forEach((w) => {
          const jType = w.junction_type ?? "unknown";
          const jIcon = JUNCTION_ICON[jType] ?? "\u26A0";
          const tags = w.tags ?? [];

          // Risk marker
          const icon = L.divIcon({
            className: "",
            html: `<div style="width:18px;height:18px;border-radius:50%;background:rgba(220,38,38,0.65);border:2px solid #fff;box-shadow:0 0 14px rgba(220,38,38,0.7);"></div>`,
            iconSize: [18, 18], iconAnchor: [9, 9],
          });
          const m = L.marker([w.lat, w.lng], { icon }).addTo(hazardLayer);
          const tagsHtml = tags.length > 0
            ? `<div style="margin-top:4px;display:flex;flex-wrap:wrap;gap:2px;">${tags.map((t) => `<span style="background:#334155;color:#94a3b8;font-size:10px;padding:1px 5px;border-radius:4px;">${t}</span>`).join("")}</div>`
            : "";
          m.bindPopup(
            `<div style="font-family:system-ui;font-size:13px;">` +
            `<b>${jIcon} ${w.name}</b><br/>` +
            `<span style="color:#888;">Type: ${jType} | Risk: ${w.score}</span><br/>` +
            `<i style="opacity:0.8">${w.voice}</i>${tagsHtml}</div>`
          );

          // Junction type label (if showJunctions enabled)
          if (showJunctions) {
            const jLabel = L.divIcon({
              className: "",
              html: `<div style="background:#1e293b;border:1px solid #475569;border-radius:6px;padding:1px 5px;font-size:10px;color:#e2e8f0;white-space:nowrap;">${jIcon} ${jType}</div>`,
              iconSize: [80, 20], iconAnchor: [40, -12],
            });
            L.marker([w.lat, w.lng], { icon: jLabel }).addTo(hazardLayer);
          }
        });
      }
    });

    if (allBounds.length) {
      map.fitBounds(allBounds as [number, number][], { padding: [60, 60] });
    }
  }, [routes, showJunctions]);

  // Driver marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!driverPos) {
      if (driverRef.current) { map.removeLayer(driverRef.current); driverRef.current = null; }
      return;
    }
    if (!driverRef.current) {
      driverRef.current = L.circleMarker(driverPos, {
        radius: 9, color: "#1d4ed8", fillColor: "#3b82f6", fillOpacity: 1, weight: 3,
      }).addTo(map);
    } else {
      driverRef.current.setLatLng(driverPos);
    }
    if (followDriver) map.panTo(driverPos, { animate: true, duration: 0.25 });
  }, [driverPos, followDriver]);

  // Emergency service markers
  useEffect(() => {
    const layer = emergencyLayerRef.current;
    if (!layer) return;
    layer.clearLayers();
    if (!emergencyServices || emergencyServices.length === 0) return;

    emergencyServices.forEach((svc) => {
      const color = EMERGENCY_ICON_COLOR[svc.type] ?? "#888";
      const symbol = EMERGENCY_ICON_SYMBOL[svc.type] ?? "?";
      const icon = L.divIcon({
        className: "",
        html: `<div style="width:22px;height:22px;border-radius:50%;background:${color};border:2px solid #fff;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:14px;color:#fff;box-shadow:0 0 8px ${color}80;">${symbol}</div>`,
        iconSize: [22, 22], iconAnchor: [11, 11],
      });
      const m = L.marker([svc.lat, svc.lng], { icon }).addTo(layer);
      m.bindPopup(
        `<div style="font-family:system-ui;font-size:13px;"><b>${svc.name}</b><br/>${svc.type.charAt(0).toUpperCase() + svc.type.slice(1)}<br/>${svc.distance_km} km away${svc.phone ? `<br/>Phone: ${svc.phone}` : ""}</div>`
      );
    });
  }, [emergencyServices]);

  // Overlay: safe zones, area risk cells, community reports
  useEffect(() => {
    const map = mapRef.current;
    const layer = overlayLayerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();

    // Safe zones — green circles
    if (safeZones) {
      safeZones.forEach((zone) => {
        L.circle([zone.lat, zone.lng], {
          radius: zone.radius_m,
          color: "#22c55e",
          fillColor: "#22c55e",
          fillOpacity: 0.1,
          weight: 1,
          dashArray: "4",
        }).addTo(layer).bindPopup(
          `<div style="font-family:system-ui;font-size:13px;"><b>\u2705 ${zone.name}</b><br/><span style="color:#22c55e;">Safe Zone</span><br/>${zone.reasons.join(", ")}</div>`
        );
      });
    }

    // Area risk cells — colored rectangles
    if (areaRiskCells) {
      const cellSize = 0.015; // ~1.6 km
      areaRiskCells.forEach((cell) => {
        if (cell.score < 5) return; // skip very low
        const color = COLOR_BY_LEVEL[cell.level] ?? "#10b981";
        L.rectangle(
          [[cell.lat - cellSize / 2, cell.lng - cellSize / 2],
           [cell.lat + cellSize / 2, cell.lng + cellSize / 2]],
          { color, fillColor: color, fillOpacity: 0.15, weight: 1 }
        ).addTo(layer).bindPopup(
          `<div style="font-family:system-ui;font-size:12px;">Area risk: ${cell.score}/100<br/>${cell.spots_nearby} black spots nearby</div>`
        );
      });
    }

    // Traffic congestion cells
    if (trafficCells) {
      const cellSize = 0.012;
      trafficCells.forEach((cell) => {
        L.rectangle(
          [[cell.lat - cellSize / 2, cell.lng - cellSize / 2],
           [cell.lat + cellSize / 2, cell.lng + cellSize / 2]],
          { color: cell.color, fillColor: cell.color, fillOpacity: 0.2, weight: 0.5 }
        ).addTo(layer).bindPopup(
          `<div style="font-family:system-ui;font-size:12px;"><b>Traffic: ${cell.level.replace("_", " ")}</b><br/>Congestion: ${cell.congestion}x<br/>Speed: ${Math.round(cell.speed_factor * 100)}% of free flow${cell.corridor ? `<br/>${cell.corridor}` : ""}</div>`
        );
      });
    }

    // Community reports — markers
    if (communityReports) {
      communityReports.forEach((report) => {
        const emoji = REPORT_ICON[report.type] ?? "\u2753";
        const sevColor = report.severity >= 3 ? "#dc2626" : report.severity >= 2 ? "#f59e0b" : "#94a3b8";
        const icon = L.divIcon({
          className: "",
          html: `<div style="width:20px;height:20px;border-radius:50%;background:${sevColor}33;border:2px solid ${sevColor};display:flex;align-items:center;justify-content:center;font-size:12px;">${emoji}</div>`,
          iconSize: [20, 20], iconAnchor: [10, 10],
        });
        L.marker([report.lat, report.lng], { icon }).addTo(layer).bindPopup(
          `<div style="font-family:system-ui;font-size:12px;"><b>${emoji} ${report.type.replace("_", " ")}</b>${report.description ? `<br/>${report.description}` : ""}<br/><span style="color:#888;">Severity: ${report.severity}/3 | Upvotes: ${report.upvotes}</span></div>`
        );
      });
    }
  }, [safeZones, areaRiskCells, communityReports, trafficCells]);

  return <div ref={containerRef} className="absolute inset-0" />;
}
