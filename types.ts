
export interface RadarFrame {
  path: string;
  time: number;
}

export interface UserLocation {
  lat: number;
  lng: number;
}

export type IntensityLevel = 'cap' | 'feble' | 'moderada' | 'forta' | 'molt forta';

export interface TimeSlot {
  time: number;
  intensity: IntensityLevel;
  label: string;
}

export interface DetailedPrediction {
  isRainingNow: boolean;
  willRainSoon: boolean;
  startTime: number | null;
  durationMins: number | null;
  maxIntensity: IntensityLevel;
  timeline: TimeSlot[];
}
