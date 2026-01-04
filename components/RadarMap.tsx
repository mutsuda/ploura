
import React, { useEffect, useRef, useState, useMemo } from 'react';
import { UserLocation, RadarFrame } from '../types';
import { getRadarTileUrl } from '../services/radarService';
import { Play, Pause, Clock } from 'lucide-react';
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
  
  const [progress, setProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isWaitState, setIsWaitState] = useState(false);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('ca-ES', { 
      hour: '2-digit', 
      minute: '2-digit', 
      timeZone: 'Europe/Madrid' 
    });
  };

  useEffect(() => {
    if (!mapRef.current) {
      mapRef.current = L.map('map-container', {
        center: [41.75, 1.8], 
        zoom: 8,
        zoomControl: false,
        fadeAnimation: false
      });
      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png').addTo(mapRef.current);
      L.control.zoom({ position: 'topright' }).addTo(mapRef.current);
    }
  }, []);

  useEffect(() => {
    if (!radarMetadata || !mapRef.current) return;
    
    // Netejar capes velles
    Object.values(layersRef.current).forEach(layer => mapRef.current?.removeLayer(layer));
    layersRef.current = {};
    
    // Carregar tots els frames (passat + futur)
    radarMetadata.frames.forEach((frame, idx) => {
      const url = getRadarTileUrl(radarMetadata.host, frame.path);
      const layer = L.tileLayer(url, { opacity: 0, zIndex: 200 + idx });
      if (mapRef.current) {
        layer.addTo(mapRef.current);
        layersRef.current[idx] = layer;
      }
    });
    
    // Només reiniciem si és la primera vegada que carreguem dades
    if (!isLoaded) setProgress(0);
    setIsLoaded(true);
  }, [radarMetadata, isLoaded]);

  // Gestió de l'opacitat per fer transicions suaus entre frames
  useEffect(() => {
    if (!isLoaded || !radarMetadata) return;
    const framesCount = radarMetadata.frames.length;
    const lowerIdx = Math.floor(progress) % framesCount;
    const upperIdx = (lowerIdx + 1) % framesCount;
    const ratio = progress % 1;

    (Object.entries(layersRef.current) as [string, L.TileLayer][]).forEach(([idxStr, layer]) => {
      const idx = parseInt(idxStr);
      if (idx === lowerIdx) layer.setOpacity(0.8 * (1 - ratio));
      else if (idx === upperIdx) layer.setOpacity(0.8 * ratio);
      else layer.setOpacity(0);
    });
  }, [progress, isLoaded, radarMetadata]);

  // Bucle d'animació
  useEffect(() => {
    if (!isPlaying || !radarMetadata || isWaitState) {
        if (requestRef.current) cancelAnimationFrame(requestRef.current);
        return;
    }
    let lastTime = performance.now();
    const framesCount = radarMetadata.frames.length;
    
    const animate = (time: number) => {
      const delta = time - lastTime;
      lastTime = time;
      
      // Velocitat: un frame sencer (1.0) cada 1200ms
      const increment = delta / 1200; 
      
      setProgress(prev => {
        let next = prev + increment;
        // Quan arribem a l'últim frame de la llista (que és el futur llunyà)
        if (next >= framesCount - 1) {
           setIsWaitState(true);
           setTimeout(() => {
             setIsWaitState(false);
             setProgress(0); // Torna al principi de tot (fa 2 hores)
           }, 2500); 
           return framesCount - 1;
        }
        return next;
      });
      requestRef.current = requestAnimationFrame(animate);
    };
    
    requestRef.current = requestAnimationFrame(animate);
    return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
  }, [isPlaying, radarMetadata, isWaitState]);

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

  const frameTime = useMemo(() => {
    if (!radarMetadata) return null;
    const idx = Math.min(Math.floor(progress), radarMetadata.frames.length - 1);
    const frame = radarMetadata.frames[idx];
    return frame ? new Date(frame.time * 1000) : null;
  }, [progress, radarMetadata]);

  const isFuture = useMemo(() => {
    if (!frameTime) return false;
    return frameTime.getTime() > (Date.now() - 300000);
  }, [frameTime]);

  const nowPercent = useMemo(() => {
    if (!radarMetadata) return 80;
    const nowTs = Date.now() / 1000;
    let nowIdx = 0;
    let minDiff = Infinity;
    radarMetadata.frames.forEach((f, i) => {
        const diff = Math.abs(f.time - nowTs);
        if (diff < minDiff) { minDiff = diff; nowIdx = i; }
    });
    return (nowIdx / (radarMetadata.frames.length - 1)) * 100;
  }, [radarMetadata]);

  return (
    <div className="relative w-full h-full rounded-3xl overflow-hidden shadow-2xl border border-slate-200 bg-slate-100 group">
      <style>{`
        .custom-slider {
          -webkit-appearance: none;
          width: 100%;
          background: transparent;
          margin: 0;
          cursor: pointer;
        }
        .custom-slider:focus { outline: none; }
        /* La boleta blava */
        .custom-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          height: 24px;
          width: 24px;
          border-radius: 50%;
          background: #2563eb;
          border: 3px solid white;
          box-shadow: 0 4px 10px rgba(0,0,0,0.2);
          margin-top: -8px; /* Això centra la boleta sobre el track */
          position: relative;
          z-index: 50;
        }
        .custom-slider::-moz-range-thumb {
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: #2563eb;
          border: 3px solid white;
          box-shadow: 0 4px 10px rgba(0,0,0,0.2);
        }
        /* El carril invisible que permet el moviment total */
        .custom-slider::-webkit-slider-runnable-track {
          width: 100%;
          height: 8px;
          background: transparent;
        }
      `}</style>

      <div id="map-container" className="absolute inset-0 w-full h-full" />
      
      {/* Indicador superior */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] w-[85%] max-w-[280px]">
        <div className={`bg-white/95 backdrop-blur-md px-4 py-3 rounded-2xl border shadow-xl flex items-center justify-between ${isFuture ? 'border-orange-400' : 'border-blue-200'}`}>
           <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${isFuture ? 'bg-orange-500 animate-pulse' : 'bg-blue-600'}`} />
              <div className="flex flex-col">
                <span className={`text-[8px] font-black uppercase tracking-widest leading-none ${isFuture ? 'text-orange-600' : 'text-slate-400'}`}>
                    {isFuture ? 'Previsió' : 'Observació'}
                </span>
                <span className="text-base font-black tabular-nums text-slate-800">
                    {frameTime ? formatTime(frameTime) : '--:--'}
                </span>
              </div>
           </div>
           {isWaitState && <div className="text-[10px] font-black text-slate-300 animate-pulse uppercase">Reiniciant</div>}
        </div>
      </div>

      {/* Barra de controls inferior */}
      <div className="absolute bottom-6 left-4 right-4 sm:left-6 sm:right-6 z-[1000]">
        <div className="bg-white/95 backdrop-blur-xl p-4 rounded-[2.5rem] border border-slate-200 shadow-2xl">
            <div className="flex items-center gap-4">
                <button 
                    onClick={() => { setIsPlaying(!isPlaying); setIsWaitState(false); }}
                    className="shrink-0 w-12 h-12 flex items-center justify-center rounded-2xl bg-slate-900 text-white shadow-lg active:scale-95 transition-transform"
                >
                    {isPlaying && !isWaitState ? <Pause size={24} fill="currentColor" /> : <Play size={24} className="ml-1" fill="currentColor" />}
                </button>

                <div className="flex-1 relative flex flex-col pt-4">
                    <div className="relative h-2 flex items-center">
                        {/* Fons del carril colors */}
                        <div className="absolute inset-0 h-2 bg-slate-100 rounded-full overflow-hidden flex">
                            <div className="h-full bg-blue-100" style={{ width: `${nowPercent}%` }} />
                            <div className="h-full bg-orange-100" style={{ width: `${100 - nowPercent}%` }} />
                        </div>

                        {/* Línia ARA */}
                        <div 
                            className="absolute top-[-10px] bottom-[-10px] w-[2px] bg-red-500 z-10 pointer-events-none"
                            style={{ left: `${nowPercent}%` }}
                        >
                            <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-red-600 text-[8px] text-white px-1.5 py-0.5 rounded-full font-black uppercase shadow-sm">Ara</div>
                        </div>

                        {/* EL SLIDER REAL (Transparent però actiu) */}
                        <input 
                            type="range" 
                            min="0" 
                            max={(radarMetadata?.frames.length || 1) - 1} 
                            step="0.01"
                            value={progress}
                            onChange={(e) => { 
                                setIsPlaying(false); 
                                setIsWaitState(false);
                                setProgress(parseFloat(e.target.value)); 
                            }}
                            className="custom-slider absolute inset-0 z-20"
                        />
                    </div>
                    
                    {/* Horaris inici/final */}
                    <div className="flex justify-between items-center mt-3 text-[10px] font-black text-slate-400 tabular-nums uppercase tracking-tighter">
                        <span>{radarMetadata ? formatTime(new Date(radarMetadata.frames[0].time * 1000)) : ''}</span>
                        <span className="text-orange-500">{radarMetadata ? formatTime(new Date(radarMetadata.frames[radarMetadata.frames.length - 1].time * 1000)) : ''}</span>
                    </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default RadarMap;
