import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  useColorScheme,
} from 'react-native';
import * as Location from 'expo-location';
import { computeCloudBreaks, findNextBreak, interpolateAtTime } from './src/cloudBreakEngine.js';
import { geocodeLocation } from './src/openMeteo.js';
import { Widget } from './src/widget.js';

function formatTime(date, timeZone) {
  return new Intl.DateTimeFormat([], {
    hour: '2-digit',
    minute: '2-digit',
    ...(timeZone ? { timeZone } : {}),
  }).format(date);
}

function formatDate(date, timeZone) {
  return new Intl.DateTimeFormat([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...(timeZone ? { timeZone } : {}),
  }).format(date);
}

function formatHour(date, timeZone) {
  return new Intl.DateTimeFormat([], {
    hour: '2-digit',
    ...(timeZone ? { timeZone } : {}),
  }).format(date);
}

function getWeatherIcon(breakItem) {
  if (!breakItem) return '?';
  if (breakItem.isNight) return '🌙';
  if (breakItem.isBelowMinElevation) return '🌅';
  if (!breakItem.bandResults) return '⏳';
  if (breakItem.cloudBreak) return '☀️';
  const blockedCount = Object.values(breakItem.bandResults).filter(b => b.blocked).length;
  if (blockedCount === 3) return '☁️';
  return '⛅';
}

function getCloudIcon(breakItem) {
  return getWeatherIcon(breakItem);
}

function getSunshinePercent(breakItem) {
  if (!breakItem || breakItem.isNight || breakItem.isBelowMinElevation) return 0;
  if (!breakItem.bandResults) return 100;

  let transmission = 1;
  for (const band of ['low', 'mid', 'high']) {
    const cover = breakItem.bandResults[band]?.correctedCover ?? 0;
    transmission *= (1 - Math.min(cover, 100) / 100);
  }
  return Math.round(transmission * 100);
}

function getClearSkyPercent(cover) {
  if (cover === null || cover === undefined || Number.isNaN(Number(cover))) return null;
  return Math.max(0, Math.min(100, Math.round(100 - Number(cover))));
}

const THEMES = {
  dark: {
    bg: '#0f172a',
    card: '#1e293b',
    input: '#1e293b',
    text: '#f8fafc',
    muted: '#94a3b8',
    muted2: '#475569',
    accent: '#fbbf24',
    accentText: '#0f172a',
    successBg: '#14532d',
    successText: '#4ade80',
    successSubtext: '#86efac',
    track: '#334155',
    buttonBg: '#334155',
    buttonText: '#fff',
    errorOverlay: 'rgba(15,23,42,0.95)',
    errorText: '#ef4444',
    barStyle: 'light-content',
  },
  light: {
    bg: '#f8fbff',
    card: '#ffffff',
    input: '#ffffff',
    text: '#0f172a',
    muted: '#475569',
    muted2: '#64748b',
    accent: '#0ea5e9',
    accentText: '#ffffff',
    successBg: '#dcfce7',
    successText: '#15803d',
    successSubtext: '#166534',
    track: '#cbd5e1',
    buttonBg: '#e2e8f0',
    buttonText: '#0f172a',
    errorOverlay: 'rgba(248,250,252,0.92)',
    errorText: '#dc2626',
    barStyle: 'dark-content',
  },
};

function nextThemeMode(mode) {
  if (mode === 'system') return 'dark';
  if (mode === 'dark') return 'light';
  return 'system';
}

export default function App() {
  const systemScheme = useColorScheme();
  const [themeMode, setThemeMode] = useState('system');
  const [location, setLocation] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);

  const resolvedScheme = themeMode === 'system' ? (systemScheme ?? 'dark') : themeMode;
  const theme = THEMES[resolvedScheme] || THEMES.dark;
  const themeLabel = themeMode === 'system' ? 'System' : themeMode === 'dark' ? 'Dark' : 'Light';

  const liveThemeStyles = {
    container: { backgroundColor: theme.bg },
    title: { color: theme.accent },
    location: { color: theme.muted },
    date: { color: theme.muted },
    searchInput: { backgroundColor: theme.input, color: theme.text, borderColor: theme.track },
    gpsBtn: { backgroundColor: theme.card, borderColor: theme.track },
    searchItem: { backgroundColor: theme.card, borderColor: theme.track },
    searchItemName: { color: theme.text },
    searchItemDetail: { color: theme.muted },
    statusCard: { backgroundColor: theme.card, borderColor: theme.track },
    statusLabel: { color: theme.text },
    statusDetail: { color: theme.muted },
    cloudBarLabel: { color: theme.muted },
    cloudBarTrack: { backgroundColor: theme.track },
    cloudBarFill: { backgroundColor: theme.accent },
    cloudBarPct: { color: theme.text },
    cloudBarPctBlocked: { color: '#ef4444' },
    nextBreakCard: { backgroundColor: theme.successBg },
    nextBreakLabel: { color: theme.successText },
    nextBreakTime: { color: theme.text },
    nextBreakDetail: { color: theme.successSubtext },
    sectionTitle: { color: theme.muted },
    minuteItem: { backgroundColor: theme.card },
    minuteItemNow: { backgroundColor: theme.accent },
    minuteTime: { color: theme.muted },
    minuteSun: { color: theme.text },
    hourItem: { backgroundColor: theme.card },
    hourItemNow: { borderColor: theme.accent },
    hourTime: { color: theme.muted },
    hourSun: { color: theme.accent },
    hourCloudText: { color: theme.muted },
    refreshBtn: { backgroundColor: theme.buttonBg },
    refreshBtnText: { color: theme.buttonText },
    attribution: { color: theme.muted2 },
    errorOverlay: { backgroundColor: theme.errorOverlay },
    errorText: { color: theme.errorText },
    errorBtn: { backgroundColor: theme.accent },
    errorBtnText: { color: theme.accentText },
    themeToggle: { backgroundColor: theme.card, borderColor: theme.track },
    themeToggleText: { color: theme.text },
    loadingText: { color: theme.muted },
    minuteItemNow: { backgroundColor: theme.accent },
    minuteItemNowText: { color: theme.accentText },
  };

  const getLocation = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Location permission denied');
        setLoading(false);
        return;
      }
      const pos = await Location.getCurrentPositionAsync({});
      const loc = { lat: pos.coords.latitude, lon: pos.coords.longitude, name: 'Current Location' };
      setLocation(loc);
      await loadForecast(loc.lat, loc.lon);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }, []);

  const loadForecast = async (lat, lon) => {
    setError(null);
    try {
      const breaks = await computeCloudBreaks(lat, lon);
      setForecast(breaks);
      await updateWidget(breaks, lat, lon, breaks.timezone);
    } catch (e) {
      setError(e.message);
    }
  };

  const updateWidget = async (breaks, lat, lon, timeZone) => {
    if (!breaks || breaks.length === 0) return;
    const current = interpolateAtTime(breaks, new Date(), lat, lon) || breaks[0];
    const next = findNextBreak(breaks);
    const status = current?.isNight ? 'Night' : current?.isBelowMinElevation ? 'Low Sun' : current?.cloudBreak ? 'Clear' : 'Cloudy';
    const emoji = getWeatherIcon(current);
    const nextBreakTime = next ? `${formatDate(next.timestamp, timeZone)} ${formatTime(next.timestamp, timeZone)}` : '--';
    const cloudCover = current?.bandResults?.low?.correctedCover?.toFixed(0) ?? '?';
    try { await Widget.update(status, emoji, nextBreakTime, cloudCover); } catch {}
  };

  const selectLocation = async (loc) => {
    const newLoc = { lat: loc.lat, lon: loc.lon, name: loc.name + (loc.country ? `, ${loc.country}` : '') };
    setLocation(newLoc);
    setSearchResults([]);
    setSearchQuery('');
    setLoading(true);
    try {
      await loadForecast(loc.lat, loc.lon);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { getLocation(); }, []);

  useEffect(() => {
    let cancelled = false;
    const q = searchQuery.trim();

    if (q.length < 2) {
      setSearchResults([]);
      return undefined;
    }

    const timer = setTimeout(async () => {
      try {
        const results = await geocodeLocation(q);
        if (cancelled) return;
        setSearchResults(results);
        setError(null);
      } catch (e) {
        if (!cancelled) setError(e.message);
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery]);

  // Update widget every 5 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      if (forecast && location) updateWidget(forecast, location.lat, location.lon, forecast.timezone);
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [forecast, location?.lat, location?.lon]);

  const now = new Date();
  const forecastTimezone = forecast?.timezone;
  const currentSnapshot = forecast && location
    ? interpolateAtTime(forecast, now, location.lat, location.lon)
    : null;
  const currentData = currentSnapshot || forecast?.[0];
  const nextBreak = forecast ? findNextBreak(forecast) : null;
  const hourlyData = forecast?.slice(0, 24) || [];

  const fiveMinData = [];
  for (let i = 0; i < 12; i++) {
    const time = new Date(now.getTime() + i * 5 * 60 * 1000);
    const interpolated = forecast ? interpolateAtTime(forecast, time, location?.lat, location?.lon) : null;
    fiveMinData.push({ time, data: interpolated, isNow: i === 0 });
  }

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, liveThemeStyles.container]}>
        <StatusBar barStyle={theme.barStyle} backgroundColor={theme.bg} />
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={theme.accent} />
          <Text style={[styles.loadingText, liveThemeStyles.loadingText]}>Getting forecast...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, liveThemeStyles.container]}>
      <StatusBar barStyle={theme.barStyle} backgroundColor={theme.bg} />

      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={[styles.title, liveThemeStyles.title]}>Sunshine</Text>
          <Text style={[styles.location, liveThemeStyles.location]}>{location?.name || 'Unknown'}</Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={[styles.date, liveThemeStyles.date]}>{formatDate(now, forecastTimezone)}</Text>
          <TouchableOpacity
            style={[styles.themeToggle, liveThemeStyles.themeToggle]}
            onPress={() => setThemeMode(current => nextThemeMode(current))}
            activeOpacity={0.8}
          >
            <Text style={[styles.themeToggleText, liveThemeStyles.themeToggleText]}>{themeLabel}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.searchRow}>
        <TextInput
          style={[styles.searchInput, liveThemeStyles.searchInput]}
          placeholder="Search..."
          placeholderTextColor={theme.muted}
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
          onSubmitEditing={() => setSearchQuery((q) => q.trim())}
        />
        <TouchableOpacity style={[styles.gpsBtn, liveThemeStyles.gpsBtn]} onPress={getLocation}>
          <Text>📍</Text>
        </TouchableOpacity>
      </View>

      {searchResults.length > 0 && (
        <ScrollView style={styles.searchResults} nestedScrollEnabled>
          {searchResults.map((r, i) => (
            <TouchableOpacity key={i} style={[styles.searchItem, liveThemeStyles.searchItem]} onPress={() => selectLocation(r)}>
              <Text style={[styles.searchItemName, liveThemeStyles.searchItemName]}>{r.name}</Text>
              <Text style={[styles.searchItemDetail, liveThemeStyles.searchItemDetail]}>{r.admin1 ? r.admin1 + ', ' : ''}{r.country}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <ScrollView style={styles.content}>
        <View style={[styles.statusCard, liveThemeStyles.statusCard]}>
          <View style={styles.statusMain}>
            <Text style={styles.statusIcon}>{getWeatherIcon(currentData)}</Text>
            <View style={styles.statusInfo}>
              <Text style={[styles.statusLabel, liveThemeStyles.statusLabel]}>
                {currentData?.isNight
                  ? 'Night'
                  : currentData?.isBelowMinElevation
                    ? 'Sun Too Low'
                    : currentData?.cloudBreak
                      ? 'Direct Sunlight'
                      : 'Clouds Blocking Sun'}
              </Text>
              <Text style={[styles.statusDetail, liveThemeStyles.statusDetail]}>
                {currentData?.isNight
                  ? 'Sun is below horizon'
                  : currentData?.isBelowMinElevation
                    ? 'Sun is above the horizon, but too low for this forecast model'
                    : `Sun elevation: ${currentData?.sunElevation?.toFixed(1)}°`
                }
              </Text>
            </View>
          </View>

          <View style={styles.cloudBars}>
            {['low', 'mid', 'high'].map(band => {
              const data = currentData?.bandResults?.[band];
              const blocked = data?.blocked;
              const clearPct = getClearSkyPercent(data?.correctedCover);
              const clearFill = clearPct ?? 0;
              return (
                <View key={band} style={styles.cloudBar}>
                  <View style={styles.cloudBarHeader}>
                    <Text style={[styles.cloudBarLabel, liveThemeStyles.cloudBarLabel]}>{band.toUpperCase()} CLEAR</Text>
                    <Text style={[styles.cloudBarPct, liveThemeStyles.cloudBarPct, blocked && liveThemeStyles.cloudBarPctBlocked]}>
                      {clearPct ?? '?'}%
                    </Text>
                  </View>
                  <View style={[styles.cloudBarTrack, liveThemeStyles.cloudBarTrack]}>
                    <View style={[styles.cloudBarFill, liveThemeStyles.cloudBarFill, blocked && styles.cloudBarFillBlocked, { width: `${clearFill}%` }]} />
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {nextBreak && !currentData?.isNight && (
          <View style={[styles.nextBreakCard, liveThemeStyles.nextBreakCard]}>
            <Text style={[styles.nextBreakLabel, liveThemeStyles.nextBreakLabel]}>Next Clear Sun</Text>
            <Text style={[styles.nextBreakTime, liveThemeStyles.nextBreakTime]}>{formatDate(nextBreak.timestamp, forecastTimezone)} at {formatTime(nextBreak.timestamp, forecastTimezone)}</Text>
            <Text style={[styles.nextBreakDetail, liveThemeStyles.nextBreakDetail]}>Sun elevation: {nextBreak.sunElevation?.toFixed(1)}°</Text>
          </View>
        )}

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, liveThemeStyles.sectionTitle]}>Next Hour</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.minuteScroll}>
            {fiveMinData.map((item, i) => {
              const icon = getCloudIcon(item.data);
              return (
                <View key={i} style={[
                  styles.minuteItem,
                  liveThemeStyles.minuteItem,
                  item.isNow && styles.minuteItemNow,
                  item.isNow && liveThemeStyles.minuteItemNow,
                ]}>
                  <Text style={[styles.minuteTime, liveThemeStyles.minuteTime, item.isNow && liveThemeStyles.minuteItemNowText]}>{item.isNow ? 'Now' : formatTime(item.time, forecastTimezone)}</Text>
                  <Text style={styles.minuteIcon}>{icon}</Text>
                  <Text style={[styles.minuteSun, liveThemeStyles.minuteSun, item.isNow && liveThemeStyles.minuteItemNowText]}>
                    {getSunshinePercent(item.data)}%
                  </Text>
                </View>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, liveThemeStyles.sectionTitle]}>Hourly Forecast</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hourScroll}>
            {hourlyData.map((item, i) => {
              const isNow = i === 0;
              return (
                <View key={i} style={[
                  styles.hourItem,
                  liveThemeStyles.hourItem,
                  isNow && styles.hourItemNow,
                  isNow && liveThemeStyles.hourItemNow,
                ]}>
                  <Text style={[styles.hourTime, liveThemeStyles.hourTime]}>{isNow ? 'Now' : formatHour(item.timestamp, forecastTimezone)}</Text>
                  <Text style={styles.hourIcon}>{getWeatherIcon(item)}</Text>
                  <Text style={[styles.hourSun, liveThemeStyles.hourSun]}>
                    {item.sunElevation?.toFixed(0)}°↑
                  </Text>
                  <View style={[styles.hourClouds, { borderTopColor: theme.track }]}>
                    {['low', 'mid', 'high'].map(band => {
                      const d = item.bandResults?.[band];
                      const clearPct = getClearSkyPercent(d?.correctedCover);
                      return (
                        <Text key={band} style={[styles.hourCloudText, liveThemeStyles.hourCloudText]}>
                          {band[0].toUpperCase()}: {clearPct ?? '?'}% clear
                        </Text>
                      );
                    })}
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </View>

        <TouchableOpacity style={[styles.refreshBtn, liveThemeStyles.refreshBtn]} onPress={getLocation}>
          <Text style={[styles.refreshBtnText, liveThemeStyles.refreshBtnText]}>↻ Refresh</Text>
        </TouchableOpacity>

        <Text style={[styles.attribution, liveThemeStyles.attribution]}>Weather: Open-Meteo (CC-BY 4.0)</Text>
      </ScrollView>

      {error && (
        <View style={[styles.errorOverlay, liveThemeStyles.errorOverlay]}>
          <Text style={[styles.errorText, liveThemeStyles.errorText]}>{error}</Text>
          <TouchableOpacity style={[styles.errorBtn, liveThemeStyles.errorBtn]} onPress={getLocation}>
            <Text style={[styles.errorBtnText, liveThemeStyles.errorBtnText]}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 8,
  },
  headerLeft: { flex: 1 },
  headerRight: { alignItems: 'flex-end', gap: 8 },
  title: { fontSize: 24, fontWeight: 'bold' },
  location: { fontSize: 12, marginTop: 2 },
  date: { fontSize: 13 },
  themeToggle: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    alignSelf: 'flex-end',
  },
  themeToggleText: { fontSize: 12, fontWeight: '700' },
  searchRow: { flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 10, gap: 8 },
  searchInput: {
    flex: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    borderWidth: 1,
  },
  gpsBtn: {
    borderRadius: 10,
    paddingHorizontal: 14,
    justifyContent: 'center',
    borderWidth: 1,
  },
  searchResults: { maxHeight: 150, marginHorizontal: 20, marginBottom: 8 },
  searchItem: { padding: 12, borderRadius: 8, marginBottom: 4, borderWidth: 1 },
  searchItemName: { fontWeight: '600' },
  searchItemDetail: { fontSize: 12, marginTop: 2 },
  content: { flex: 1, paddingHorizontal: 20, paddingTop: 4 },

  statusCard: { borderRadius: 16, padding: 16, marginTop: 8, borderWidth: 1 },
  statusMain: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  statusIcon: { fontSize: 48, marginRight: 14 },
  statusInfo: { flex: 1 },
  statusLabel: { fontSize: 18, fontWeight: '600' },
  statusDetail: { fontSize: 13, marginTop: 4 },
  cloudBars: { gap: 10 },
  cloudBar: {},
  cloudBarHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  cloudBarLabel: { fontSize: 12 },
  cloudBarPct: { fontSize: 12, fontWeight: '600' },
  cloudBarPctBlocked: { color: '#ef4444' },
  cloudBarTrack: { height: 4, borderRadius: 2 },
  cloudBarFill: { height: '100%', borderRadius: 2 },
  cloudBarFillBlocked: { backgroundColor: '#ef4444' },

  nextBreakCard: { borderRadius: 12, padding: 14, marginTop: 10 },
  nextBreakLabel: { fontSize: 12, fontWeight: '600' },
  nextBreakTime: { fontSize: 18, fontWeight: 'bold', marginTop: 4 },
  nextBreakDetail: { fontSize: 12, marginTop: 2 },

  section: { marginTop: 20 },
  sectionTitle: { fontSize: 13, fontWeight: '600', marginBottom: 10 },
  minuteScroll: {},
  minuteItem: { borderRadius: 10, padding: 10, marginRight: 8, alignItems: 'center', minWidth: 56 },
  minuteItemNow: {},
  minuteTime: { fontSize: 10, marginBottom: 4 },
  minuteIcon: { fontSize: 20, marginBottom: 4 },
  minuteSun: { fontSize: 11, fontWeight: '600' },

  hourScroll: {},
  hourItem: { borderRadius: 10, padding: 10, marginRight: 6, alignItems: 'center', minWidth: 60, borderWidth: 1, borderColor: 'transparent' },
  hourItemNow: { borderWidth: 2 },
  hourTime: { fontSize: 11, marginBottom: 4 },
  hourIcon: { fontSize: 18, marginBottom: 4 },
  hourSun: { fontSize: 12, fontWeight: '600' },
  hourClouds: { marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#334155' },
  hourCloudText: { fontSize: 9 },

  refreshBtn: { borderRadius: 10, padding: 12, alignItems: 'center', marginTop: 16, marginBottom: 20 },
  refreshBtnText: { fontSize: 15, fontWeight: '600' },
  attribution: { fontSize: 11, textAlign: 'center', paddingBottom: 30 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12 },
  errorOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', padding: 40 },
  errorText: { fontSize: 16, textAlign: 'center', marginBottom: 20 },
  errorBtn: { borderRadius: 10, paddingHorizontal: 24, paddingVertical: 12 },
  errorBtnText: { fontSize: 16, fontWeight: 'bold' },
});
