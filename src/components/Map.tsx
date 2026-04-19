"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface Store {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  address?: string;
}

interface MapProps {
  center: [number, number];
  stores: Store[];
  onStoreClick?: (store: Store) => void;
  selectedStoreId?: string | null;
}

// Fix Leaflet default icon issue in Next.js
const defaultIcon = L.divIcon({
  className: "custom-marker",
  html: `<svg width="28" height="40" viewBox="0 0 28 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M14 0C6.27 0 0 6.27 0 14c0 10.5 14 26 14 26s14-15.5 14-26C28 6.27 21.73 0 14 0z" fill="#e53e3e"/>
    <circle cx="14" cy="14" r="6" fill="white"/>
  </svg>`,
  iconSize: [28, 40],
  iconAnchor: [14, 40],
  popupAnchor: [0, -40],
});

const selectedIcon = L.divIcon({
  className: "custom-marker",
  html: `<svg width="34" height="48" viewBox="0 0 28 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M14 0C6.27 0 0 6.27 0 14c0 10.5 14 26 14 26s14-15.5 14-26C28 6.27 21.73 0 14 0z" fill="#2563eb"/>
    <circle cx="14" cy="14" r="6" fill="white"/>
  </svg>`,
  iconSize: [34, 48],
  iconAnchor: [17, 48],
  popupAnchor: [0, -48],
});

export default function Map({ center, stores, onStoreClick, selectedStoreId }: MapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<L.Marker[]>([]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    mapRef.current = L.map(containerRef.current).setView(center, 13);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(mapRef.current);

    // Add "you are here" marker
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

  // Update center
  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.setView(center, mapRef.current.getZoom());
    }
  }, [center]);

  // Update markers
  useEffect(() => {
    if (!mapRef.current) return;

    // Remove old markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    stores.forEach((store) => {
      const icon = store.id === selectedStoreId ? selectedIcon : defaultIcon;
      const marker = L.marker([store.latitude, store.longitude], { icon })
        .addTo(mapRef.current!)
        .bindPopup(`<b>${store.name}</b>${store.address ? `<br/>${store.address}` : ""}`);

      marker.on("click", () => onStoreClick?.(store));
      markersRef.current.push(marker);
    });
  }, [stores, selectedStoreId, onStoreClick]);

  return <div ref={containerRef} className="w-full h-full" />;
}
