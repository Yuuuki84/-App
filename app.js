const cityInput     = document.getElementById('city-input');
const searchBtn     = document.getElementById('search-btn');
const errorMsg      = document.getElementById('error-msg');
const weatherResult = document.getElementById('weather-result');

const API_KEY = '8feafb00587ad2aae401173a0ab2d200';

// Unix時刻を「HH:MM」に変換
function unixToTime(unix) {
  const date = new Date(unix * 1000);
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return h + ':' + m;
}

// 風向きを方角に変換
function degToDirection(deg) {
  const dirs = ['北', '北北東', '北東', '東北東', '東', '東南東', '南東', '南南東',
                '南', '南南西', '南西', '西南西', '西', '西北西', '北西', '北北西'];
  return dirs[Math.round(deg / 22.5) % 16];
}

async function getWeather() {
  const city = cityInput.value.trim();
  if (city === '') return;

  // ── STEP1: 都市名 → 緯度・経度に変換（Geocoding API）──
  const geoUrl = `https://api.openweathermap.org/geo/1.0/direct?q=${city}&limit=1&appid=${API_KEY}`;
  const geoResponse = await fetch(geoUrl);
  const geoData = await geoResponse.json();

  // 都市が見つからなかった場合
  if (geoData.length === 0) {
    errorMsg.style.display = 'block';
    weatherResult.style.display = 'none';
    return;
  }

  // 緯度・経度を取り出す
  const lat = geoData[0].lat;
  const lon = geoData[0].lon;

  // ── STEP2: 緯度・経度 → 天気情報を取得 ──
  const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric&lang=ja`;
  const response = await fetch(weatherUrl);
  const data = await response.json();

  console.log(data); // 確認用

  if (data.cod !== 200) {
    errorMsg.style.display = 'block';
    weatherResult.style.display = 'none';
    return;
  }

  // ── STEP3: 画面に表示 ──
  errorMsg.style.display = 'none';
  weatherResult.style.display = 'block';

  document.getElementById('city-name').textContent
    = data.name + '（' + data.sys.country + '）';

  const iconCode = data.weather[0].icon;
  document.getElementById('weather-icon').innerHTML
    = `<img src="https://openweathermap.org/img/wn/${iconCode}@2x.png" alt="天気アイコン">`;
  document.getElementById('weather-desc').textContent
    = '天気：' + data.weather[0].description;

  document.getElementById('temperature').textContent
    = '気温：' + data.main.temp + '℃';
  document.getElementById('feels-like').textContent
    = '体感気温：' + data.main.feels_like + '℃';
  document.getElementById('temp-min-max').textContent
    = '最低 / 最高：' + data.main.temp_min + '℃ / ' + data.main.temp_max + '℃';

  document.getElementById('humidity').textContent
    = '湿度：' + data.main.humidity + '%';
  document.getElementById('pressure').textContent
    = '気圧：' + data.main.pressure + ' hPa';

  document.getElementById('visibility').textContent
    = '視程：' + (data.visibility / 1000).toFixed(1) + ' km';

  document.getElementById('wind-speed').textContent
    = '風速：' + data.wind.speed + ' m/s';
  document.getElementById('wind-deg').textContent
    = '風向：' + degToDirection(data.wind.deg) + '（' + data.wind.deg + '°）';

  document.getElementById('clouds').textContent
    = '雲量：' + data.clouds.all + '%';

  document.getElementById('rain').textContent
    = data.rain ? '雨量（1h）：' + (data.rain['1h'] ?? 0) + ' mm' : '雨量：データなし';
  document.getElementById('snow').textContent
    = data.snow ? '雪量（1h）：' + (data.snow['1h'] ?? 0) + ' mm' : '雪量：データなし';

  document.getElementById('sunrise').textContent
    = '日の出：' + unixToTime(data.sys.sunrise);
  document.getElementById('sunset').textContent
    = '日の入り：' + unixToTime(data.sys.sunset);

  document.getElementById('coordinates').textContent
    = '緯度 / 経度：' + data.coord.lat + ' / ' + data.coord.lon;

  document.getElementById('observed-at').textContent
    = '観測日時：' + new Date(data.dt * 1000).toLocaleString('ja-JP');
}

searchBtn.addEventListener('click', getWeather);

cityInput.addEventListener('keydown', function(e) {
  if (e.key === 'Enter') getWeather();
});