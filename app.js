// ===== 基本要素 =====
const cityInput = document.getElementById('city-input');
const searchBtn = document.getElementById('search-btn');
const geoBtn = document.getElementById('geo-btn');
const unitSelect = document.getElementById('unit-select');

const errorMsg = document.getElementById('error-msg');
const weatherResult = document.getElementById('weather-result');
const statusBox = document.getElementById('status');
const historyBox = document.getElementById('history');

const themeBtn = document.getElementById('theme-btn');
const clearHistoryBtn = document.getElementById('clear-history-btn');
const shareLink = document.getElementById('share-link');

// ===== あなたのAPIキーに差し替え =====
const API_KEY = '8feafb00587ad2aae401173a0ab2d200';

// ===== 保存キー =====
const LS = {
  theme: 'wx_theme',
  unit: 'wx_unit',
  history: 'wx_history'
};

// ===== ヘルパー =====
function setLoading(isLoading, text = '読み込み中...') {
  statusBox.style.display = isLoading ? 'block' : 'none';
  statusBox.textContent = isLoading ? text : '';
  searchBtn.disabled = isLoading;
  geoBtn.disabled = isLoading;
}

function showError(text) {
  errorMsg.style.display = 'block';
  errorMsg.textContent = text;
}

function clearError() {
  errorMsg.style.display = 'none';
}

function showResult(show) {
  weatherResult.style.display = show ? 'block' : 'none';
}

function clampHistory(items, max = 8) {
  return items.slice(0, max);
}

// Unix秒 + タイムゾーンオフセット（秒）を "HH:MM" 表示
function unixToTimeWithOffset(unixSec, offsetSec = 0) {
  // UTC基準で (unix + offset) を時刻として扱う
  const d = new Date((unixSec + offsetSec) * 1000);
  const h = String(d.getUTCHours()).padStart(2, '0');
  const m = String(d.getUTCMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

// 風向き（度）→ 方角
function degToDirection(deg) {
  const dirs = ['北', '北北東', '北東', '東北東', '東', '東南東', '南東', '南南東', '南', '南南西', '南西', '西南西', '西', '西北西', '北西', '北北西'];
  return dirs[Math.round(deg / 22.5) % 16];
}

function formatTemp(v, unit) {
  if (v === undefined || v === null || Number.isNaN(v)) return '—';
  const u = unit === 'imperial' ? '℉' : '℃';
  return `${Math.round(v)}${u}`;
}

function formatWindSpeed(v, unit) {
  if (v === undefined || v === null || Number.isNaN(v)) return '—';
  // OpenWeatherのunitsに合わせて表示（metric: m/s, imperial: miles/hour）
  const u = unit === 'imperial' ? 'mph' : 'm/s';
  return `${v} ${u}`;
}

function formatVisibility(meters) {
  if (meters === undefined || meters === null || Number.isNaN(meters)) return '—';
  return `${(meters / 1000).toFixed(1)} km`;
}

function formatPressure(hPa) {
  if (hPa === undefined || hPa === null || Number.isNaN(hPa)) return '—';
  return `${hPa} hPa`;
}

function formatPercent(p) {
  if (p === undefined || p === null || Number.isNaN(p)) return '—';
  return `${p}%`;
}

function safeText(id, text) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
}

function safeHTML(id, html) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = html;
}

// タイムアウト付き fetch
async function fetchJson(url, timeoutMs = 10000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    const data = await res.json();
    return { ok: res.ok, status: res.status, data };
  } finally {
    clearTimeout(t);
  }
}

// ===== 履歴（LocalStorage）=====
function loadHistory() {
  try {
    const raw = localStorage.getItem(LS.history);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function saveHistory(city) {
  const cityTrim = city.trim();
  if (!cityTrim) return;
  const now = loadHistory();
  const next = [cityTrim, ...now.filter(x => x !== cityTrim)];
  localStorage.setItem(LS.history, JSON.stringify(clampHistory(next)));
  renderHistory();
}

function renderHistory() {
  const items = loadHistory();
  historyBox.innerHTML = '';
  items.forEach(name => {
    const b = document.createElement('button');
    b.className = 'chip';
    b.type = 'button';
    b.textContent = name;
    b.addEventListener('click', () => {
      cityInput.value = name;
      getWeatherByCity(name);
    });
    historyBox.appendChild(b);
  });
}

function clearHistory() {
  localStorage.removeItem(LS.history);
  renderHistory();
}

// ===== テーマ/単位 保存 =====
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(LS.theme, theme);
}

function toggleTheme() {
  const cur = document.documentElement.getAttribute('data-theme') || 'light';
  applyTheme(cur === 'dark' ? 'light' : 'dark');
}

function applyUnit(unit) {
  unitSelect.value = unit;
  localStorage.setItem(LS.unit, unit);
}

// ===== URL共有（クエリ）=====
function setShareLink(city) {
  const url = new URL(location.href);
  url.searchParams.set('city', city);
  shareLink.href = url.toString();
}

// ===== 表示 =====
function renderWeather(data, unit) {
  const tz = typeof data.timezone === 'number' ? data.timezone : 0;

  // 都市名
  safeText('city-name', `${data.name}（${data.sys?.country ?? '—'}）`);

  // 観測日時（現地時刻っぽく表示）
  const observed = data.dt ? new Date((data.dt + tz) * 1000).toUTCString() : '';
  // 日本語表示のため、UTC文字列ではなくローカル整形＋補足
  safeText('observed-at', data.dt
    ? `観測日時：${new Date(data.dt * 1000).toLocaleString('ja-JP')}（端末時刻基準）`
    : '観測日時：—'
  );

  // アイコン/説明
  const iconCode = data.weather?.[0]?.icon;
  if (iconCode) {
    safeHTML('weather-icon', `<img src="https://openweathermap.org/img/wn/${iconCode}@2x.png" alt="天気アイコン">`);
  } else {
    safeHTML('weather-icon', '');
  }
  safeText('weather-desc', `天気：${data.weather?.[0]?.description ?? '—'}`);

  // 主要値（大きな温度）
  safeText('temperature', formatTemp(data.main?.temp, unit));

  // 詳細
  safeText('feels-like', `体感：${formatTemp(data.main?.feels_like, unit)}`);
  safeText('temp-min-max', `${formatTemp(data.main?.temp_min, unit)} / ${formatTemp(data.main?.temp_max, unit)}`);
  safeText('humidity', formatPercent(data.main?.humidity));
  safeText('pressure', formatPressure(data.main?.pressure));
  safeText('visibility', `視程：${formatVisibility(data.visibility)}`);

  safeText('wind-speed', `風速：${formatWindSpeed(data.wind?.speed, unit)}`);
  const deg = data.wind?.deg;
  safeText('wind-deg', (deg === undefined || deg === null)
    ? '風向：—'
    : `風向：${degToDirection(deg)}（${deg}°）`
  );

  safeText('clouds', `雲量：${formatPercent(data.clouds?.all)}`);

  // 雨/雪（1hがあれば表示、なければ「データなし」）
  const rain1h = data.rain?.['1h'];
  const snow1h = data.snow?.['1h'];
  safeText('rain', (rain1h !== undefined) ? `雨量（1h）：${rain1h} mm` : '雨量：データなし');
  safeText('snow', (snow1h !== undefined) ? `雪量（1h）：${snow1h} mm` : '雪量：データなし');

  // 日の出/日の入（現地オフセット考慮）
  safeText('sunrise', data.sys?.sunrise ? `日の出：${unixToTimeWithOffset(data.sys.sunrise, tz)}` : '日の出：—');
  safeText('sunset', data.sys?.sunset ? `日の入：${unixToTimeWithOffset(data.sys.sunset, tz)}` : '日の入：—');

  safeText('coordinates', `緯度 / 経度：${data.coord?.lat ?? '—'} / ${data.coord?.lon ?? '—'}`);

  showResult(true);
}

// ===== 取得（都市名 → 緯度経度 → 天気）=====
// ※ あなたの既存方針（Geocoding API → 天気API の2段）を踏襲しつつ強化しています [1](https://microsoftapc.sharepoint.com/teams/AzureIDConcentrix/_layouts/15/Doc.aspx?action=edit&mobileredirect=true&wdorigin=Sharepoint&DefaultItemOpen=1&sourcedoc={7a19074a-577c-4f1b-8705-850daea529b1}&wd=target(/Yuki Nishimura/--- test検証 その他 ---.one/)&wdpartid={083584ab-094b-42b8-b628-2db392a2799d}{1}&wdsectionfileid={9e4b44c8-01a7-467c-97fd-7ab8daa81f5d})
async function getWeatherByCity(cityRaw) {
  const city = (cityRaw ?? cityInput.value).trim();
  const unit = unitSelect.value;

  clearError();
  showResult(false);

  if (!city) {
    showError('都市名が空です。入力してから検索してください。');
    return;
  }

  setLoading(true, '都市を検索しています...');

  try {
    // ① Geocoding API
    const geoUrl = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(city)}&limit=1&appid=${API_KEY}`;
    const geo = await fetchJson(geoUrl);

    if (!geo.ok) {
      showError(`都市検索に失敗しました（HTTP ${geo.status}）`);
      return;
    }
    if (!Array.isArray(geo.data) || geo.data.length === 0) {
      showError('残念！該当結果は見つかりませんでした！');
      return;
    }

    const { lat, lon, name } = geo.data[0];

    setLoading(true, '天気情報を取得しています...');

    // ② Weather API
    const wUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=${unit}&lang=ja`;
    const w = await fetchJson(wUrl);

    if (!w.ok || w.data?.cod !== 200) {
      showError('天気情報の取得に失敗しました。入力を変えて再度お試しください。');
      return;
    }

    // 反映
    renderWeather(w.data, unit);
    saveHistory(city);
    setShareLink(city);

  } catch (e) {
    if (String(e).includes('AbortError')) {
      showError('通信がタイムアウトしました。ネットワーク状況を確認して再度お試しください。');
    } else {
      showError('通信に失敗しました。ネットワーク状況を確認して再度お試しください。');
    }
  } finally {
    setLoading(false);
  }
}

// ===== 取得（現在地）=====
async function getWeatherByGeolocation() {
  clearError();
  showResult(false);

  if (!navigator.geolocation) {
    showError('このブラウザでは位置情報が利用できません。');
    return;
  }

  setLoading(true, '現在地を取得しています...');

  navigator.geolocation.getCurrentPosition(async pos => {
    try {
      const unit = unitSelect.value;
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;

      setLoading(true, '天気情報を取得しています...');

      const wUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=${unit}&lang=ja`;
      const w = await fetchJson(wUrl);

      if (!w.ok || w.data?.cod !== 200) {
        showError('現在地の天気情報の取得に失敗しました。');
        return;
      }

      renderWeather(w.data, unit);
      // city名があるなら履歴に入れる
      if (w.data?.name) {
        saveHistory(w.data.name);
        setShareLink(w.data.name);
      }

    } catch {
      showError('通信に失敗しました。ネットワーク状況を確認して再度お試しください。');
    } finally {
      setLoading(false);
    }
  }, err => {
    setLoading(false);
    showError('位置情報の取得が許可されませんでした（ブラウザ設定をご確認ください）。');
  }, { enableHighAccuracy: false, timeout: 8000 });
}

// ===== イベント =====
searchBtn.addEventListener('click', () => getWeatherByCity());
cityInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') getWeatherByCity();
});

// 単位変更：表示中なら同じ都市で再取得（精度を保つ）
unitSelect.addEventListener('change', () => {
  localStorage.setItem(LS.unit, unitSelect.value);
  // 直近のcityクエリで再検索
  const city = cityInput.value.trim();
  if (city) getWeatherByCity(city);
});

geoBtn.addEventListener('click', getWeatherByGeolocation);

themeBtn.addEventListener('click', toggleTheme);
clearHistoryBtn.addEventListener('click', clearHistory);

// ===== 初期化 =====
(function init() {
  // 履歴描画
  renderHistory();

  // テーマ
  const savedTheme = localStorage.getItem(LS.theme);
  if (savedTheme === 'dark' || savedTheme === 'light') {
    applyTheme(savedTheme);
  } else {
    // 既定：OS設定がダークならダーク
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(prefersDark ? 'dark' : 'light');
  }

  // 単位
  const savedUnit = localStorage.getItem(LS.unit);
  if (savedUnit === 'metric' || savedUnit === 'imperial') {
    applyUnit(savedUnit);
  }

  // URLに city があれば自動検索（共有リンク）
  const url = new URL(location.href);
  const city = url.searchParams.get('city');
  if (city) {
    cityInput.value = city;
    getWeatherByCity(city);
  }
})();
