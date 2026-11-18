// Invented weather-station readings. Generated from a fixed seed, so every run gives the same rows.

export const columns = [
  { key: 'station', label: 'Station', type: 'text' },
  { key: 'region', label: 'Region', type: 'text' },
  { key: 'date', label: 'Date', type: 'date' },
  { key: 'temp', label: 'Temperature', unit: '°C', type: 'number', digits: 1 },
  { key: 'rain', label: 'Rainfall', unit: 'mm', type: 'number', digits: 1 },
  { key: 'wind', label: 'Wind', unit: 'km/h', type: 'number', digits: 0 },
];

const stations = [
  { name: 'Alder Point', region: 'R1' },
  { name: 'Brackenridge', region: 'R1' },
  { name: 'Copper Hollow', region: 'R1' },
  { name: 'Dunmere Flats', region: 'R2' },
  { name: 'Eastholm', region: 'R2' },
  { name: 'Fenwick Ridge', region: 'R2' },
  { name: 'Gull Harbour', region: 'R3' },
  { name: 'Hartwell Pass', region: 'R3' },
  { name: 'Ivory Bay', region: 'R3' },
  { name: 'Juniper Mesa', region: 'R4' },
  { name: 'Kestrel Peak', region: 'R4' },
  { name: 'Lowmoor', region: 'R4' },
];

const dates = ['2026-03-02', '2026-03-09', '2026-03-16', '2026-03-23', '2026-03-30'];

const baseTemp = { R1: 9, R2: 14, R3: 19, R4: 2 };

function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const round1 = (value) => Math.round(value * 10) / 10;

export function generateRows(seed = 2026) {
  const random = mulberry32(seed);
  const out = [];
  let id = 1;
  for (const station of stations) {
    dates.forEach((date, week) => {
      const temp = round1(baseTemp[station.region] + week * 0.7 + (random() - 0.5) * 8);
      const rain = random() < 0.25 ? 0 : round1(random() * random() * 40);
      const wind = Math.round(6 + random() * 44);
      out.push(Object.freeze({ id: id++, station: station.name, region: station.region, date, temp, rain, wind }));
    });
  }
  return out;
}

export const rows = generateRows();
