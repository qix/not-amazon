"use client";

import { useState, useRef } from "react";

interface StorePhotosModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPhotosAdded: () => void;
  store: { id: string; name: string } | null;
}

export default function StorePhotosModal({ isOpen, onClose, onPhotosAdded, store }: StorePhotosModalProps) {
  const [photos, setPhotos] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [result, setResult] = useState<{ productsDetected: number; products: Array<{ name: string; croppedImagePath: string }>; skipped?: Array<{ name: string; reason: string }> } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen || !store) return null;

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

  const handleSubmit = async () => {
    if (photos.length === 0) return;

    setSubmitting(true);
    setResult(null);

    const formData = new FormData();
    photos.forEach((photo) => formData.append("photos", photo));

    try {
      const res = await fetch(`/api/stores/${store.id}/photos`, { method: "POST", body: formData });
      const data = await res.json();
      setResult(data);
      onPhotosAdded();
    } catch (err) {
      console.error("Failed to upload photos:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleClearProducts = async () => {
    setClearing(true);
    try {
      await fetch(`/api/products?storeId=${encodeURIComponent(store.id)}`, { method: "DELETE" });
      onPhotosAdded();
      setConfirmClear(false);
    } catch (err) {
      console.error("Failed to clear products:", err);
    } finally {
      setClearing(false);
    }
  };

  const handleClose = () => {
    setPhotos([]);
    setPreviews([]);
    setResult(null);
    setConfirmClear(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50" onClick={handleClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Add Photos</h2>
            <p className="text-sm text-gray-500">{store.name}</p>
          </div>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>

        {result ? (
          <div className="p-6">
            <div className="text-center mb-4">
              <div className="text-5xl mb-2">✅</div>
              <h3 className="text-lg font-bold text-gray-900">Photos Added!</h3>
              <p className="text-sm text-gray-600 mt-1">
                {result.productsDetected} product{result.productsDetected !== 1 ? "s" : ""} detected
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
          <div className="p-6 space-y-4">
            <div>
              <div
                className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-yellow-400 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="text-4xl mb-2">📸</div>
                <p className="text-sm text-gray-600">Click to upload photos from inside the store</p>
                <p className="text-xs text-gray-400 mt-1">Products will be automatically detected and listed</p>
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
              onClick={handleSubmit}
              disabled={submitting || photos.length === 0}
              className="w-full py-2.5 bg-yellow-400 hover:bg-yellow-500 disabled:bg-gray-200 disabled:text-gray-400 text-gray-900 font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <div className="animate-spin h-5 w-5 border-2 border-gray-900 border-t-transparent rounded-full" />
                  Scanning photos for products...
                </>
              ) : (
                `Upload ${photos.length || ""} Photo${photos.length !== 1 ? "s" : ""} & Scan`
              )}
            </button>

            {/* Clear products */}
            <div className="pt-2 border-t border-gray-100">
              {confirmClear ? (
                <div className="flex items-center gap-2">
                  <p className="flex-1 text-xs text-red-600">Remove all products from this store?</p>
                  <button
                    onClick={handleClearProducts}
                    disabled={clearing}
                    className="px-3 py-1.5 text-xs font-medium bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors flex items-center gap-1"
                  >
                    {clearing && <div className="animate-spin h-3 w-3 border-2 border-white border-t-transparent rounded-full" />}
                    Confirm
                  </button>
                  <button
                    onClick={() => setConfirmClear(false)}
                    className="px-3 py-1.5 text-xs font-medium bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmClear(true)}
                  className="w-full py-2 text-xs font-medium text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                >
                  Clear All Products from This Store
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
