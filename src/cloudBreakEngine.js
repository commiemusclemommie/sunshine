import { CLOUD_CONFIG } from './config.js';
import { getSunPosition, getOffsetCoordinate } from './sunGeometry.js';
import { fetchCloudCover } from './openMeteo.js';

export async function computeCloudBreaks(observerLat, observerLon) {
  const { altitudeBands, blockThresholds, modelBiasCorrection, minSunElevationDeg } = CLOUD_CONFIG;

  const now = new Date();
  const hours = Array.from({ length: 72 }, (_, i) => {
    const t = new Date(now);
    t.setMinutes(0, 0, 0);
    t.setHours(t.getHours() + i);
    return t;
  });

  const coordsToFetch = new Set();
  coordsToFetch.add(`${observerLat.toFixed(4)},${observerLon.toFixed(4)}`);

  const hourlyOffsets = hours.map(t => {
    const sun = getSunPosition(t, observerLat, observerLon);
    if (sun.elevationDeg < minSunElevationDeg) return { t, sun, offsets: null };

    const offsets = {};
    for (const [band, { altitudeM }] of Object.entries(altitudeBands)) {
      const coord = getOffsetCoordinate(observerLat, observerLon, sun.azimuthDeg, sun.elevationDeg, altitudeM);
      offsets[band] = coord;
      coordsToFetch.add(`${coord.lat.toFixed(4)},${coord.lon.toFixed(4)}`);
    }
    return { t, sun, offsets };
  });

  const fetchMap = {};
  await Promise.all(
    [...coordsToFetch].map(async (coordKey) => {
      const [lat, lon] = coordKey.split(',').map(Number);
      fetchMap[coordKey] = await fetchCloudCover(lat, lon);
    })
  );

  return hourlyOffsets.map(({ t, sun, offsets }) => {
    const isoHour = t.toISOString().slice(0, 13) + ':00';

    if (!offsets) {
      return {
        timestamp: t,
        isNight:   sun.elevationDeg <= 0,
        isBelowMinElevation: sun.elevationDeg > 0 && sun.elevationDeg < minSunElevationDeg,
        sunAzimuth:   sun.azimuthDeg,
        sunElevation: sun.elevationDeg,
        cloudBreak:   false,
        bandResults:  null,
      };
    }

    const bandResults = {};
    let isBlocked = false;

    for (const [band, coord] of Object.entries(offsets)) {
      const coordKey  = `${coord.lat.toFixed(4)},${coord.lon.toFixed(4)}`;
      const cloudData = fetchMap[coordKey]?.hourly?.[isoHour];

      if (!cloudData) {
        bandResults[band] = { cover: null, blocked: false, note: 'no data' };
        continue;
      }

      const rawCover      = cloudData[band] ?? 0;
      const correctedCover = Math.max(0, rawCover - (modelBiasCorrection[band] ?? 0));
      const threshold      = blockThresholds[band];
      const blocked        = correctedCover > threshold;

      bandResults[band] = {
        offsetCoord:     coord,
        offsetDistKm:    coord.horizontalDistKm,
        rawCover,
        correctedCover,
        threshold,
        blocked,
      };

      if (blocked) isBlocked = true;
    }

    return {
      timestamp:    t,
      isNight:      false,
      sunAzimuth:   sun.azimuthDeg,
      sunElevation: sun.elevationDeg,
      cloudBreak:   !isBlocked,
      bandResults,
    };
  });
}

export function findNextBreak(breaks) {
  const now = new Date();
  for (const b of breaks) {
    if (b.timestamp > now && b.cloudBreak && !b.isNight) {
      return b;
    }
  }
  return null;
}

export function findBreakWindows(breaks, minDurationMinutes = 15) {
  const windows = [];
  let windowStart = null;
  let windowEnd = null;

  for (const b of breaks) {
    if (b.cloudBreak && !b.isNight) {
      if (!windowStart) {
        windowStart = b.timestamp;
        windowEnd = new Date(b.timestamp.getTime() + 60 * 60 * 1000);
      } else {
        windowEnd = new Date(b.timestamp.getTime() + 60 * 60 * 1000);
      }
    } else {
      if (windowStart && windowEnd) {
        const duration = (windowEnd - windowStart) / (60 * 1000);
        if (duration >= minDurationMinutes) {
          windows.push({ start: windowStart, end: windowEnd, duration });
        }
      }
      windowStart = null;
      windowEnd = null;
    }
  }

  if (windowStart && windowEnd) {
    const duration = (windowEnd - windowStart) / (60 * 1000);
    if (duration >= minDurationMinutes) {
      windows.push({ start: windowStart, end: windowEnd, duration });
    }
  }

  return windows;
}