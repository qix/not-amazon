"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import ProductSidebar from "@/components/ProductSidebar";
import AddStoreModal from "@/components/AddStoreModal";
import StorePhotosModal from "@/components/StorePhotosModal";

const Map = dynamic(() => import("@/components/Map"), { ssr: false });

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

export default function Home() {
  const [userLocation, setUserLocation] = useState<[number, number]>([40.7128, -74.006]); // NYC default
  const [stores, setStores] = useState<Store[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showAddStore, setShowAddStore] = useState(false);
  const [hoveredStoreId, setHoveredStoreId] = useState<string | null>(null);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [locationLoaded, setLocationLoaded] = useState(false);
  const [photosStore, setPhotosStore] = useState<{ id: string; name: string } | null>(null);
  const [amazonProduct, setAmazonProduct] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

  // Get user location
  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLocation([pos.coords.latitude, pos.coords.longitude]);
          setLocationLoaded(true);
        },
        () => setLocationLoaded(true),
        { enableHighAccuracy: true }
      );
    } else {
      setLocationLoaded(true);
    }
  }, []);

  // Fetch stores
  const fetchStores = useCallback(async () => {
    try {
      const res = await fetch("/api/stores");
      const data = await res.json();
      setStores(data);
    } catch (err) {
      console.error("Failed to fetch stores:", err);
    }
  }, []);

  // Search products
  const searchProducts = useCallback(
    async (q: string) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          q,
          lat: userLocation[0].toString(),
          lng: userLocation[1].toString(),
        });
        const res = await fetch(`/api/search?${params}`);
        const data = await res.json();
        setProducts(data);
      } catch (err) {
        console.error("Failed to search:", err);
      } finally {
        setLoading(false);
      }
    },
    [userLocation]
  );

  useEffect(() => {
    fetchStores();
    searchProducts("");
  }, [fetchStores, searchProducts]);

  const isAmazonUrl = (text: string): boolean => {
    try {
      const url = new URL(text.trim());
      return /^(www\.)?amazon\.(com|co\.uk|ca|de|fr|it|es|co\.jp|com\.au|in|com\.br|nl|se|pl|com\.mx|sg|ae|sa|eg|com\.tr)$/.test(url.hostname);
    } catch {
      return false;
    }
  };

  const resolveAmazonUrl = useCallback(async (url: string) => {
    setLoading(true);
    setAmazonProduct(null);
    try {
      const res = await fetch(`/api/amazon?url=${encodeURIComponent(url.trim())}`);
      const data = await res.json();
      if (data.productName) {
        setAmazonProduct(data.productName);
        // Search with progressively broader terms until we get results
        for (const term of data.searchTerms) {
          setQuery(term);
          const params = new URLSearchParams({
            q: term,
            lat: userLocation[0].toString(),
            lng: userLocation[1].toString(),
          });
          const searchRes = await fetch(`/api/search?${params}`);
          const products = await searchRes.json();
          if (products.length > 0) {
            setProducts(products);
            setLoading(false);
            return;
          }
        }
        // No results for any term — show empty with the full product name as query
        setQuery(data.productName);
        setProducts([]);
      } else {
        // Couldn't extract product name, search with URL as-is
        setQuery(url);
        searchProducts(url);
      }
    } catch (err) {
      console.error("Failed to resolve Amazon URL:", err);
      setQuery(url);
      searchProducts(url);
    } finally {
      setLoading(false);
    }
  }, [userLocation, searchProducts]);

  const handleSearchInput = (value: string) => {
    setSearchInput(value);
    setAmazonProduct(null);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    // Don't live-search if it looks like they're pasting a URL
    if (isAmazonUrl(value)) return;
    searchTimeout.current = setTimeout(() => {
      setQuery(value);
      searchProducts(value);
    }, 300);
  };

  const deleteProduct = useCallback(async (id: string) => {
    try {
      await fetch(`/api/products?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      setProducts((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      console.error("Failed to delete product:", err);
    }
  }, []);

  const clearAllProducts = useCallback(async () => {
    try {
      await fetch("/api/products?all=true", { method: "DELETE" });
      setProducts([]);
    } catch (err) {
      console.error("Failed to clear products:", err);
    }
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (isAmazonUrl(searchInput)) {
      resolveAmazonUrl(searchInput);
    } else {
      setAmazonProduct(null);
      setQuery(searchInput);
      searchProducts(searchInput);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <header className="bg-gray-900 text-white z-[500] relative">
        <div className="flex items-center gap-2 sm:gap-4 px-3 sm:px-4 h-14">
          {/* Sidebar toggle (mobile) */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden flex-shrink-0 p-1.5 rounded hover:bg-gray-700 transition-colors"
            aria-label="Toggle sidebar"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {sidebarOpen
                ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              }
            </svg>
          </button>

          {/* Logo */}
          <a href="/" className="flex items-center gap-1.5 flex-shrink-0">
            <span className="text-lg sm:text-xl font-bold tracking-tight">
              <span className="text-yellow-400">Not</span> Amazon
              <span className="text-yellow-400">.com</span>
            </span>
          </a>

          {/* Search */}
          <form onSubmit={handleSearchSubmit} className="flex-1 max-w-2xl flex min-w-0">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => handleSearchInput(e.target.value)}
              placeholder="Search or paste Amazon link..."
              className="flex-1 min-w-0 px-3 sm:px-4 py-1.5 rounded-l-lg bg-gray-100 text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
            />
            <button
              type="submit"
              className="px-3 sm:px-5 py-1.5 bg-yellow-400 hover:bg-yellow-500 text-gray-900 rounded-r-lg font-medium text-sm transition-colors flex-shrink-0"
            >
              Search
            </button>
          </form>

          {/* Import List */}
          <a
            href="/list"
            className="hidden sm:inline-flex px-4 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium text-sm transition-colors flex-shrink-0"
          >
            Import Amazon List
          </a>

          {/* Add Store */}
          <button
            onClick={() => setShowAddStore(true)}
            className="hidden sm:inline-flex items-center gap-1.5 px-4 py-1.5 bg-yellow-400 hover:bg-yellow-500 text-gray-900 rounded-lg font-semibold text-sm transition-colors flex-shrink-0"
          >
            + List a Store
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Sidebar backdrop (mobile) */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/40 z-[400] lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <div
          className={`
            fixed inset-y-0 left-0 top-14 z-[401] w-80 sm:w-96 border-r border-gray-200 bg-white
            transform transition-transform duration-200 ease-in-out
            lg:relative lg:top-0 lg:z-auto lg:translate-x-0 lg:flex-shrink-0
            ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
          `}
        >
          <ProductSidebar
            products={products}
            stores={stores}
            query={query}
            loading={loading}
            amazonProduct={amazonProduct}
            selectedStoreId={selectedStoreId}
            onStoreHover={setHoveredStoreId}
            onStoreSelect={(id) => { setSelectedStoreId(id); }}
            onDeleteProduct={deleteProduct}
            onClearAll={clearAllProducts}
            onStoreUpdated={fetchStores}
          />
        </div>

        {/* Map */}
        <div className="flex-1 relative">
          {locationLoaded && (
            <Map
              center={userLocation}
              stores={stores}
              selectedStoreId={hoveredStoreId || selectedStoreId}
              onStoreClick={(store) => {
                setPhotosStore({ id: store.id, name: store.name });
              }}
            />
          )}

          {/* Mobile action buttons (visible when sidebar is closed) */}
          <div className="absolute bottom-4 left-4 right-4 flex gap-2 sm:hidden z-[300]">
            <a
              href="/list"
              className="flex-1 py-2.5 bg-gray-700 text-white rounded-lg font-medium text-sm text-center shadow-lg"
            >
              Import List
            </a>
            <button
              onClick={() => setShowAddStore(true)}
              className="flex-1 py-2.5 bg-yellow-400 text-gray-900 rounded-lg font-semibold text-sm shadow-lg"
            >
              + Add Store
            </button>
          </div>
        </div>
      </div>

      {/* Add Store Modal */}
      <AddStoreModal
        isOpen={showAddStore}
        onClose={() => setShowAddStore(false)}
        onStoreAdded={() => {
          fetchStores();
          searchProducts(query);
        }}
        userLocation={userLocation}
      />

      {/* Add Photos to Store Modal */}
      <StorePhotosModal
        isOpen={!!photosStore}
        onClose={() => setPhotosStore(null)}
        onPhotosAdded={() => {
          searchProducts(query);
        }}
        store={photosStore}
      />
    </div>
  );
}
