
import { RadarFrame, IntensityLevel } from '../types';

export const fetchRadarMetadata = async (): Promise<{ past: RadarFrame[], forecast: RadarFrame[], host: string }> => {
  const response = await fetch('https://api.rainviewer.com/public/weather-maps.json');
  const data = await response.json();
  
  const past = data.radar.past.map((frame: any) => ({
    path: frame.path.toString(),
    time: frame.time
  }));

  const forecast = data.radar.nowcast.map((frame: any) => ({
    path: frame.path.toString(),
    time: frame.time
  }));

  return { past, forecast, host: data.host };
};

export const getTileCoords = (lat: number, lng: number, zoom: number) => {
  const x = Math.floor((lng + 180) / 360 * Math.pow(2, zoom));
  const y = Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom));
  return { x, y };
};

/**
 * Retorna la URL per a les teules del radar.
 * Utilitzem l'esquema de colors 1 (vibrant) i suavitzat 1 per a transicions millors.
 */
export const getRadarTileUrl = (host: string, path: string): string => {
  return `${host}/v2/radar/${path}/256/{z}/{x}/{y}/1/1_1.png`;
};

/**
 * Mapeja el color del radar a un nivell d'intensitat.
 */
const getColorIntensity = (r: number, g: number, b: number, a: number): IntensityLevel => {
  if (a < 10) return 'cap';
  
  // Esquema vibrant RainViewer
  if (r > 180 && g < 100) return 'forta';
  if (r > 180 && g > 150 && b < 100) return 'moderada';
  if (g > 100 || b > 150) return 'feble';
  
  return 'cap';
};

export const analyzePixelAtPoint = async (url: string, lat: number, lng: number, zoom: number): Promise<IntensityLevel> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = url;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return resolve('cap');

      ctx.drawImage(img, 0, 0);

      const worldCoordX = (lng + 180) / 360 * Math.pow(2, zoom);
      const worldCoordY = (1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom);
      
      const pixelX = Math.floor((worldCoordX % 1) * 256);
      const pixelY = Math.floor((worldCoordY % 1) * 256);

      try {
        const pixel = ctx.getImageData(pixelX, pixelY, 1, 1).data;
        resolve(getColorIntensity(pixel[0], pixel[1], pixel[2], pixel[3]));
      } catch (e) {
        resolve('cap');
      }
    };
    img.onerror = () => resolve('cap');
  });
};
