
import React, { useState, useEffect, useCallback } from 'react';
import RadarMap from './components/RadarMap';
import PredictionPanel from './components/PredictionPanel';
import { UserLocation, RadarFrame, DetailedPrediction, TimeSlot, IntensityLevel } from './types';
import { fetchRadarMetadata, getTileCoords, analyzePixelAtPoint, getRadarTileUrl } from './services/radarService';
import { LocateFixed, Info, AlertCircle, Umbrella, Heart, Clock } from 'lucide-react';

const App: React.FC = () => {
  const [location, setLocation] = useState<UserLocation | null>(null);
  const [radarMetadata, setRadarMetadata] = useState<{ past: RadarFrame[], forecast: RadarFrame[], host: string } | null>(null);
  const [prediction, setPrediction] = useState<DetailedPrediction | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Rellotge de la capçalera (Hora Local Catalunya)
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const initData = async () => {
    try {
      const meta = await fetchRadarMetadata();
      setRadarMetadata(meta);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      setError("Error en carregar les dades del radar. Reintentant...");
    }
  };

  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {
          setLocation({ lat: 41.38, lng: 2.17 });
          setError("GPS no permès. Usant Barcelona com a referència.");
        },
        { enableHighAccuracy: true }
      );
    }
    initData();
    const interval = setInterval(initData, 5 * 60 * 1000); // Cada 5 minuts
    return () => clearInterval(interval);
  }, []);

  const generateForecast = useCallback(async () => {
    if (!location || !radarMetadata) return;

    setIsLoading(true);
    try {
      const zoom = 9;
      const { x, y } = getTileCoords(location.lat, location.lng, zoom);
      
      const framesToAnalyze = [
        ...radarMetadata.past.slice(-1),
        ...radarMetadata.forecast
      ];

      const timeline: TimeSlot[] = [];
      let maxIntensity: IntensityLevel = 'cap';
      let startTime: number | null = null;
      let rainFramesCount = 0;
      const nowTs = Date.now() / 1000;

      for (let i = 0; i < framesToAnalyze.length; i++) {
        const frame = framesToAnalyze[i];
        const tileUrlTemplate = getRadarTileUrl(radarMetadata.host, frame.path);
        const tileUrl = tileUrlTemplate.replace('{z}', zoom.toString()).replace('{x}', x.toString()).replace('{y}', y.toString());

        const intensity = await analyzePixelAtPoint(tileUrl, location.lat, location.lng, zoom);
        const minutesDiff = Math.round((frame.time - nowTs) / 60);
        
        let label = '';
        if (Math.abs(minutesDiff) < 5) label = 'Ara';
        else label = `${minutesDiff > 0 ? '+' : ''}${minutesDiff}m`;
        
        timeline.push({ time: frame.time, intensity, label });

        if (intensity !== 'cap') {
          if (startTime === null && frame.time > nowTs) startTime = frame.time;
          rainFramesCount++;
          const levels: IntensityLevel[] = ['cap', 'feble', 'moderada', 'forta', 'molt forta'];
          if (levels.indexOf(intensity) > levels.indexOf(maxIntensity)) maxIntensity = intensity;
        }
      }

      setPrediction({
        isRainingNow: timeline[0].intensity !== 'cap',
        willRainSoon: startTime !== null,
        startTime,
        durationMins: rainFramesCount * 10,
        maxIntensity,
        timeline
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [location, radarMetadata]);

  useEffect(() => {
    if (location && radarMetadata) generateForecast();
  }, [location, radarMetadata, generateForecast]);

  return (
    <div className="h-screen flex flex-col bg-slate-50 text-slate-900 font-sans overflow-hidden">
      <header className="shrink-0 p-4 border-b border-slate-200 bg-white z-[2000] flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-xl shadow-md rotate-3">
            <Umbrella className="text-white" size={24} />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tighter text-slate-800 leading-none">
              Em mullaré<span className="text-blue-600">?</span>
            </h1>
            <div className="flex items-center gap-1.5 mt-1">
               <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
               <span className="text-[10px] font-bold text-slate-400 uppercase tabular-nums">
                {currentTime.toLocaleTimeString('ca-ES', { 
                  hour: '2-digit', 
                  minute: '2-digit', 
                  second: '2-digit',
                  timeZone: 'Europe/Madrid'
                })}
               </span>
            </div>
          </div>
        </div>
        
        {location && (
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-full text-[10px] font-bold text-slate-500 border border-slate-200">
            <LocateFixed size={12} className="text-blue-500" />
            Ubicació detectada
          </div>
        )}
      </header>

      <main className="flex-1 flex flex-col lg:flex-row p-4 gap-4 overflow-hidden h-full">
        <div className="flex-[3] relative rounded-3xl overflow-hidden border border-slate-200 shadow-lg bg-white">
           <RadarMap location={location} radarMetadata={radarMetadata ? { frames: [...radarMetadata.past, ...radarMetadata.forecast], host: radarMetadata.host } : null} />
        </div>

        <div className="flex-1 lg:max-w-sm flex flex-col gap-4 overflow-y-auto pr-1 pb-4">
          {error && (
            <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl text-amber-700 text-[11px] font-medium flex gap-2">
              <AlertCircle size={16} className="shrink-0" />
              {error}
            </div>
          )}
          
          <PredictionPanel 
            prediction={prediction} 
            isLoading={isLoading}
            lastUpdated={lastUpdated}
          />

          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
              <Info size={14} /> Font de dades
            </h3>
            <div className="text-[11px] text-slate-500 leading-relaxed space-y-2">
              <p>Radar RainViewer sincronitzat amb el Servei Meteorològic de Catalunya (Meteocat).</p>
              <div className="flex items-center gap-2 pt-2 text-[9px] text-slate-400">
                <Clock size={12} /> Actualització cada 10 minuts oficialment.
              </div>
            </div>
          </div>

          <footer className="mt-auto py-4 flex flex-col items-center gap-2">
             <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Fet amb <Heart size={10} className="text-red-400 fill-red-400" /> a Catalunya
             </div>
          </footer>
        </div>
      </main>
    </div>
  );
};

export default App;
