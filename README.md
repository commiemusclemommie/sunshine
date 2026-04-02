# Sunshine ☀️

Cloud break predictor - tells you when the sun will shine through clouds.

## Features

- **Current sun status** - Elevation, azimuth, and visibility
- **Cloud coverage analysis** - Low/Mid/High altitude cloud detection
- **Next clear sun window** - Predicts when direct sunlight is available
- **Hourly forecast** - 24-hour cloud break predictions
- **Location-based** - GPS or manual location search
- **Android Widget** - Home screen widget with 5-min updates

## Installation

```bash
npm install
npx expo run:android
```

## Build APK

```bash
npx expo prebuild --platform android
# Copy native-widget files to android/app/src/main/
cp -r native-widget/kotlin/* android/app/src/main/kotlin/
cp -r native-widget/res/* android/app/src/main/res/
# Update MainApplication.kt to include WidgetPackage()
cd android
./gradlew assembleRelease
```

APK outputs to: `android/app/build/outputs/apk/release/app-release.apk`

## How It Works

1. Gets your location via GPS
2. Calculates sun position (azimuth/elevation) using SunCalc
3. Fetches cloud coverage data from Open-Meteo for 3 altitude bands
4. Predicts cloud breaks based on threshold analysis

## Widget Setup

After `expo prebuild`, copy widget files:

```bash
cp -r native-widget/kotlin/* android/app/src/main/kotlin/
cp -r native-widget/res/* android/app/src/main/res/
```

Then rebuild. The widget will appear in your widget picker as "Sunshine".

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