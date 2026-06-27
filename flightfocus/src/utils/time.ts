export function getSolarPosition(lat: number, lng: number, date: Date = new Date()): {
  altitude: number;
  azimuth: number;
  isDaytime: boolean;
  sunProgress: number;
} {
  const dayOfYear = getDayOfYear(date);
  const hours = date.getUTCHours() + date.getUTCMinutes() / 60 + lng / 15;
  const localSolarTime = ((hours % 24) + 24) % 24;

  const declination = 23.45 * Math.sin(toRad((360 / 365) * (dayOfYear - 81)));
  const hourAngle = (localSolarTime - 12) * 15;

  const latRad = toRad(lat);
  const decRad = toRad(declination);
  const haRad = toRad(hourAngle);

  const altitude = Math.asin(
    Math.sin(latRad) * Math.sin(decRad) +
    Math.cos(latRad) * Math.cos(decRad) * Math.cos(haRad)
  );

  const azimuth = Math.atan2(
    -Math.sin(haRad),
    Math.tan(decRad) * Math.cos(latRad) - Math.sin(latRad) * Math.cos(haRad)
  );

  const altDeg = toDeg(altitude);
  const isDaytime = altDeg > -6;

  let sunProgress = 0.5;
  if (altDeg > 0) {
    sunProgress = 0.3 + (altDeg / 90) * 0.4;
  } else if (altDeg > -18) {
    sunProgress = (altDeg + 18) / 18 * 0.3;
  } else {
    sunProgress = 0;
  }

  return {
    altitude: altDeg,
    azimuth: toDeg(azimuth),
    isDaytime,
    sunProgress,
  };
}

export function getSkyColors(sunAltitude: number): {
  top: string;
  bottom: string;
  ambient: string;
} {
  if (sunAltitude > 20) {
    return { top: '#1e3a5f', bottom: '#87ceeb', ambient: '#ffffff' };
  } else if (sunAltitude > 5) {
    return { top: '#2d4a7a', bottom: '#6db3d4', ambient: '#fff8e0' };
  } else if (sunAltitude > -2) {
    return { top: '#1a2744', bottom: '#ff8c42', ambient: '#ffb347' };
  } else if (sunAltitude > -6) {
    return { top: '#0f1b33', bottom: '#c44d2b', ambient: '#ff6b35' };
  } else if (sunAltitude > -12) {
    return { top: '#0a0f1e', bottom: '#2d1b4e', ambient: '#4a2c6b' };
  } else {
    return { top: '#050810', bottom: '#0a0f1e', ambient: '#1a1a2e' };
  }
}

export function getTimezoneOffsetMs(timezone: string, date: Date): number {
  try {
    const utcStr = date.toLocaleString('en-US', { timeZone: 'UTC' });
    const tzStr = date.toLocaleString('en-US', { timeZone: timezone });
    const utcDate = new Date(utcStr);
    const tzDate = new Date(tzStr);
    return tzDate.getTime() - utcDate.getTime();
  } catch {
    // Fallback: estimate from longitude (15° per hour)
    return 0;
  }
}

export function formatTimeInTimezone(date: Date, timezone: string): string {
  try {
    return date.toLocaleTimeString('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  } catch {
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  }
}

export function getLocalHourInTimezone(date: Date, timezone: string): number {
  try {
    const str = date.toLocaleTimeString('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      hour12: false,
    });
    const hour = parseInt(str, 10);
    return Number.isNaN(hour) ? date.getHours() : hour % 24;
  } catch {
    return date.getHours();
  }
}

function getDayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function toDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}
