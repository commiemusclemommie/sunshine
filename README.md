# Sunshine ☀️

Cloud break predictor - tells you when the sun will shine through clouds.

## Features

- **Current sun status** - Elevation, azimuth, and visibility
- **Cloud coverage analysis** - Low/Mid/High altitude cloud detection
- **Next clear sun window** - Predicts when direct sunlight is available
- **48-hour forecast** - Hourly cloud break predictions
- **Location-based** - GPS or manual location search

## Installation

```bash
npm install
npx expo run:android
```

## Build APK

```bash
cd android
./gradlew assembleRelease
```

APK outputs to: `android/app/build/outputs/apk/release/app-release.apk`

## How It Works

1. Gets your location via GPS
2. Calculates sun position (azimuth/elevation) using SunCalc
3. Fetches cloud coverage data from Open-Meteo for 3 altitude bands
4. Calculates "sun ray" offsets at low (2km), mid (6km), high (11km) altitudes
5. Predicts cloud breaks based on threshold analysis

## Configuration

Edit `src/config.js` to adjust:
- Cloud altitude bands
- Block thresholds (when clouds block sunlight)
- Model bias correction

## Data Sources

| Source | License | URL |
|--------|---------|-----|
| Weather data | CC-BY 4.0 | [Open-Meteo](https://open-meteo.com) |
| Sun calculations | MIT | [SunCalc](https://github.com/mourner/suncalc) |
| Geocoding | CC-BY 4.0 | [Open-Meteo Geocoding](https://open-meteo.com/en/docs/geocoding-api) |

## License

GNU Affero General Public License v3.0 - see [LICENSE](LICENSE)

---

**Weather data attribution:** Open-Meteo (https://open-meteo.com) - CC-BY 4.0