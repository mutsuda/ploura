
import React from 'react';
import { CloudSun, Timer, Clock, Droplets, RefreshCw } from 'lucide-react';
import { DetailedPrediction, IntensityLevel } from '../types';

interface Props {
  prediction: DetailedPrediction | null;
  isLoading: boolean;
  lastUpdated: Date | null;
}

const IntensityInfo = ({ level }: { level: IntensityLevel }) => {
  const config = {
    cap: { label: 'Sense pluja', color: 'text-slate-500', bg: 'bg-slate-700/30' },
    feble: { label: 'Feble', color: 'text-blue-400', bg: 'bg-blue-500/20' },
    moderada: { label: 'Moderada', color: 'text-yellow-400', bg: 'bg-yellow-500/20' },
    forta: { label: 'Forta', color: 'text-orange-400', bg: 'bg-orange-500/20' },
    'molt forta': { label: 'Torrencial', color: 'text-red-400', bg: 'bg-red-500/20' },
  };
  const { label, color, bg } = config[level];
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${bg} ${color}`}>
      {label}
    </span>
  );
};

const PredictionPanel: React.FC<Props> = ({ prediction, isLoading, lastUpdated }) => {
  if (isLoading && !prediction) {
    return (
      <div className="bg-white border border-slate-200 rounded-3xl p-8 flex flex-col items-center justify-center gap-4 min-h-[400px]">
        <div className="relative">
            <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-500 rounded-full animate-spin" />
            <Droplets className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-blue-500 animate-pulse" />
        </div>
        <p className="text-slate-400 font-medium text-sm animate-pulse">Analitzant radar...</p>
      </div>
    );
  }

  if (!prediction) return null;

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          {prediction.isRainingNow ? <Droplets className="text-blue-500" /> : <CloudSun className="text-yellow-500" />}
          Propers 90 min
        </h2>
        {lastUpdated && (
           <div className="flex flex-col items-end">
             <div className="flex items-center gap-1 text-[9px] font-bold text-slate-400 uppercase">
                <RefreshCw size={10} className={isLoading ? 'animate-spin' : ''} />
                Actualitzat
             </div>
             <span className="text-[10px] font-black text-slate-500 tabular-nums">
                {lastUpdated.toLocaleTimeString('ca-ES', { hour: '2-digit', minute: '2-digit' })}
             </span>
           </div>
        )}
      </div>

      <div className="bg-slate-50 rounded-2xl border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center">
            <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                    <Timer size={12} /> Inici previst
                </p>
                <p className="text-xl font-black text-slate-800">
                    {prediction.isRainingNow ? 'JA PLOU' : 
                     prediction.willRainSoon ? `En ${Math.round((prediction.startTime! - Date.now()/1000)/60)} min` : 'Cap prevista'}
                </p>
            </div>
            {prediction.maxIntensity !== 'cap' && (
                <div className="text-right space-y-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Intensitat</p>
                    <IntensityInfo level={prediction.maxIntensity} />
                </div>
            )}
        </div>
        
        {prediction.durationMins ? (
            <div className="p-4 bg-blue-50/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Clock size={16} className="text-blue-500" />
                    <span className="text-xs text-slate-600 font-medium">Durada episodis</span>
                </div>
                <span className="text-sm font-bold text-blue-600">~{prediction.durationMins} min</span>
            </div>
        ) : (
            <div className="p-4 bg-slate-50 flex items-center justify-center">
                <span className="text-xs text-slate-400">Sense pluja a la vista</span>
            </div>
        )}
      </div>

      <div className="space-y-3">
        <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Evolució temporal</h3>
        <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2">
          {prediction.timeline.map((slot, i) => (
            <div key={i} className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                slot.intensity !== 'cap' ? 'bg-blue-50 border-blue-100' : 'bg-white border-slate-100'
            }`}>
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono font-bold text-slate-400 w-10">{slot.label}</span>
                <div className={`w-2 h-2 rounded-full ${slot.intensity === 'cap' ? 'bg-slate-200' : 'bg-blue-500'}`} />
              </div>
              <div className="flex flex-col items-end">
                <span className="text-[9px] text-slate-300 font-bold mb-0.5">
                    {new Date(slot.time * 1000).toLocaleTimeString('ca-ES', { hour: '2-digit', minute: '2-digit' })}
                </span>
                <IntensityInfo level={slot.intensity} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PredictionPanel;
