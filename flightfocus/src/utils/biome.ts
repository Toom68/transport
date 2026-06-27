// Biome detection from geographic coordinates.
// Uses latitude bands + rough bounding boxes for major geographic features.

export type Biome =
  | 'ocean'
  | 'coastal'
  | 'forest'
  | 'farmland'
  | 'mountain'
  | 'desert'
  | 'tundra'
  | 'tropical'
  | 'urban'
  | 'wetland'
  | 'airport';

export interface BiomeInfo {
  biome: Biome;
  // Human-readable label for UI
  label: string;
  // Base ground color (hex) for this biome
  groundColor: string;
  // Accent colors for terrain elements
  accentColor: string;
  // Whether this biome typically has water
  hasWater: boolean;
}

// Rough bounding boxes for major geographic features [minLat, maxLat, minLng, maxLng]
const DESERTS: [number, number, number, number][] = [
  // Sahara
  [15, 32, -17, 33],
  // Arabian
  [15, 32, 35, 60],
  // Gobi
  [38, 48, 75, 105],
  // Great Basin (US)
  [35, 45, -120, -110],
  // Sonoran
  [25, 35, -116, -106],
  // Australian Outback
  [-35, -20, 115, 145],
  // Kalahari
  [-30, -18, 15, 28],
  // Patagonian
  [-52, -38, -75, -60],
  // Namib
  [-30, -15, 10, 16],
  // Thar (India/Pakistan)
  [22, 30, 68, 76],
];

const MOUNTAINS: [number, number, number, number][] = [
  // Himalayas
  [26, 38, 70, 100],
  // Alps
  [43, 48, 5, 16],
  // Rockies (US/Canada)
  [35, 55, -125, -110],
  // Andes (rough)
  [-55, 5, -75, -65],
  // Caucasus
  [40, 44, 38, 50],
  // Atlas (North Africa)
  [30, 36, -8, 2],
  // Zagros (Iran)
  [27, 36, 47, 60],
  // Tian Shan
  [39, 46, 68, 85],
  // Japanese Alps
  [35, 41, 136, 142],
  // Southern Alps (NZ)
  [-47, -41, 166, 175],
  // Scandinavian
  [56, 72, 4, 32],
  // Sierra Nevada (US)
  [35, 42, -122, -117],
  // Appalachian
  [33, 47, -85, -75],
  // Great Dividing Range (Australia)
  [-40, -15, 145, 155],
  // Drakensberg (South Africa)
  [-32, -25, 25, 32],
];

const TROPICAL_FORESTS: [number, number, number, number][] = [
  // Amazon basin
  [-15, 5, -75, -45],
  // Congo basin
  [-5, 5, 10, 30],
  // Southeast Asia (Indonesia, Malaysia, PNG)
  [-10, 8, 95, 150],
  // Central America
  [8, 20, -95, -77],
  // Western Ghats (India)
  [8, 21, 73, 78],
];

const TUNDRA_REGIONS: [number, number, number, number][] = [
  // Arctic tundra (general)
  [66, 80, -180, 180],
  // Greenland
  [60, 82, -55, -20],
];

const MAJOR_OCEANS: [number, number, number, number][] = [
  // North Atlantic
  [0, 66, -70, -10],
  // South Atlantic
  [-60, 0, -70, 10],
  // North Pacific
  [0, 66, -180, -120],
  [20, 60, 120, 180],
  // South Pacific
  [-60, 0, -180, -75],
  [-60, 0, 150, 180],
  // Indian Ocean
  [-40, 20, 50, 100],
  // Southern Ocean
  [-80, -60, -180, 180],
  // Arctic Ocean
  [80, 90, -180, 180],
  // North Sea
  [55, 62, -5, 10],
  // Mediterranean
  [30, 46, -6, 36],
  // Caribbean
  [10, 25, -90, -60],
  // Black Sea
  [41, 47, 28, 42],
  // Caspian Sea
  [36, 47, 47, 55],
  // Red Sea
  [12, 30, 32, 44],
  // Baltic Sea
  [53, 66, 8, 30],
  // Bering Sea
  [52, 66, -180, -155],
  // Sea of Japan
  [35, 52, 128, 142],
  // South China Sea
  [-5, 25, 105, 120],
  // Coral Sea
  [-30, -10, 145, 165],
  // Tasman Sea
  [-45, -28, 145, 170],
  // Bay of Bengal
  [5, 22, 80, 95],
  // Arabian Sea
  [5, 25, 55, 75],
  // Gulf of Mexico
  [18, 30, -98, -80],
  // Hudson Bay
  [51, 63, -95, -75],
  // Norwegian Sea
  [58, 72, -10, 15],
  // Gulf of Guinea
  [-5, 5, -10, 15],
  // Great Australian Bight
  [-38, -31, 115, 140],
];

// Major urban areas (rough city centers with radius influence)
const URBAN_AREAS: { lat: number; lng: number; radius: number }[] = [
  { lat: 40.7, lng: -74.0, radius: 1.5 }, // New York
  { lat: 34.0, lng: -118.2, radius: 1.5 }, // Los Angeles
  { lat: 41.9, lng: -87.6, radius: 1.2 }, // Chicago
  { lat: 51.5, lng: -0.1, radius: 1.2 }, // London
  { lat: 48.9, lng: 2.3, radius: 1.2 }, // Paris
  { lat: 52.5, lng: 13.4, radius: 1.0 }, // Berlin
  { lat: 35.7, lng: 139.7, radius: 1.5 }, // Tokyo
  { lat: 22.3, lng: 114.2, radius: 1.0 }, // Hong Kong
  { lat: 1.3, lng: 103.8, radius: 0.8 }, // Singapore
  { lat: 19.1, lng: 72.9, radius: 1.2 }, // Mumbai
  { lat: 28.6, lng: 77.2, radius: 1.2 }, // Delhi
  { lat: 31.2, lng: 121.5, radius: 1.2 }, // Shanghai
  { lat: 39.9, lng: 116.4, radius: 1.2 }, // Beijing
  { lat: 37.5, lng: 127.0, radius: 1.0 }, // Seoul
  { lat: -33.9, lng: 151.2, radius: 1.0 }, // Sydney
  { lat: 25.2, lng: 55.3, radius: 1.0 }, // Dubai
  { lat: 55.8, lng: 37.6, radius: 1.5 }, // Moscow
  { lat: 41.0, lng: 28.9, radius: 1.0 }, // Istanbul
  { lat: 30.0, lng: 31.2, radius: 1.0 }, // Cairo
  { lat: -23.5, lng: -46.6, radius: 1.5 }, // São Paulo
  { lat: -34.6, lng: -58.4, radius: 1.2 }, // Buenos Aires
  { lat: 19.4, lng: -99.1, radius: 1.5 }, // Mexico City
  { lat: 43.7, lng: -79.4, radius: 1.2 }, // Toronto
  { lat: 49.3, lng: -123.1, radius: 1.0 }, // Vancouver
  { lat: 59.3, lng: 18.1, radius: 0.8 }, // Stockholm
  { lat: 59.9, lng: 10.8, radius: 0.8 }, // Oslo
  { lat: 60.2, lng: 24.9, radius: 0.8 }, // Helsinki
  { lat: 55.7, lng: 12.6, radius: 0.8 }, // Copenhagen
  { lat: 53.3, lng: -6.3, radius: 0.8 }, // Dublin
  { lat: 52.4, lng: 4.9, radius: 1.0 }, // Amsterdam
  { lat: 50.1, lng: 8.7, radius: 1.0 }, // Frankfurt
  { lat: 45.5, lng: 9.2, radius: 1.0 }, // Milan
  { lat: 41.9, lng: 12.5, radius: 1.0 }, // Rome
  { lat: 38.7, lng: -9.1, radius: 0.8 }, // Lisbon
  { lat: 40.4, lng: -3.7, radius: 1.0 }, // Madrid
  { lat: 41.0, lng: 29.0, radius: 1.5 }, // Istanbul wider
  { lat: 37.0, lng: -122.0, radius: 1.0 }, // SF Bay Area
  { lat: 47.6, lng: -122.3, radius: 1.0 }, // Seattle
  { lat: 29.8, lng: -95.4, radius: 1.2 }, // Houston
  { lat: 33.7, lng: -84.4, radius: 1.0 }, // Atlanta
  { lat: 25.8, lng: -80.2, radius: 1.0 }, // Miami
  { lat: 13.7, lng: 100.5, radius: 1.0 }, // Bangkok
  { lat: 14.6, lng: 121.0, radius: 1.0 }, // Manila
  { lat: -6.2, lng: 106.8, radius: 1.2 }, // Jakarta
  { lat: 3.1, lng: 101.7, radius: 1.0 }, // Kuala Lumpur
  { lat: 35.7, lng: 51.4, radius: 1.0 }, // Tehran
  { lat: 24.7, lng: 46.7, radius: 1.0 }, // Riyadh
  { lat: -1.3, lng: 36.8, radius: 1.0 }, // Nairobi
  { lat: -26.2, lng: 28.0, radius: 1.2 }, // Johannesburg
  { lat: 6.5, lng: 3.4, radius: 1.2 }, // Lagos
  { lat: 5.6, lng: -0.2, radius: 1.0 }, // Accra
  { lat: 33.9, lng: -118.4, radius: 1.5 }, // LA wider
];

function inBox(lat: number, lng: number, box: [number, number, number, number]): boolean {
  return lat >= box[0] && lat <= box[1] && lng >= box[2] && lng <= box[3];
}

function nearUrban(lat: number, lng: number): boolean {
  for (const u of URBAN_AREAS) {
    const dLat = lat - u.lat;
    const dLng = lng - u.lng;
    if (dLat * dLat + dLng * dLng < u.radius * u.radius) return true;
  }
  return false;
}

export function getBiome(lat: number, lng: number, airportCoords?: { lat: number; lng: number }[]): BiomeInfo {
  let biome: Biome = 'ocean';

  // Check airport proximity first — within ~0.3 deg of any airport
  if (airportCoords && airportCoords.length > 0) {
    for (const a of airportCoords) {
      const dLat = lat - a.lat;
      const dLng = lng - a.lng;
      if (dLat * dLat + dLng * dLng < 0.09) {
        biome = 'airport';
        return BIOME_INFO[biome];
      }
    }
  }

  // Check oceans first
  const isOcean = MAJOR_OCEANS.some((b) => inBox(lat, lng, b));

  if (isOcean) {
    biome = 'ocean';
  } else if (TUNDRA_REGIONS.some((b) => inBox(lat, lng, b))) {
    biome = 'tundra';
  } else if (DESERTS.some((b) => inBox(lat, lng, b))) {
    biome = 'desert';
  } else if (MOUNTAINS.some((b) => inBox(lat, lng, b))) {
    biome = 'mountain';
  } else if (TROPICAL_FORESTS.some((b) => inBox(lat, lng, b))) {
    biome = 'tropical';
  } else if (nearUrban(lat, lng)) {
    biome = 'urban';
  } else {
    // Latitude-based fallback
    const absLat = Math.abs(lat);
    if (absLat > 60) {
      biome = 'tundra';
    } else if (absLat > 45) {
      biome = 'forest';
    } else if (absLat > 23.5) {
      // Temperate — could be forest or farmland
      biome = Math.random() > 0.5 ? 'farmland' : 'forest';
    } else {
      biome = 'tropical';
    }
  }

  return BIOME_INFO[biome];
}

export function getBiomeAtProgress(
  lat: number,
  lng: number,
  progress: number,
  depLat: number,
  depLng: number,
  arrLat: number,
  arrLng: number
): BiomeInfo {
  // Use actual position for biome detection
  return getBiome(lat, lng);
}

export const BIOME_INFO: Record<Biome, BiomeInfo> = {
  ocean: {
    biome: 'ocean',
    label: 'Ocean',
    groundColor: '#1a4a6a',
    accentColor: '#2a6a8a',
    hasWater: true,
  },
  coastal: {
    biome: 'coastal',
    label: 'Coastline',
    groundColor: '#c4a878',
    accentColor: '#1a4a6a',
    hasWater: true,
  },
  forest: {
    biome: 'forest',
    label: 'Forest',
    groundColor: '#2d5a3d',
    accentColor: '#1a3a2a',
    hasWater: false,
  },
  farmland: {
    biome: 'farmland',
    label: 'Farmland',
    groundColor: '#7a9a5a',
    accentColor: '#8aaa6a',
    hasWater: false,
  },
  mountain: {
    biome: 'mountain',
    label: 'Mountains',
    groundColor: '#6a6a7a',
    accentColor: '#8a8a9a',
    hasWater: false,
  },
  desert: {
    biome: 'desert',
    label: 'Desert',
    groundColor: '#c4a060',
    accentColor: '#d4b070',
    hasWater: false,
  },
  tundra: {
    biome: 'tundra',
    label: 'Tundra',
    groundColor: '#c0c8d0',
    accentColor: '#a0a8b0',
    hasWater: false,
  },
  tropical: {
    biome: 'tropical',
    label: 'Tropical',
    groundColor: '#1a4a2a',
    accentColor: '#2a6a3a',
    hasWater: false,
  },
  urban: {
    biome: 'urban',
    label: 'City',
    groundColor: '#4a4a5a',
    accentColor: '#5a5a6a',
    hasWater: false,
  },
  wetland: {
    biome: 'wetland',
    label: 'Wetlands',
    groundColor: '#3a5a4a',
    accentColor: '#4a6a5a',
    hasWater: true,
  },
  airport: {
    biome: 'airport',
    label: 'Airport',
    groundColor: '#3a3a3e',
    accentColor: '#4a4a4e',
    hasWater: false,
  },
};
