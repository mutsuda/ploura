
import React, { useEffect, useRef, useState, useMemo } from 'react';
import { UserLocation, RadarFrame } from '../types';
import { getRadarTileUrl } from '../services/radarService';
import { Play, Pause, ChevronLeft, ChevronRight } from 'lucide-react';
import L from 'leaflet';

interface Props {
  location: UserLocation | null;
  radarMetadata: { frames: RadarFrame[], host: string } | null;
}

const RadarMap: React.FC<Props> = ({ location, radarMetadata }) => {
  const mapRef = useRef<L.Map | null>(null);
  const layersRef = useRef<Record<number, L.TileLayer>>({});
  const markerRef = useRef<L.Marker | null>(null);
  const requestRef = useRef<number>(null);
  
  // Fem servir un float (decimal) per al progrés del temps per permetre cross-fading
  const [progress, setProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);

  // 1. Inicialitzar mapa base
  useEffect(() => {
    if (!mapRef.current) {
      mapRef.current = L.map('map-container', {
        center: [41.75, 1.8], 
        zoom: 8,
        zoomControl: false,
        fadeAnimation: false // Desactivem animacions de Leaflet per tenir control total
      });

      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; CARTO'
      }).addTo(mapRef.current);

      L.control.zoom({ position: 'topright' }).addTo(mapRef.current);
    }
  }, []);

  // 2. Gestionar capes de radar (Buffer)
  useEffect(() => {
    if (!radarMetadata || !mapRef.current) return;

    // Neteja profunda
    Object.values(layersRef.current).forEach(layer => mapRef.current?.removeLayer(layer));
    layersRef.current = {};

    radarMetadata.frames.forEach((frame, idx) => {
      const url = getRadarTileUrl(radarMetadata.host, frame.path);
      const layer = L.tileLayer(url, {
        opacity: 0,
        zIndex: 200 + idx,
        className: 'radar-layer'
      });
      
      if (mapRef.current) {
        layer.addTo(mapRef.current);
        layersRef.current[idx] = layer;
      }
    });

    setIsLoaded(true);
  }, [radarMetadata]);

  // 3. Motor de fusió (Cross-fading) per a moviment lineal
  useEffect(() => {
    if (!isLoaded || !radarMetadata) return;
    
    const framesCount = radarMetadata.frames.length;
    const lowerIdx = Math.floor(progress);
    const upperIdx = (lowerIdx + 1) % framesCount;
    const ratio = progress % 1; // El decimal indica quan "a prop" estem del següent frame

    (Object.entries(layersRef.current) as [string, L.TileLayer][]).forEach(([idxStr, layer]) => {
      const idx = parseInt(idxStr);
      if (idx === lowerIdx) {
        // El frame actual va desapareixent
        layer.setOpacity(0.85 * (1 - ratio));
      } else if (idx === upperIdx) {
        // El frame següent va apareixent
        layer.setOpacity(0.85 * ratio);
      } else {
        // Tota la resta, invisibles
        layer.setOpacity(0);
      }
    });
  }, [progress, isLoaded, radarMetadata]);

  // 4. Animació suau frame a frame
  useEffect(() => {
    if (!isPlaying || !radarMetadata) {
        if (requestRef.current) cancelAnimationFrame(requestRef.current);
        return;
    }
    
    let lastTime = performance.now();
    const framesCount = radarMetadata.frames.length;

    const animate = (time: number) => {
      const delta = time - lastTime;
      lastTime = time;
      
      // Velocitat de l'animació: volem que cada frame duri ~800ms
      const increment = delta / 800; 
      
      setProgress(prev => (prev + increment) % framesCount);
      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);
    return () => {
        if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isPlaying, radarMetadata]);

  // 5. Marcador de posició
  useEffect(() => {
    if (mapRef.current && location) {
      if (!markerRef.current) {
        markerRef.current = L.marker([location.lat, location.lng], {
          icon: L.divIcon({
            className: 'custom-div-icon',
            html: "<div style='background-color:#3b82f6; width:16px; height:16px; border-radius:50%; border:3px solid white; box-shadow: 0 0 20px rgba(59,130,246,0.6);'></div>",
            iconSize: [16, 16],
            iconAnchor: [8, 8]
          })
        }).addTo(mapRef.current);
      } else {
        markerRef.current.setLatLng([location.lat, location.lng]);
      }
    }
  }, [location]);

  const togglePlay = () => setIsPlaying(!isPlaying);
  
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsPlaying(false);
    setProgress(parseFloat(e.target.value));
  };

  const currentTimeLabel = useMemo(() => {
    if (!radarMetadata || !radarMetadata.frames[Math.floor(progress)]) return '--:--';
    return new Date(radarMetadata.frames[Math.floor(progress)].time * 1000).toLocaleTimeString('ca-ES', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  }, [progress, radarMetadata]);

  return (
    <div className="relative w-full h-full rounded-3xl overflow-hidden shadow-2xl border border-slate-200 bg-slate-100 group">
      <div id="map-container" className="absolute inset-0 w-full h-full" />
      
      {/* Overlay Superior */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000]">
        <div className="bg-white/95 backdrop-blur-md px-5 py-2 rounded-full border border-slate-200 shadow-xl flex items-center gap-3">
           <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${Math.floor(progress) >= (radarMetadata?.frames.length || 10) - 10 ? 'bg-orange-500' : 'bg-blue-500'}`} />
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-tight">
                {Math.floor(progress) >= (radarMetadata?.frames.length || 10) - 10 ? 'PROPERES HORES' : 'ANTERIORS'}
              </span>
           </div>
           <div className="w-px h-3 bg-slate-200" />
           <span className="text-sm font-black text-slate-800 tabular-nums">
            {currentTimeLabel}
           </span>
        </div>
      </div>

      {/* Control Scrubber Lineal */}
      <div className="absolute bottom-6 left-6 right-6 z-[1000]">
        <div className="bg-white/95 backdrop-blur-lg p-4 rounded-3xl border border-slate-200 shadow-2xl flex items-center gap-5">
            <button 
                onClick={togglePlay}
                className="w-12 h-12 flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white rounded-2xl transition-all shadow-lg active:scale-95"
            >
                {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} className="ml-1" fill="currentColor" />}
            </button>

            <div className="flex-1 flex flex-col gap-1">
                <input 
                    type="range" 
                    min="0" 
                    max={(radarMetadata?.frames.length || 1) - 1.01} 
                    step="0.01" // Pas decimal per a moviment lineal
                    value={progress}
                    onChange={handleSliderChange}
                    className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
                <div className="flex justify-between px-1">
                    <span className="text-[9px] font-bold text-slate-400">FA 2H</span>
                    <span className="text-[9px] font-bold text-slate-600">ARA</span>
                    <span className="text-[9px] font-bold text-slate-400">PREVISIÓ</span>
                </div>
            </div>

            <div className="hidden md:flex flex-col items-end">
                <div className="flex items-center gap-1 text-[9px] font-black text-slate-400 uppercase tracking-tighter">
                   <MapIcon size={12} /> Mode Relleu
                </div>
            </div>
        </div>
      </div>

      {/* Llegenda estilitzada */}
      <div className="absolute top-20 left-4 z-[1000] bg-white/90 backdrop-blur-md p-3 rounded-2xl border border-slate-200 shadow-sm hidden sm:block">
        <div className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mb-2 border-b border-slate-100 pb-1">Precipitació</div>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-[#00ff00] shadow-sm" /> <span className="text-[10px] text-slate-600 font-medium">Feble</span></div>
          <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-[#ffff00] shadow-sm" /> <span className="text-[10px] text-slate-600 font-medium">Mod.</span></div>
          <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-[#ff0000] shadow-sm" /> <span className="text-[10px] text-slate-600 font-medium">Forta</span></div>
        </div>
      </div>
    </div>
  );
};

// Icona auxiliar per al component
const MapIcon = ({ size }: { size: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" /><line x1="9" y1="3" x2="9" y2="18" /><line x1="15" y1="6" x2="15" y2="21" /></svg>
);

export default RadarMap;
