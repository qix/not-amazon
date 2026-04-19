"use client";

import { useState, useRef, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  croppedImagePath: string;
  storeName: string;
  storeId: string;
  latitude?: number;
  longitude?: number;
  address?: string;
}

interface Store {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  address?: string;
}

interface GeoResult {
  latitude: number;
  longitude: number;
  displayName: string;
}

interface ProductSidebarProps {
  products: Product[];
  stores: Store[];
  query: string;
  loading: boolean;
  amazonProduct?: string | null;
  selectedStoreId?: string | null;
  onStoreHover?: (storeId: string | null) => void;
  onStoreSelect?: (storeId: string | null) => void;
  onDeleteProduct?: (id: string) => void;
  onStoreUpdated?: () => void;
}

function StoreAddressEditor({ store, onUpdated }: { store: Store; onUpdated?: () => void }) {
  const [editing, setEditing] = useState(false);
  const [address, setAddress] = useState(store.address || "");
  const [geoResults, setGeoResults] = useState<GeoResult[]>([]);
  const [geoLoading, setGeoLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const geoTimeout = useRef<NodeJS.Timeout | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setGeoResults([]);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleInput = (value: string) => {
    setAddress(value);
    if (geoTimeout.current) clearTimeout(geoTimeout.current);
    if (value.trim().length < 3) { setGeoResults([]); return; }

    geoTimeout.current = setTimeout(async () => {
      setGeoLoading(true);
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(value.trim())}`);
        const data = await res.json();
        if (Array.isArray(data)) setGeoResults(data);
      } catch { /* ignore */ }
      finally { setGeoLoading(false); }
    }, 400);
  };

  const selectResult = async (r: GeoResult) => {
    setSaving(true);
    setGeoResults([]);
    try {
      await fetch("/api/stores", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: store.id, address: r.displayName, latitude: r.latitude, longitude: r.longitude }),
      });
      setAddress(r.displayName);
      setEditing(false);
      onUpdated?.();
    } catch (err) {
      console.error("Failed to update store:", err);
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="text-left w-full text-xs text-gray-400 hover:text-blue-600 hover:underline truncate transition-colors"
        title="Click to update address"
      >
        {store.address || "No address — click to set"}
      </button>
    );
  }

  return (
    <div className="relative mt-1" ref={dropdownRef}>
      <div className="flex gap-1">
        <input
          type="text"
          value={address}
          onChange={(e) => handleInput(e.target.value)}
          autoFocus
          className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-yellow-400 focus:border-transparent outline-none text-gray-900"
          placeholder="Type new address..."
        />
        {geoLoading && (
          <div className="flex items-center px-1">
            <div className="animate-spin h-3 w-3 border-2 border-yellow-500 border-t-transparent rounded-full" />
          </div>
        )}
        <button
          onClick={() => { setEditing(false); setAddress(store.address || ""); setGeoResults([]); }}
          className="px-1.5 text-xs text-gray-400 hover:text-gray-600"
        >
          &times;
        </button>
      </div>
      {geoResults.length > 0 && (
        <div className="absolute z-20 w-full mt-0.5 bg-white border border-gray-200 rounded shadow-lg max-h-36 overflow-y-auto">
          {geoResults.map((r, i) => (
            <button
              key={i}
              onClick={() => selectResult(r)}
              disabled={saving}
              className="w-full px-2 py-1.5 text-left text-xs text-gray-800 hover:bg-yellow-50 border-b border-gray-50 last:border-b-0 transition-colors"
            >
              <span className="line-clamp-2">{r.displayName}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ProductSidebar({ products, stores, query, loading, amazonProduct, selectedStoreId, onStoreHover, onStoreSelect, onDeleteProduct, onStoreUpdated }: ProductSidebarProps) {
  const [storesExpanded, setStoresExpanded] = useState(true);

  const filteredProducts = products;
  const selectedStoreName = selectedStoreId
    ? stores.find((s) => s.id === selectedStoreId)?.name
    : null;

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="min-w-0 flex-1 mr-2">
            {selectedStoreName ? (
              <>
                <div className="flex items-center gap-1.5">
                  <h2 className="text-sm font-semibold text-gray-700 truncate">{selectedStoreName}</h2>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  {filteredProducts.length} product{filteredProducts.length !== 1 ? "s" : ""}
                  <button
                    onClick={() => onStoreSelect?.(null)}
                    className="ml-1.5 text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    Show all
                  </button>
                </p>
              </>
            ) : amazonProduct ? (
              <>
                <div className="flex items-center gap-1.5">
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-700 flex-shrink-0">AMAZON</span>
                  <h2 className="text-sm font-semibold text-gray-700 truncate">{amazonProduct}</h2>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  {filteredProducts.length > 0
                    ? `${filteredProducts.length} matching product${filteredProducts.length !== 1 ? "s" : ""} at nearby stores`
                    : "No matches found at nearby stores"}
                </p>
              </>
            ) : (
              <>
                <h2 className="text-sm font-semibold text-gray-700 truncate">
                  {query
                    ? `Results for "${query}"`
                    : "Nearby Products"}
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {filteredProducts.length} product{filteredProducts.length !== 1 ? "s" : ""} found
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Stores section */}
        {stores.length > 0 && (
          <div className="border-b border-gray-200">
            <button
              onClick={() => setStoresExpanded(!storesExpanded)}
              className="w-full px-4 py-2 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                Stores ({stores.length})
              </span>
              <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform ${storesExpanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {storesExpanded && (
              <div className="divide-y divide-gray-50">
                {stores.map((store) => {
                  const isSelected = selectedStoreId === store.id;
                  return (
                    <div
                      key={store.id}
                      className={`px-4 py-2.5 cursor-pointer transition-colors ${isSelected ? "bg-yellow-100" : "hover:bg-yellow-50"}`}
                      onMouseEnter={() => onStoreHover?.(store.id)}
                      onMouseLeave={() => onStoreHover?.(null)}
                      onClick={() => onStoreSelect?.(isSelected ? null : store.id)}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${isSelected ? "bg-blue-100" : "bg-red-100"}`}>
                          <svg className={`w-3.5 h-3.5 ${isSelected ? "text-blue-600" : "text-red-600"}`} fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
                          <h4 className="text-sm font-medium text-gray-900 truncate cursor-pointer" onClick={() => onStoreSelect?.(isSelected ? null : store.id)}>{store.name}</h4>
                          <StoreAddressEditor store={store} onUpdated={onStoreUpdated} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Products section */}
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin h-8 w-8 border-4 border-yellow-500 border-t-transparent rounded-full" />
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            <div className="text-4xl mb-3">🏪</div>
            <p className="text-sm">
              {query
                ? "No products found. Try a different search."
                : "No products listed yet. Add a store to get started!"}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredProducts.map((product) => (
              <div
                key={product.id}
                className="p-3 hover:bg-yellow-50 transition-colors group"
                onMouseEnter={() => onStoreHover?.(product.storeId)}
                onMouseLeave={() => onStoreHover?.(null)}
              >
                <div className="flex gap-3">
                  <div className="w-20 h-20 flex-shrink-0 bg-gray-100 rounded-lg overflow-hidden">
                    <img
                      src={product.croppedImagePath}
                      alt={product.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80'%3E%3Crect width='80' height='80' fill='%23f3f4f6'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%239ca3af' font-size='12'%3ENo img%3C/text%3E%3C/svg%3E";
                      }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-1">
                      <h3 className="text-sm font-semibold text-gray-900 truncate">
                        {product.name}
                      </h3>
                      {onDeleteProduct && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onDeleteProduct(product.id); }}
                          className="flex-shrink-0 w-5 h-5 flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-all text-xs"
                          title="Remove product"
                        >
                          &times;
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                      {product.description}
                    </p>
                    <div className="mt-1.5 flex items-center justify-between">
                      <span className="text-base font-bold text-green-700">
                        ${product.price.toFixed(2)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5 truncate">
                      📍 {product.storeName}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* QR Code & GitHub */}
      <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 flex items-center gap-3 flex-shrink-0">
        <QRCodeSVG
          value="https://not-amazon-production.up.railway.app/"
          size={112}
          level="M"
        />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-gray-700">Visit on your phone</p>
          <p className="text-[11px] text-gray-400 truncate">not-amazon-production.up.railway.app</p>
          <a
            href="https://github.com/qix/not-amazon"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 mt-1 text-[11px] text-gray-500 hover:text-gray-900 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
            </svg>
            qix/not-amazon
          </a>
        </div>
      </div>
    </div>
  );
}
