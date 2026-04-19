"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";

interface Alternative {
  id: string;
  name: string;
  description: string;
  price: number;
  croppedImagePath: string;
  storeId: string;
  storeName: string;
  latitude: number;
  longitude: number;
  address: string;
  itemName: string;
}

interface ListMapProps {
  center: [number, number];
  alternatives: Alternative[];
  highlightedId: string | null;
  onAlternativeClick?: (alt: Alternative) => void;
}

function markerIcon(highlighted: boolean) {
  const color = highlighted ? "#2563eb" : "#e53e3e";
  const size = highlighted ? 34 : 28;
  const anchor = highlighted ? 17 : 14;
  const anchorY = highlighted ? 48 : 40;
  return L.divIcon({
    className: "custom-marker",
    html: `<svg width="${size}" height="${Math.round(size * 1.43)}" viewBox="0 0 28 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M14 0C6.27 0 0 6.27 0 14c0 10.5 14 26 14 26s14-15.5 14-26C28 6.27 21.73 0 14 0z" fill="${color}"/>
      <circle cx="14" cy="14" r="6" fill="white"/>
    </svg>`,
    iconSize: [size, anchorY],
    iconAnchor: [anchor, anchorY],
    popupAnchor: [0, -anchorY],
  });
}

export default function ListMap({ center, alternatives, highlightedId, onAlternativeClick }: ListMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<L.Marker[]>([]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    mapRef.current = L.map(containerRef.current).setView(center, 13);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(mapRef.current);

    // User location
    const youIcon = L.divIcon({
      className: "you-marker",
      html: `<div style="width:16px;height:16px;background:#3b82f6;border:3px solid white;border-radius:50%;box-shadow:0 0 8px rgba(59,130,246,0.5)"></div>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    });
    L.marker(center, { icon: youIcon }).addTo(mapRef.current).bindPopup("You are here");

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // Update markers
  useEffect(() => {
    if (!mapRef.current) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    // Group by store to avoid overlapping markers
    const storeMap = new Map<string, { lat: number; lng: number; alts: Alternative[] }>();
    for (const alt of alternatives) {
      const key = alt.storeId;
      if (!storeMap.has(key)) {
        storeMap.set(key, { lat: alt.latitude, lng: alt.longitude, alts: [] });
      }
      storeMap.get(key)!.alts.push(alt);
    }

    for (const [, store] of storeMap) {
      const hasHighlight = store.alts.some((a) => a.id === highlightedId);
      const icon = markerIcon(hasHighlight);

      const popupContent = store.alts
        .map((a) => `<div style="margin-bottom:4px"><b>${a.name}</b> — $${a.price.toFixed(2)}<br/><small style="color:#666">for: ${a.itemName}</small></div>`)
        .join("");

      const marker = L.marker([store.lat, store.lng], { icon })
        .addTo(mapRef.current!)
        .bindPopup(`<div style="max-height:200px;overflow-y:auto"><b>${store.alts[0].storeName}</b><hr style="margin:4px 0"/>${popupContent}</div>`, { maxWidth: 300 });

      marker.on("click", () => {
        if (store.alts.length > 0) {
          onAlternativeClick?.(store.alts[0]);
        }
      });

      if (hasHighlight) {
        marker.openPopup();
      }

      markersRef.current.push(marker);
    }
  }, [alternatives, highlightedId, onAlternativeClick]);

  // Pan to highlighted
  useEffect(() => {
    if (!mapRef.current || !highlightedId) return;
    const alt = alternatives.find((a) => a.id === highlightedId);
    if (alt) {
      mapRef.current.panTo([alt.latitude, alt.longitude], { animate: true });
    }
  }, [highlightedId, alternatives]);

  return <div ref={containerRef} className="w-full h-full" />;
}
