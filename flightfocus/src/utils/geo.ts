import type { Airport } from '@/types/airport';
import type { Place } from '@/types/place';

export type Continent =
  | 'North America'
  | 'South America'
  | 'Europe'
  | 'Asia'
  | 'Africa'
  | 'Oceania';

// Country -> continent map covering every country in the airport dataset.
const COUNTRY_CONTINENT: Record<string, Continent> = {
  'United States': 'North America',
  'Canada': 'North America',
  'Mexico': 'North America',
  'Brazil': 'South America',
  'Argentina': 'South America',
  'Chile': 'South America',
  'Colombia': 'South America',
  'Peru': 'South America',
  'United Kingdom': 'Europe',
  'France': 'Europe',
  'Netherlands': 'Europe',
  'Germany': 'Europe',
  'Spain': 'Europe',
  'Italy': 'Europe',
  'Switzerland': 'Europe',
  'Portugal': 'Europe',
  'Ireland': 'Europe',
  'Austria': 'Europe',
  'Norway': 'Europe',
  'Sweden': 'Europe',
  'Denmark': 'Europe',
  'Finland': 'Europe',
  'Poland': 'Europe',
  'Czech Republic': 'Europe',
  'Greece': 'Europe',
  'Russia': 'Europe',
  'Turkey': 'Asia',
  'China': 'Asia',
  'Japan': 'Asia',
  'Singapore': 'Asia',
  'South Korea': 'Asia',
  'Qatar': 'Asia',
  'Thailand': 'Asia',
  'Malaysia': 'Asia',
  'India': 'Asia',
  'United Arab Emirates': 'Asia',
  'Saudi Arabia': 'Asia',
  'Taiwan': 'Asia',
  'Philippines': 'Asia',
  'Indonesia': 'Asia',
  'Sri Lanka': 'Asia',
  'Bangladesh': 'Asia',
  'Nepal': 'Asia',
  'Vietnam': 'Asia',
  'Myanmar': 'Asia',
  'Cambodia': 'Asia',
  'South Africa': 'Africa',
  'Egypt': 'Africa',
  'Kenya': 'Africa',
  'Ethiopia': 'Africa',
  'Nigeria': 'Africa',
  'Morocco': 'Africa',
  'Australia': 'Oceania',
  'New Zealand': 'Oceania',
  // Additional countries for cities/ports
  'Belgium': 'Europe',
  'Hungary': 'Europe',
  'Romania': 'Europe',
  'Bulgaria': 'Europe',
  'Serbia': 'Europe',
  'Croatia': 'Europe',
  'Slovenia': 'Europe',
  'Slovakia': 'Europe',
  'Lithuania': 'Europe',
  'Latvia': 'Europe',
  'Estonia': 'Europe',
  'Iceland': 'Europe',
  'Luxembourg': 'Europe',
  'Malta': 'Europe',
  'Cyprus': 'Asia',
  'Lebanon': 'Asia',
  'Israel': 'Asia',
  'Jordan': 'Asia',
  'Iraq': 'Asia',
  'Iran': 'Asia',
  'Kuwait': 'Asia',
  'Bahrain': 'Asia',
  'Oman': 'Asia',
  'Yemen': 'Asia',
  'Pakistan': 'Asia',
  'Kazakhstan': 'Asia',
  'Uzbekistan': 'Asia',
  'Mongolia': 'Asia',
  'Georgia': 'Asia',
  'Armenia': 'Asia',
  'Azerbaijan': 'Asia',
  'Laos': 'Asia',
  'Maldives': 'Asia',
  'Bhutan': 'Asia',
  'Brunei': 'Asia',
  'Timor-Leste': 'Asia',
  'Afghanistan': 'Asia',
  'Syria': 'Asia',
  'Palestine': 'Asia',
  'Tunisia': 'Africa',
  'Algeria': 'Africa',
  'Libya': 'Africa',
  'Sudan': 'Africa',
  'South Sudan': 'Africa',
  'Ghana': 'Africa',
  'Senegal': 'Africa',
  'Ivory Coast': 'Africa',
  'Cameroon': 'Africa',
  'Uganda': 'Africa',
  'Tanzania': 'Africa',
  'Zimbabwe': 'Africa',
  'Zambia': 'Africa',
  'Botswana': 'Africa',
  'Namibia': 'Africa',
  'Mozambique': 'Africa',
  'Madagascar': 'Africa',
  'Mauritius': 'Africa',
  'Seychelles': 'Africa',
  'Rwanda': 'Africa',
  'Burundi': 'Africa',
  'Djibouti': 'Africa',
  'Eritrea': 'Africa',
  'Somalia': 'Africa',
  'Mali': 'Africa',
  'Chad': 'Africa',
  'Niger': 'Africa',
  'Burkina Faso': 'Africa',
  'Benin': 'Africa',
  'Togo': 'Africa',
  'Sierra Leone': 'Africa',
  'Liberia': 'Africa',
  'Guinea': 'Africa',
  'Angola': 'Africa',
  'Congo': 'Africa',
  'DR Congo': 'Africa',
  'Gabon': 'Africa',
  'Equatorial Guinea': 'Africa',
  'Western Sahara': 'Africa',
  // Americas
  'Uruguay': 'South America',
  'Paraguay': 'South America',
  'Bolivia': 'South America',
  'Ecuador': 'South America',
  'Venezuela': 'South America',
  'Guyana': 'South America',
  'Suriname': 'South America',
  'Costa Rica': 'North America',
  'Panama': 'North America',
  'Guatemala': 'North America',
  'Honduras': 'North America',
  'Nicaragua': 'North America',
  'El Salvador': 'North America',
  'Belize': 'North America',
  'Cuba': 'North America',
  'Jamaica': 'North America',
  'Haiti': 'North America',
  'Dominican Republic': 'North America',
  'Bahamas': 'North America',
  'Barbados': 'North America',
  'Trinidad and Tobago': 'North America',
  'Dominica': 'North America',
  'Grenada': 'North America',
  'Saint Lucia': 'North America',
  'Saint Vincent and the Grenadines': 'North America',
  'Antigua and Barbuda': 'North America',
  'Saint Kitts and Nevis': 'North America',
  // Oceania
  'Fiji': 'Oceania',
  'Vanuatu': 'Oceania',
  'Samoa': 'Oceania',
  'Tonga': 'Oceania',
  'Kiribati': 'Oceania',
  'Tuvalu': 'Oceania',
  'Nauru': 'Oceania',
  'Palau': 'Oceania',
  'Micronesia': 'Oceania',
  'Marshall Islands': 'Oceania',
  'Solomon Islands': 'Oceania',
  'New Caledonia': 'Oceania',
  'French Polynesia': 'Oceania',
  'Réunion': 'Africa',
  // Territories
  'Puerto Rico': 'North America',
  'Greenland': 'North America',
  'Cayman Islands': 'North America',
  'Bermuda': 'North America',
  'Aruba': 'North America',
  'Curaçao': 'North America',
  'Sint Maarten': 'North America',
  'Turks and Caicos Islands': 'North America',
  'British Virgin Islands': 'North America',
  'US Virgin Islands': 'North America',
  'Northern Mariana Islands': 'Oceania',
  'Guam': 'Oceania',
  'American Samoa': 'Oceania',
};

// Coordinate-based fallback for any country not explicitly mapped.
function continentFromCoords(lat: number, lng: number): Continent {
  if (lat > 12 && lng > -30 && lng < 45 && lat < 72) return 'Europe';
  if (lat <= 12 && lat > -38 && lng > -20 && lng < 52) return 'Africa';
  if (lng >= 45 && lng <= 180 && lat > -12) return 'Asia';
  if (lat <= -10 && lng >= 110) return 'Oceania';
  if (lng < -30 && lat < 13) return 'South America';
  return 'North America';
}

export function getContinent(airport: Airport | Place): Continent {
  return COUNTRY_CONTINENT[airport.country] ?? continentFromCoords(airport.lat, airport.lng);
}

export function getPlaceContinent(place: Place): Continent {
  return COUNTRY_CONTINENT[place.country] ?? continentFromCoords(place.lat, place.lng);
}

export const ALL_CONTINENTS: Continent[] = [
  'North America',
  'South America',
  'Europe',
  'Asia',
  'Africa',
  'Oceania',
];

// Maps a continent to the achievement id used in achievements.ts
export const CONTINENT_ACHIEVEMENT: Record<Continent, string> = {
  'Europe': 'continent_eu',
  'Asia': 'continent_as',
  'Oceania': 'continent_oc',
  'Africa': 'continent_af',
  'South America': 'continent_sa',
  'North America': 'continent_na',
};

/**
 * Convert lat/lng to x/y in an equirectangular projection.
 * Returns fractions 0..1 (x = left->right, y = top->bottom).
 */
export function project(lat: number, lng: number): { x: number; y: number } {
  const x = (lng + 180) / 360;
  const y = (90 - lat) / 180;
  return { x, y };
}
