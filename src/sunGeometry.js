import SunCalc from 'suncalc';
import { CLOUD_CONFIG } from './config.js';

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;
const EARTH_RADIUS_KM = 6371;

export function getSunPosition(date, lat, lon) {
  const pos = SunCalc.getPosition(date, lat, lon);
  return {
    azimuthDeg:   (pos.azimuth * RAD_TO_DEG + 180) % 360,
    elevationDeg:  pos.altitude * RAD_TO_DEG,
  };
}

export function getOffsetCoordinate(observerLat, observerLon, azimuthDeg, elevationDeg, altitudeM) {
  const altitudeKm = altitudeM / 1000;
  const elevRad = elevationDeg * DEG_TO_RAD;
  
  let horizontalDistKm = altitudeKm / Math.tan(elevRad);

  if (horizontalDistKm > CLOUD_CONFIG.maxOffsetKm) {
    horizontalDistKm = CLOUD_CONFIG.maxOffsetKm;
  }

  const azRad = azimuthDeg * DEG_TO_RAD;
  const angularDistance = horizontalDistKm / EARTH_RADIUS_KM;

  const latRad = observerLat * DEG_TO_RAD;
  const lonRad = observerLon * DEG_TO_RAD;

  const newLatRad = Math.asin(
    Math.sin(latRad) * Math.cos(angularDistance) +
    Math.cos(latRad) * Math.sin(angularDistance) * Math.cos(azRad)
  );

  const newLonRad = lonRad + Math.atan2(
    Math.sin(azRad) * Math.sin(angularDistance) * Math.cos(latRad),
    Math.cos(angularDistance) - Math.sin(latRad) * Math.sin(newLatRad)
  );

  return {
    lat: newLatRad * RAD_TO_DEG,
    lon: newLonRad * RAD_TO_DEG,
    horizontalDistKm,
  };
}