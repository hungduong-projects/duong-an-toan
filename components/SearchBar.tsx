import React, { useState, useEffect, useRef } from 'react';
import { SearchResult } from '../types';
import { searchPlaces } from '../services/geoService';

interface SearchBarProps {
  onSelectLocation: (lat: number, lng: number, name: string) => void;
  placeholder?: string;
  initialValue?: string;
  className?: string;
  icon?: React.ReactNode;
}

const SearchBar: React.FC<SearchBarProps> = ({ 
  onSelectLocation, 
  placeholder = "Tìm địa điểm...", 
  initialValue = "",
  className = "",
  icon
}) => {
  const [query, setQuery] = useState(initialValue);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Update internal query if initialValue changes (e.g. selecting My Location)
  useEffect(() => {
    setQuery(initialValue);
  }, [initialValue]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(async () => {
      // Only search if query is different from initialValue (to avoid searching what we just selected)
      if (query && query.length >= 3 && query !== initialValue) {
        setLoading(true);
        const data = await searchPlaces(query);
        setResults(data);
        setLoading(false);
        setIsOpen(true);
      } else {
        setResults([]);
        setIsOpen(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [query, initialValue]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (item: SearchResult) => {
    const displayName = item.display_name.split(',')[0];
    setQuery(displayName); 
    setIsOpen(false);
    onSelectLocation(parseFloat(item.lat), parseFloat(item.lon), displayName);
  };

  return (
    <div ref={wrapperRef} className={`relative w-full pointer-events-auto ${className}`}>
      <div className="relative">
        <input
          type="text"
          className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (query.length >= 3) setIsOpen(true);
            // Select all text on focus for easy replacement
            (document.activeElement as HTMLInputElement)?.select();
          }}
        />
        <div className="absolute left-3 top-3 text-slate-400">
          {icon || (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          )}
        </div>
        {loading && (
           <div className="absolute right-3 top-3">
             <div className="animate-spin h-5 w-5 border-2 border-blue-500 rounded-full border-t-transparent"></div>
           </div>
        )}
      </div>

      {isOpen && results.length > 0 && (
        <ul className="absolute w-full mt-2 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 max-h-60 overflow-y-auto z-[2000]">
          {results.map((item) => (
            <li 
              key={item.place_id}
              onClick={() => handleSelect(item)}
              className="px-4 py-3 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer border-b border-slate-100 dark:border-slate-700 last:border-none text-sm text-slate-700 dark:text-slate-200"
            >
              {item.display_name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default SearchBar;