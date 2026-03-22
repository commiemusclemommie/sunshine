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
} from 'react-native';
import * as Location from 'expo-location';
import { computeCloudBreaks, findNextBreak, interpolateAtTime } from './src/cloudBreakEngine.js';
import { geocodeLocation } from './src/openMeteo.js';
import { getSunPosition } from './src/sunGeometry.js';
import { Widget } from './src/widget.js';

function formatTime(date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(date) {
  return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatHour(date) {
  return date.toLocaleTimeString([], { hour: '2-digit' });
}

function getWeatherIcon(breakItem) {
  if (!breakItem) return '?';
  if (breakItem.isNight) return '🌙';
  if (!breakItem.bandResults) return '⏳';
  if (breakItem.cloudBreak) return '☀️';
  const blockedCount = Object.values(breakItem.bandResults).filter(b => b.blocked).length;
  if (blockedCount === 3) return '☁️';
  return '⛅';
}

function getCloudIcon(breakItem) {
  const icon = getWeatherIcon(breakItem);
  if (icon === '🌙' || icon === '⏳') return icon;
  return icon;
}

function getSunshinePercent(breakItem) {
  if (!breakItem || breakItem.isNight) return 0;
  if (!breakItem.bandResults) return 100;
  
  let transmission = 1;
  for (const band of ['low', 'mid', 'high']) {
    const cover = breakItem.bandResults[band]?.correctedCover ?? 0;
    transmission *= (1 - Math.min(cover, 100) / 100);
  }
  return Math.round(transmission * 100);
}

export default function App() {
  const [location, setLocation] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);

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
    try {
      const breaks = await computeCloudBreaks(lat, lon);
      setForecast(breaks);
      updateWidget(breaks);
    } catch (e) {
      setError(e.message);
    }
  };

  const updateWidget = async (breaks) => {
    if (!breaks || breaks.length === 0) return;
    const current = breaks[0];
    const next = findNextBreak(breaks);
    const status = current?.isNight ? 'Night' : current?.cloudBreak ? 'Clear' : 'Cloudy';
    const emoji = getWeatherIcon(current);
    const nextBreakTime = next ? `${formatDate(next.timestamp)} ${formatTime(next.timestamp)}` : '--';
    const cloudCover = current?.bandResults?.low?.correctedCover?.toFixed(0) ?? '?';
    try { await Widget.update(status, emoji, nextBreakTime, cloudCover); } catch {}
  };

  const selectLocation = (loc) => {
    const newLoc = { lat: loc.lat, lon: loc.lon, name: loc.name + (loc.country ? `, ${loc.country}` : '') };
    setLocation(newLoc);
    setSearchResults([]);
    setSearchQuery('');
    loadForecast(loc.lat, loc.lon);
  };

  useEffect(() => { getLocation(); }, []);

  // Update widget every 5 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      if (forecast) updateWidget(forecast);
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [forecast]);

  const now = new Date();
  const currentData = forecast?.[0];
  const nextBreak = forecast ? findNextBreak(forecast) : null;
  const hourlyData = forecast?.slice(0, 24) || [];

  // Generate 5-minute intervals for next hour with interpolation
  const fiveMinData = [];
  for (let i = 0; i < 12; i++) {
    const time = new Date(now.getTime() + i * 5 * 60 * 1000);
    const interpolated = forecast ? interpolateAtTime(forecast, time, location?.lat, location?.lon) : null;
    fiveMinData.push({ time, data: interpolated, isNow: i === 0 });
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="#fbbf24" />
          <Text style={styles.loadingText}>Getting forecast...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>Sunshine</Text>
          <Text style={styles.location}>{location?.name || 'Unknown'}</Text>
        </View>
        <Text style={styles.date}>{formatDate(now)}</Text>
      </View>

      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search..."
          placeholderTextColor="#64748b"
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={async () => {
            const results = await geocodeLocation(searchQuery);
            setSearchResults(results);
          }}
        />
        <TouchableOpacity style={styles.gpsBtn} onPress={getLocation}>
          <Text>📍</Text>
        </TouchableOpacity>
      </View>

      {searchResults.length > 0 && (
        <ScrollView style={styles.searchResults} nestedScrollEnabled>
          {searchResults.map((r, i) => (
            <TouchableOpacity key={i} style={styles.searchItem} onPress={() => selectLocation(r)}>
              <Text style={styles.searchItemName}>{r.name}</Text>
              <Text style={styles.searchItemDetail}>{r.admin1 ? r.admin1 + ', ' : ''}{r.country}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <ScrollView style={styles.content}>
        {/* Current Status Card */}
        <View style={styles.statusCard}>
          <View style={styles.statusMain}>
            <Text style={styles.statusIcon}>{getWeatherIcon(currentData)}</Text>
            <View style={styles.statusInfo}>
              <Text style={styles.statusLabel}>
                {currentData?.isNight ? 'Night' : currentData?.cloudBreak ? 'Direct Sunlight' : 'Clouds Blocking Sun'}
              </Text>
              <Text style={styles.statusDetail}>
                {currentData?.isNight 
                  ? 'Sun is below horizon'
                  : `Sun elevation: ${currentData?.sunElevation?.toFixed(1)}°`
                }
              </Text>
            </View>
          </View>
          
          <View style={styles.cloudBars}>
            {['low', 'mid', 'high'].map(band => {
              const data = currentData?.bandResults?.[band];
              const blocked = data?.blocked;
              const cover = data?.correctedCover?.toFixed(0) ?? '?';
              return (
                <View key={band} style={styles.cloudBar}>
                  <View style={styles.cloudBarHeader}>
                    <Text style={styles.cloudBarLabel}>{band.toUpperCase()}</Text>
                    <Text style={[styles.cloudBarPct, blocked && styles.cloudBarPctBlocked]}>
                      {cover}%
                    </Text>
                  </View>
                  <View style={styles.cloudBarTrack}>
                    <View style={[styles.cloudBarFill, blocked && styles.cloudBarFillBlocked, { width: `${Math.min(cover, 100)}%`}]} />
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* Next Clear Sun */}
        {nextBreak && !currentData?.isNight && (
          <View style={styles.nextBreakCard}>
            <Text style={styles.nextBreakLabel}>Next Clear Sun</Text>
            <Text style={styles.nextBreakTime}>{formatDate(nextBreak.timestamp)} at {formatTime(nextBreak.timestamp)}</Text>
            <Text style={styles.nextBreakDetail}>Sun elevation: {nextBreak.sunElevation?.toFixed(1)}°</Text>
          </View>
        )}

        {/* 5-Minute Intervals */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Next Hour</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.minuteScroll}>
            {fiveMinData.map((item, i) => {
              const icon = getCloudIcon(item.data);
              return (
                <View key={i} style={[styles.minuteItem, item.isNow && styles.minuteItemNow]}>
                  <Text style={styles.minuteTime}>{item.isNow ? 'Now' : formatTime(item.time)}</Text>
                  <Text style={styles.minuteIcon}>{icon}</Text>
                  <Text style={styles.minuteSun}>
                    {getSunshinePercent(item.data)}%
                  </Text>
                </View>
              );
            })}
          </ScrollView>
        </View>

        {/* Hourly Forecast */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Hourly Forecast</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hourScroll}>
            {hourlyData.map((item, i) => {
              const isNow = i === 0;
              return (
                <View key={i} style={[styles.hourItem, isNow && styles.hourItemNow]}>
                  <Text style={styles.hourTime}>{isNow ? 'Now' : formatHour(item.timestamp)}</Text>
                  <Text style={styles.hourIcon}>{getWeatherIcon(item)}</Text>
                  <Text style={styles.hourSun}>
                    {item.sunElevation?.toFixed(0)}°↑
                  </Text>
                  <View style={styles.hourClouds}>
                    {['low', 'mid', 'high'].map(band => {
                      const d = item.bandResults?.[band];
                      return (
                        <Text key={band} style={styles.hourCloudText}>
                          {band[0].toUpperCase()}: {d?.correctedCover?.toFixed(0) ?? '?'}%
                        </Text>
                      );
                    })}
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </View>

        <TouchableOpacity style={styles.refreshBtn} onPress={getLocation}>
          <Text style={styles.refreshBtnText}>↻ Refresh</Text>
        </TouchableOpacity>

        <Text style={styles.attribution}>Weather: Open-Meteo (CC-BY 4.0)</Text>
      </ScrollView>

      {error && (
        <View style={styles.errorOverlay}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.errorBtn} onPress={getLocation}>
            <Text style={styles.errorBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 8 },
  headerLeft: { flex: 1 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#fbbf24' },
  location: { color: '#64748b', fontSize: 12, marginTop: 2 },
  date: { color: '#94a3b8', fontSize: 13 },
  searchRow: { flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 8, gap: 8 },
  searchInput: { flex: 1, backgroundColor: '#1e293b', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, color: '#fff', fontSize: 15 },
  gpsBtn: { backgroundColor: '#1e293b', borderRadius: 10, paddingHorizontal: 14, justifyContent: 'center' },
  searchResults: { maxHeight: 150, marginHorizontal: 20, marginBottom: 8 },
  searchItem: { backgroundColor: '#1e293b', padding: 12, borderRadius: 8, marginBottom: 4 },
  searchItemName: { color: '#fff', fontWeight: '600' },
  searchItemDetail: { color: '#64748b', fontSize: 12, marginTop: 2 },
  content: { flex: 1, paddingHorizontal: 20 },
  
  statusCard: { backgroundColor: '#1e293b', borderRadius: 16, padding: 16, marginTop: 8 },
  statusMain: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  statusIcon: { fontSize: 48, marginRight: 14 },
  statusInfo: { flex: 1 },
  statusLabel: { color: '#fff', fontSize: 18, fontWeight: '600' },
  statusDetail: { color: '#94a3b8', fontSize: 13, marginTop: 4 },
  cloudBars: { gap: 10 },
  cloudBar: {},
  cloudBarHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  cloudBarLabel: { color: '#94a3b8', fontSize: 12 },
  cloudBarPct: { color: '#22c55e', fontSize: 12, fontWeight: '600' },
  cloudBarPctBlocked: { color: '#ef4444' },
  cloudBarTrack: { height: 4, backgroundColor: '#334155', borderRadius: 2 },
  cloudBarFill: { height: '100%', backgroundColor: '#22c55e', borderRadius: 2 },
  cloudBarFillBlocked: { backgroundColor: '#ef4444' },
  
  nextBreakCard: { backgroundColor: '#14532d', borderRadius: 12, padding: 14, marginTop: 10 },
  nextBreakLabel: { color: '#4ade80', fontSize: 12, fontWeight: '600' },
  nextBreakTime: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginTop: 4 },
  nextBreakDetail: { color: '#86efac', fontSize: 12, marginTop: 2 },
  
  section: { marginTop: 20 },
  sectionTitle: { color: '#94a3b8', fontSize: 13, fontWeight: '600', marginBottom: 10 },
  minuteScroll: {},
  minuteItem: { backgroundColor: '#1e293b', borderRadius: 10, padding: 10, marginRight: 8, alignItems: 'center', minWidth: 56 },
  minuteItemNow: { backgroundColor: '#fbbf24' },
  minuteTime: { color: '#94a3b8', fontSize: 10, marginBottom: 4 },
  minuteIcon: { fontSize: 20, marginBottom: 4 },
  minuteSun: { color: '#fff', fontSize: 11, fontWeight: '600' },
  
  hourScroll: {},
  hourItem: { backgroundColor: '#1e293b', borderRadius: 10, padding: 10, marginRight: 6, alignItems: 'center', minWidth: 60 },
  hourItemNow: { borderWidth: 2, borderColor: '#fbbf24' },
  hourTime: { color: '#94a3b8', fontSize: 11, marginBottom: 4 },
  hourIcon: { fontSize: 18, marginBottom: 4 },
  hourSun: { color: '#fbbf24', fontSize: 12, fontWeight: '600' },
  hourClouds: { marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#334155' },
  hourCloudText: { color: '#64748b', fontSize: 9 },
  
  refreshBtn: { backgroundColor: '#334155', borderRadius: 10, padding: 12, alignItems: 'center', marginTop: 16, marginBottom: 20 },
  refreshBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  attribution: { color: '#475569', fontSize: 11, textAlign: 'center', paddingBottom: 30 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#94a3b8', marginTop: 12 },
  errorOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.95)', justifyContent: 'center', alignItems: 'center', padding: 40 },
  errorText: { color: '#ef4444', fontSize: 16, textAlign: 'center', marginBottom: 20 },
  errorBtn: { backgroundColor: '#fbbf24', borderRadius: 10, paddingHorizontal: 24, paddingVertical: 12 },
  errorBtnText: { color: '#0f172a', fontSize: 16, fontWeight: 'bold' },
});