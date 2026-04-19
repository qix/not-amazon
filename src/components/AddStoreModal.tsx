"use client";

import { useState, useRef, useEffect } from "react";

interface AddStoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStoreAdded: () => void;
  userLocation: [number, number];
}

interface GeoResult {
  latitude: number;
  longitude: number;
  displayName: string;
  type: string;
}

export default function AddStoreModal({ isOpen, onClose, onStoreAdded, userLocation }: AddStoreModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [geoResults, setGeoResults] = useState<GeoResult[]>([]);
  const [geoLoading, setGeoLoading] = useState(false);
  const [showGeoDropdown, setShowGeoDropdown] = useState(false);
  const [locationConfirmed, setLocationConfirmed] = useState(false);
  const [photos, setPhotos] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ store: { id: string }; productsDetected: number; products: Array<{ name: string; croppedImagePath: string }>; skipped?: Array<{ name: string; reason: string }> } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const geoTimeout = useRef<NodeJS.Timeout | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowGeoDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (!isOpen) return null;

  const handleAddressInput = (value: string) => {
    setAddress(value);
    setLocationConfirmed(false);
    setLat(null);
    setLng(null);

    if (geoTimeout.current) clearTimeout(geoTimeout.current);

    if (value.trim().length < 3) {
      setGeoResults([]);
      setShowGeoDropdown(false);
      return;
    }

    geoTimeout.current = setTimeout(async () => {
      setGeoLoading(true);
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(value.trim())}`);
        const data = await res.json();
        if (Array.isArray(data)) {
          setGeoResults(data);
          setShowGeoDropdown(data.length > 0);
        }
      } catch {
        setGeoResults([]);
      } finally {
        setGeoLoading(false);
      }
    }, 400);
  };

  const selectGeoResult = (result: GeoResult) => {
    setAddress(result.displayName);
    setLat(result.latitude);
    setLng(result.longitude);
    setLocationConfirmed(true);
    setShowGeoDropdown(false);
    setGeoResults([]);
  };

  const useCurrentLocation = () => {
    setLat(userLocation[0]);
    setLng(userLocation[1]);
    setLocationConfirmed(true);
    setAddress("Current location");
  };

  const handlePhotos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setPhotos((prev) => [...prev, ...files]);
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => setPreviews((prev) => [...prev, ev.target?.result as string]);
      reader.readAsDataURL(file);
    });
  };

  const removePhoto = (idx: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== idx));
    setPreviews((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || lat === null || lng === null) return;

    setSubmitting(true);
    setResult(null);

    const formData = new FormData();
    formData.append("name", name);
    formData.append("description", description);
    formData.append("address", address);
    formData.append("latitude", lat.toString());
    formData.append("longitude", lng.toString());
    photos.forEach((photo) => formData.append("photos", photo));

    try {
      const res = await fetch("/api/stores", { method: "POST", body: formData });
      const data = await res.json();
      setResult(data);
      onStoreAdded();
    } catch (err) {
      console.error("Failed to add store:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setName("");
    setDescription("");
    setAddress("");
    setLat(null);
    setLng(null);
    setLocationConfirmed(false);
    setGeoResults([]);
    setShowGeoDropdown(false);
    setPhotos([]);
    setPreviews([]);
    setResult(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50" onClick={handleClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">List a New Store</h2>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>

        {result ? (
          <div className="p-6">
            <div className="text-center mb-4">
              <div className="text-5xl mb-2">✅</div>
              <h3 className="text-lg font-bold text-gray-900">Store Listed!</h3>
              <p className="text-sm text-gray-600 mt-1">
                {result.productsDetected > 0
                  ? `${result.productsDetected} product${result.productsDetected !== 1 ? "s" : ""} detected from your photos`
                  : "You can add photos anytime by clicking the store on the map."}
              </p>
            </div>
            {result.products && result.products.length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Detected Products:</h4>
                <div className="grid grid-cols-3 gap-2">
                  {result.products.map((p, i) => (
                    <div key={i} className="text-center">
                      <div className="w-full aspect-square bg-gray-100 rounded-lg overflow-hidden mb-1">
                        <img src={p.croppedImagePath} alt={p.name} className="w-full h-full object-cover" />
                      </div>
                      <p className="text-xs text-gray-600 truncate">{p.name}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {result.skipped && result.skipped.length > 0 && (
              <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <h4 className="text-sm font-semibold text-amber-800 mb-1.5">
                  {result.skipped.length} product{result.skipped.length !== 1 ? "s" : ""} skipped
                </h4>
                <ul className="space-y-1">
                  {result.skipped.map((s, i) => (
                    <li key={i} className="text-xs text-amber-700">
                      <span className="font-medium">{s.name}</span> — {s.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <button
              onClick={handleClose}
              className="mt-6 w-full py-2.5 bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-bold rounded-lg transition-colors"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Store Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-transparent outline-none text-gray-900"
                placeholder="e.g. Joe's Corner Store"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-transparent outline-none text-gray-900 resize-none"
                rows={2}
                placeholder="What kind of store is this?"
              />
            </div>

            <div className="relative" ref={dropdownRef}>
              <label className="block text-sm font-medium text-gray-700 mb-1">Store Address *</label>
              <div className="relative">
                <input
                  type="text"
                  value={address}
                  onChange={(e) => handleAddressInput(e.target.value)}
                  onFocus={() => { if (geoResults.length > 0) setShowGeoDropdown(true); }}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-transparent outline-none text-gray-900 pr-10 ${locationConfirmed ? "border-green-400 bg-green-50" : "border-gray-300"}`}
                  placeholder="Start typing an address..."
                />
                {geoLoading && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="animate-spin h-4 w-4 border-2 border-yellow-500 border-t-transparent rounded-full" />
                  </div>
                )}
                {locationConfirmed && !geoLoading && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500 text-sm">
                    ✓
                  </div>
                )}
              </div>

              {/* Geocode dropdown */}
              {showGeoDropdown && geoResults.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {geoResults.map((r, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => selectGeoResult(r)}
                      className="w-full px-3 py-2 text-left text-sm text-gray-900 hover:bg-yellow-50 border-b border-gray-100 last:border-b-0 transition-colors"
                    >
                      <span className="line-clamp-2">{r.displayName}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Use current location button */}
              {!locationConfirmed && (
                <button
                  type="button"
                  onClick={useCurrentLocation}
                  className="mt-1.5 text-xs text-blue-600 hover:text-blue-800 hover:underline"
                >
                  Or use my current location
                </button>
              )}

              {/* Show resolved coordinates */}
              {locationConfirmed && lat !== null && lng !== null && (
                <p className="mt-1 text-xs text-gray-400">
                  {lat.toFixed(5)}, {lng.toFixed(5)}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Store Photos <span className="text-gray-400 font-normal">(optional — you can add these later)</span>
              </label>
              <div
                className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:border-yellow-400 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="text-3xl mb-1">📸</div>
                <p className="text-sm text-gray-600">Click to upload photos</p>
                <p className="text-xs text-gray-400 mt-1">Products will be automatically detected</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handlePhotos}
                className="hidden"
              />
              {previews.length > 0 && (
                <div className="mt-3 grid grid-cols-4 gap-2">
                  {previews.map((src, i) => (
                    <div key={i} className="relative group">
                      <img src={src} alt="" className="w-full aspect-square object-cover rounded-lg" />
                      <button
                        type="button"
                        onClick={() => removePhoto(i)}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        &times;
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting || !name || !locationConfirmed}
              className="w-full py-2.5 bg-yellow-400 hover:bg-yellow-500 disabled:bg-gray-200 disabled:text-gray-400 text-gray-900 font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <div className="animate-spin h-5 w-5 border-2 border-gray-900 border-t-transparent rounded-full" />
                  {photos.length > 0 ? "Scanning photos for products..." : "Creating store..."}
                </>
              ) : photos.length > 0 ? (
                "List Store & Scan Products"
              ) : (
                "List Store"
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
