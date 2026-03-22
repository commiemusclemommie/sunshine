export async function fetchCloudCover(lat, lon) {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude',  lat.toFixed(4));
  url.searchParams.set('longitude', lon.toFixed(4));
  url.searchParams.set('hourly',    'cloud_cover_low,cloud_cover_mid,cloud_cover_high,cloud_cover,temperature_2m,precipitation_probability');
  url.searchParams.set('forecast_days', '3');
  url.searchParams.set('timezone',  'auto');

  const res  = await fetch(url.toString());
  const data = await res.json();

  const result = {};
  data.hourly.time.forEach((t, i) => {
    result[t] = {
      low:    data.hourly.cloud_cover_low[i],
      mid:    data.hourly.cloud_cover_mid[i],
      high:   data.hourly.cloud_cover_high[i],
      total:  data.hourly.cloud_cover[i],
      temp:   data.hourly.temperature_2m?.[i],
      precip: data.hourly.precipitation_probability?.[i],
    };
  });

  return { hourly: result, timezone: data.timezone };
}

export async function geocodeLocation(query) {
  const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
  url.searchParams.set('name', query);
  url.searchParams.set('count', '5');

  const res = await fetch(url.toString());
  const data = await res.json();

  return data.results?.map(r => ({
    name: r.name,
    country: r.country,
    lat: r.latitude,
    lon: r.longitude,
    admin1: r.admin1,
  })) || [];
}