"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";

const ListMap = dynamic(() => import("@/components/ListMap"), { ssr: false });

interface ParsedItem {
  name: string;
  quantity: number;
  category: string;
}

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
}

interface ItemResult {
  item: ParsedItem;
  alternatives: Alternative[];
}

type Results = Record<string, ItemResult>;

const CATEGORY_COLORS: Record<string, string> = {
  electronics: "bg-blue-100 text-blue-700",
  food: "bg-green-100 text-green-700",
  grocery: "bg-green-100 text-green-700",
  clothing: "bg-purple-100 text-purple-700",
  home: "bg-amber-100 text-amber-700",
  kitchen: "bg-amber-100 text-amber-700",
  beauty: "bg-pink-100 text-pink-700",
  health: "bg-red-100 text-red-700",
  books: "bg-indigo-100 text-indigo-700",
  toys: "bg-yellow-100 text-yellow-700",
  sports: "bg-teal-100 text-teal-700",
  office: "bg-slate-100 text-slate-700",
  pet: "bg-orange-100 text-orange-700",
  baby: "bg-rose-100 text-rose-700",
  automotive: "bg-gray-100 text-gray-700",
};

function categoryClass(cat: string): string {
  return CATEGORY_COLORS[cat.toLowerCase()] || "bg-gray-100 text-gray-700";
}

export default function ShoppingListPage() {
  const [userLocation, setUserLocation] = useState<[number, number]>([40.7128, -74.006]);
  const [listText, setListText] = useState("");
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<ParsedItem[]>([]);
  const [results, setResults] = useState<Results>({});
  const [parsed, setParsed] = useState(false);
  const [highlightedAlt, setHighlightedAlt] = useState<Alternative | null>(null);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserLocation([pos.coords.latitude, pos.coords.longitude]),
        () => {},
        { enableHighAccuracy: true }
      );
    }
  }, []);

  const handleSubmit = async () => {
    if (!listText.trim()) return;
    setLoading(true);
    setParsed(false);
    setItems([]);
    setResults({});
    setExpandedItem(null);
    setHighlightedAlt(null);

    try {
      const res = await fetch("/api/parse-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: listText,
          lat: userLocation[0],
          lng: userLocation[1],
        }),
      });
      const data = await res.json();
      if (data.items) {
        setItems(data.items);
        setResults(data.results || {});
        setParsed(true);
        if (data.items.length > 0) {
          setExpandedItem(data.items[0].name);
        }
      }
    } catch (err) {
      console.error("Failed to parse list:", err);
    } finally {
      setLoading(false);
    }
  };

  // Collect all alternatives with their parent item for the map
  const allMapPoints = useCallback((): (Alternative & { itemName: string })[] => {
    const points: (Alternative & { itemName: string })[] = [];
    for (const [itemName, result] of Object.entries(results)) {
      for (const alt of result.alternatives) {
        points.push({ ...alt, itemName });
      }
    }
    return points;
  }, [results]);

  const totalItems = items.length;
  const foundItems = items.filter((i) => results[i.name]?.alternatives.length > 0).length;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <header className="bg-gray-900 text-white z-[500] relative">
        <div className="flex items-center gap-4 px-4 h-14">
          <a href="/" className="flex items-center gap-1.5 flex-shrink-0">
            <span className="text-xl font-bold tracking-tight">
              <span className="text-yellow-400">Not</span> Amazon
              <span className="text-yellow-400">.com</span>
            </span>
          </a>
          <div className="flex-1" />
          <span className="text-sm text-gray-400">Shopping List Import</span>
          <a
            href="/"
            className="px-4 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium text-sm transition-colors"
          >
            Back to Map
          </a>
        </div>
      </header>

      {!parsed ? (
        /* Input view */
        <div className="flex-1 flex items-center justify-center bg-gray-50 p-6">
          <div className="w-full max-w-2xl">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Import Your Amazon Shopping List
              </h1>
              <p className="text-gray-600">
                Paste your Amazon cart, order, or wish list below and we&apos;ll find local alternatives at stores near you.
              </p>
            </div>

            <div className="bg-white rounded-2xl shadow-lg p-6 space-y-4">
              <textarea
                ref={textareaRef}
                value={listText}
                onChange={(e) => setListText(e.target.value)}
                placeholder={`Paste your Amazon shopping list here...

Example:
1x Logitech M720 Triathlon Multi-Device Wireless Mouse
2x Amazon Basics USB-C to USB-A Cable (3-Pack)
1x Anker 20W USB C Charger
3x Expo Low Odor Dry Erase Markers (12 pack)
1x AmazonBasics Microfiber Cleaning Cloth (24 pack)`}
                className="w-full h-64 px-4 py-3 border border-gray-300 rounded-xl text-gray-900 text-sm focus:ring-2 focus:ring-yellow-400 focus:border-transparent outline-none resize-none font-mono"
              />

              <button
                onClick={handleSubmit}
                disabled={loading || !listText.trim()}
                className="w-full py-3 bg-yellow-400 hover:bg-yellow-500 disabled:bg-gray-200 disabled:text-gray-400 text-gray-900 font-bold rounded-xl transition-colors flex items-center justify-center gap-2 text-base"
              >
                {loading ? (
                  <>
                    <div className="animate-spin h-5 w-5 border-2 border-gray-900 border-t-transparent rounded-full" />
                    Parsing your list and finding alternatives...
                  </>
                ) : (
                  "Find Local Alternatives"
                )}
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Results view */
        <div className="flex-1 flex overflow-hidden">
          {/* Results sidebar */}
          <div className="w-[440px] flex-shrink-0 border-r border-gray-200 flex flex-col bg-white">
            {/* Summary header */}
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-gray-700">
                    Local Alternatives Found
                  </h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {foundItems} of {totalItems} item{totalItems !== 1 ? "s" : ""} available nearby
                  </p>
                </div>
                <button
                  onClick={() => { setParsed(false); setItems([]); setResults({}); setHighlightedAlt(null); }}
                  className="px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  New List
                </button>
              </div>
            </div>

            {/* Item list */}
            <div className="flex-1 overflow-y-auto">
              {items.map((item) => {
                const result = results[item.name];
                const alts = result?.alternatives || [];
                const isExpanded = expandedItem === item.name;

                return (
                  <div key={item.name} className="border-b border-gray-100">
                    {/* Item header */}
                    <button
                      onClick={() => setExpandedItem(isExpanded ? null : item.name)}
                      className={`w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-gray-50 transition-colors ${isExpanded ? "bg-yellow-50" : ""}`}
                    >
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${alts.length > 0 ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"}`}>
                        {alts.length > 0 ? alts.length : "0"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900 truncate">
                            {item.name}
                          </span>
                          {item.quantity > 1 && (
                            <span className="text-xs text-gray-500 flex-shrink-0">x{item.quantity}</span>
                          )}
                        </div>
                        <span className={`inline-block mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium ${categoryClass(item.category)}`}>
                          {item.category}
                        </span>
                      </div>
                      <svg className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${isExpanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {/* Expanded alternatives */}
                    {isExpanded && (
                      <div className="px-4 pb-3">
                        {alts.length === 0 ? (
                          <div className="py-4 text-center text-sm text-gray-400">
                            No local alternatives found
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {alts.map((alt) => (
                              <div
                                key={alt.id}
                                className={`flex gap-3 p-2 rounded-lg cursor-pointer transition-colors ${highlightedAlt?.id === alt.id ? "bg-yellow-100 ring-1 ring-yellow-300" : "bg-gray-50 hover:bg-gray-100"}`}
                                onMouseEnter={() => setHighlightedAlt(alt)}
                                onMouseLeave={() => setHighlightedAlt(null)}
                              >
                                <div className="w-14 h-14 flex-shrink-0 bg-gray-200 rounded-lg overflow-hidden">
                                  <img
                                    src={alt.croppedImagePath}
                                    alt={alt.name}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).src =
                                        "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='56' height='56'%3E%3Crect width='56' height='56' fill='%23e5e7eb'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%239ca3af' font-size='10'%3ENo img%3C/text%3E%3C/svg%3E";
                                    }}
                                  />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h4 className="text-xs font-semibold text-gray-900 truncate">{alt.name}</h4>
                                  <p className="text-[11px] text-gray-500 truncate">{alt.description}</p>
                                  <div className="mt-1 flex items-center justify-between">
                                    <span className="text-sm font-bold text-green-700">${alt.price.toFixed(2)}</span>
                                    <span className="text-[11px] text-gray-400 truncate ml-2">📍 {alt.storeName}</span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Map */}
          <div className="flex-1 relative">
            <ListMap
              center={userLocation}
              alternatives={allMapPoints()}
              highlightedId={highlightedAlt?.id || null}
              onAlternativeClick={(alt) => {
                setExpandedItem(alt.itemName);
                setHighlightedAlt(alt);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
