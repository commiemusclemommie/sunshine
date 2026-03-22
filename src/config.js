export const CLOUD_CONFIG = {
  altitudeBands: {
    low:  { altitudeM: 2000, label: "Low (Stratus/Cumulus)" },
    mid:  { altitudeM: 6000, label: "Mid (Altocumulus/Altostratus)" },
    high: { altitudeM: 11000, label: "High (Cirrus/Cirrostratus)" },
  },
  blockThresholds: {
    low:  30,
    mid:  40,
    high: 60,
  },
  lineOfSightConeDeg: 0.5,
  minSunElevationDeg: 5,
  maxOffsetKm: 30,
  cacheTTLMinutes: 30,
  notificationLeadTimeMinutes: 30,
  minBreakDurationMinutes: 15,
  modelBiasCorrection: {
    low:  0,
    mid:  0,
    high: 5,
  },
};