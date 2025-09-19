import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from 'sonner';
import { Navigation, X, MapPin, ExternalLink, Loader2 } from 'lucide-react';
import { extractUkPostcode } from '../utils/ukPostcode';

const DEFAULT_CENTER = { lat: 53.8, lng: -1.6 };

const normalizeLocation = (value) => {
  if (!value) {
    return { lat: null, lng: null, maps_link: '' };
  }

  const lat = value.lat !== undefined && value.lat !== null ? Number(value.lat) : null;
  const lng = value.lng !== undefined && value.lng !== null ? Number(value.lng) : null;

  return {
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
    maps_link: value.maps_link || ''
  };
};

const buildMapsLink = (lat, lng) => `https://www.google.com/maps?q=${lat},${lng}`;

const LocationPicker = ({
  isOpen,
  onClose,
  address = '',
  postcode = '',
  value,
  onChange
}) => {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markerRef = useRef(null);
  const previousValueRef = useRef(normalizeLocation(value));

  const [mapCenter, setMapCenter] = useState({ ...DEFAULT_CENTER });
  const [pendingLocation, setPendingLocation] = useState(() => normalizeLocation(value));
  const [mapLoading, setMapLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setPendingLocation(normalizeLocation(value));
    }
  }, [isOpen, value]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    previousValueRef.current = normalizeLocation(value);

    const locate = async () => {
      const normalized = normalizeLocation(value);
      const hasExisting = Number.isFinite(normalized.lat) && Number.isFinite(normalized.lng);

      const trimmedPostcode = postcode?.trim() || extractUkPostcode(address || '') || '';
      const trimmedAddress = address?.trim() || '';
      const query = trimmedPostcode || trimmedAddress;

      if (!query) {
        setMapCenter(hasExisting ? { lat: normalized.lat, lng: normalized.lng } : { ...DEFAULT_CENTER });
        setPendingLocation(normalized);
        return;
      }

      setMapLoading(true);

      try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=gb&limit=1`;
        const response = await fetch(url, { headers: { Accept: 'application/json' } });
        const results = await response.json();

        if (Array.isArray(results) && results.length > 0) {
          const located = {
            lat: parseFloat(results[0].lat),
            lng: parseFloat(results[0].lon)
          };
          const center = hasExisting ? { lat: normalized.lat, lng: normalized.lng } : located;
          setMapCenter(center);
          setPendingLocation(hasExisting ? normalized : { ...located, maps_link: buildMapsLink(located.lat, located.lng) });
          if (trimmedPostcode) {
            toast.success(`Located by postcode ${trimmedPostcode}. Drag the pin to refine.`);
          } else {
            toast.message('Located by address. Drag the pin to refine.');
          }
        } else {
          toast.error('Could not find that location. Drop a pin manually.');
          setMapCenter(hasExisting ? { lat: normalized.lat, lng: normalized.lng } : { ...DEFAULT_CENTER });
          setPendingLocation(hasExisting ? normalized : { lat: null, lng: null, maps_link: '' });
        }
      } catch (error) {
        toast.error('Geocoding failed. Drop a pin manually.');
        setMapCenter(hasExisting ? { lat: normalized.lat, lng: normalized.lng } : { ...DEFAULT_CENTER });
        setPendingLocation(hasExisting ? normalized : { lat: null, lng: null, maps_link: '' });
      } finally {
        setMapLoading(false);
      }
    };

    locate();
  }, [isOpen, address, postcode, value]);

  const handleSelection = useCallback((lat, lng) => {
    if (!mapInstance.current || !window?.L) {
      return;
    }

    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
    } else {
      markerRef.current = window.L.marker([lat, lng], { draggable: true }).addTo(mapInstance.current);
      markerRef.current.on('dragend', (event) => {
        const position = event.target.getLatLng();
        handleSelection(position.lat, position.lng);
      });
    }

    const roundedLat = Number(lat.toFixed(6));
    const roundedLng = Number(lng.toFixed(6));
    const maps_link = buildMapsLink(roundedLat, roundedLng);
    const next = { lat: roundedLat, lng: roundedLng, maps_link };

    setPendingLocation(next);
    onChange?.(next);
  }, [onChange]);

  useEffect(() => {
    if (!isOpen) {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
        markerRef.current = null;
      }
      return;
    }

    if (!mapRef.current || mapInstance.current || !window?.L) {
      return;
    }

    const map = window.L.map(mapRef.current).setView([mapCenter.lat, mapCenter.lng], 18);

    const satelliteLayer = window.L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
      id: 'satellite'
    });

    const streetLayer = window.L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles &copy; Esri &mdash; Source: Esri, DeLorme, NAVTEQ, USGS, Intermap, iPC, NRCAN, Esri Japan, METI, Esri China (Hong Kong), Esri (Thailand), TomTom',
      id: 'street'
    });

    const labelsLayer = window.L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Labels &copy; Esri',
      id: 'labels'
    });

    map._satelliteLayer = satelliteLayer;
    map._streetLayer = streetLayer;
    map._labelsLayer = labelsLayer;
    map._currentView = 'satellite';

    satelliteLayer.addTo(map);
    labelsLayer.addTo(map);

    const MapViewControl = window.L.Control.extend({
      onAdd: function (leafletMap) {
        const container = window.L.DomUtil.create('div', 'leaflet-bar leaflet-control');
        container.style.cssText = `
          background: var(--v3-bg-card);
          border: 1px solid var(--v3-border);
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
          overflow: hidden;
        `;

        const button = window.L.DomUtil.create('button', '', container);
        button.innerHTML = 'Street';
        button.style.cssText = `
          background: transparent;
          border: none;
          padding: 8px 12px;
          color: var(--v3-text-lightest);
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          min-width: 60px;
          min-height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
        `;

        button.onmouseover = function () {
          this.style.backgroundColor = 'var(--v3-orange)';
          this.style.color = 'white';
        };

        button.onmouseout = function () {
          this.style.backgroundColor = 'transparent';
          this.style.color = 'var(--v3-text-lightest)';
        };

        button.onclick = function (event) {
          event.preventDefault();
          event.stopPropagation();

          if (leafletMap._currentView === 'satellite') {
            leafletMap.removeLayer(leafletMap._satelliteLayer);
            leafletMap.removeLayer(leafletMap._labelsLayer);
            leafletMap._streetLayer.addTo(leafletMap);
            leafletMap._currentView = 'street';
            button.innerHTML = 'Satellite';
          } else {
            leafletMap.removeLayer(leafletMap._streetLayer);
            leafletMap._satelliteLayer.addTo(leafletMap);
            leafletMap._labelsLayer.addTo(leafletMap);
            leafletMap._currentView = 'satellite';
            button.innerHTML = 'Street';
          }
        };

        return container;
      }
    });

    const viewControl = new MapViewControl({ position: 'topright' });
    viewControl.addTo(map);

    mapInstance.current = map;

    map.on('click', (event) => {
      const { lat, lng } = event.latlng;
      handleSelection(lat, lng);
    });

    return () => {
      map.remove();
      mapInstance.current = null;
      markerRef.current = null;
    };
  }, [isOpen, mapCenter, handleSelection]);

  useEffect(() => {
    if (!isOpen || !mapInstance.current || !window?.L) {
      return;
    }

    mapInstance.current.setView([mapCenter.lat, mapCenter.lng], mapInstance.current.getZoom());

    if (!Number.isFinite(pendingLocation.lat) || !Number.isFinite(pendingLocation.lng)) {
      if (markerRef.current) {
        mapInstance.current.removeLayer(markerRef.current);
        markerRef.current = null;
      }
      return;
    }

    if (markerRef.current) {
      markerRef.current.setLatLng([pendingLocation.lat, pendingLocation.lng]);
    } else {
      markerRef.current = window.L.marker([pendingLocation.lat, pendingLocation.lng], { draggable: true }).addTo(mapInstance.current);
      markerRef.current.on('dragend', (event) => {
        const position = event.target.getLatLng();
        handleSelection(position.lat, position.lng);
      });
    }
  }, [mapCenter, pendingLocation, isOpen, handleSelection]);

  const handleCancel = () => {
    onChange?.(previousValueRef.current);
    setPendingLocation(previousValueRef.current);
    onClose?.();
  };

  const handleConfirm = () => {
    if (!Number.isFinite(pendingLocation.lat) || !Number.isFinite(pendingLocation.lng)) {
      toast.error('Drop a pin before confirming.');
      return;
    }

    onClose?.();
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(10, 10, 10, 0.85)' }}>
      <div className="w-full max-w-4xl h-[80vh] flex flex-col rounded-lg shadow-2xl" style={{ backgroundColor: 'var(--v3-bg-card)', border: '1px solid var(--v3-border)' }}>
        <div className="flex items-center justify-between p-4" style={{ borderBottom: '1px solid var(--v3-border)' }}>
          <div className="flex items-center gap-2">
            <Navigation className="w-5 h-5" style={{ color: 'var(--v3-orange)' }} />
            <h2 className="text-lg font-semibold" style={{ color: 'var(--v3-text-lightest)' }}>Select Entrance Location</h2>
          </div>
          <button
            type="button"
            onClick={handleCancel}
            className="p-2 rounded transition-colors"
            style={{ color: 'var(--v3-text-muted)' }}
            onMouseEnter={(event) => { event.target.style.backgroundColor = 'var(--v3-bg-dark)'; }}
            onMouseLeave={(event) => { event.target.style.backgroundColor = 'transparent'; }}
          >
            <X className="w-5 h-5" />
            <span className="sr-only">Close</span>
          </button>
        </div>

        <div className="p-4 space-y-3" style={{ borderBottom: '1px solid var(--v3-border)', backgroundColor: 'var(--v3-bg-dark)' }}>
          <p className="text-sm" style={{ color: 'var(--v3-text-muted)' }}>
            <strong style={{ color: 'var(--v3-orange)' }}>Address:</strong> {address || 'No address provided yet'}
          </p>
          <p className="text-xs" style={{ color: 'var(--v3-text-muted)' }}>
            Click on the map to mark the exact entrance location. Drag the pin to refine.
          </p>
          {mapLoading && (
            <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--v3-text-muted)' }}>
              <Loader2 className="h-4 w-4 animate-spin" /> Locating best starting point…
            </div>
          )}
          {Number.isFinite(pendingLocation.lat) && Number.isFinite(pendingLocation.lng) ? (
            <div className="flex flex-col gap-3 p-4 rounded-lg" style={{ backgroundColor: 'var(--v3-bg-card)', border: '1px solid var(--v3-orange)', boxShadow: '0 0 15px rgba(255, 87, 34, 0.2)' }}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--v3-orange)' }}>
                  <Navigation className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--v3-orange)' }}>Entrance location selected</p>
                  <p className="text-xs" style={{ color: 'var(--v3-text-muted)' }}>
                    Agents will receive this Google Maps link in their notification.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: 'var(--v3-bg-dark)', border: '1px solid var(--v3-border)' }}>
                <MapPin className="h-4 w-4" style={{ color: 'var(--v3-orange)' }} />
                <span className="text-sm" style={{ color: 'var(--v3-text-lightest)' }}>
                  Coordinates: {pendingLocation.lat.toFixed(6)}, {pendingLocation.lng.toFixed(6)}
                </span>
                <a
                  href={pendingLocation.maps_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto transition-colors"
                  style={{ color: 'var(--v3-orange)' }}
                  onMouseEnter={(event) => { event.target.style.color = 'var(--v3-orange-dark)'; }}
                  onMouseLeave={(event) => { event.target.style.color = 'var(--v3-orange)'; }}
                >
                  <ExternalLink className="h-4 w-4" />
                  <span className="sr-only">Open in Google Maps</span>
                </a>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-[var(--v3-border)] bg-[var(--v3-bg-card)] p-3">
              <p className="text-xs" style={{ color: 'var(--v3-text-muted)' }}>
                No pin selected yet. Drop a marker on the map to capture the precise entrance.
              </p>
            </div>
          )}
        </div>

        <div className="flex-1 relative">
          <div ref={mapRef} className="w-full h-full rounded-b-lg" style={{ minHeight: '400px' }} />
          <div className="absolute bottom-4 right-4 max-w-xs rounded-lg p-3" style={{ backgroundColor: 'var(--v3-bg-card)', border: '1px solid var(--v3-border)', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)' }}>
            <p className="text-xs" style={{ color: 'var(--v3-text-muted)' }}>
              Use the toggle to switch views. Click or drag the marker to set the entrance location.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 p-4" style={{ borderTop: '1px solid var(--v3-border)', backgroundColor: 'var(--v3-bg-dark)' }}>
          <button
            type="button"
            onClick={handleCancel}
            className="px-4 py-2 text-sm rounded-md border border-[var(--v3-border)] text-[var(--v3-text-light)] hover:bg-[var(--v3-bg-dark)] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="button-refresh px-4 py-2 text-sm font-semibold flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            disabled={!Number.isFinite(pendingLocation.lat) || !Number.isFinite(pendingLocation.lng)}
          >
            <Navigation className="h-4 w-4" />
            Use This Location
          </button>
        </div>
      </div>
    </div>
  );
};

export default LocationPicker;
