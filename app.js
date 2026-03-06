const cityInput     = document.getElementById('city-input');
const searchBtn     = document.getElementById('search-btn');
const errorMsg      = document.getElementById('error-msg');
const weatherResult = document.getElementById('weather-result');
const cityName      = document.getElementById('city-name');
const weatherDesc   = document.getElementById('weather-desc');
const temperature   = document.getElementById('temperature');

const API_KEY = '8feafb00587ad2aae401173a0ab2d200';

async function getWeather() {
  const city = cityInput.value.trim();
  if (city === '') return;

  const url = `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${API_KEY}&units=metric&lang=ja`;

  const response = await fetch(url);
  const data = await response.json();

  if (data.cod !== 200) {
    errorMsg.style.display = 'block';
    weatherResult.style.display = 'none';
    return;
  }

  errorMsg.style.display = 'none';
  weatherResult.style.display = 'block';

  cityName.textContent = data.name;
  weatherDesc.textContent = '天気：' + data.weather[0].description;
  temperature.textContent = '気温：' + data.main.temp + '℃';
}

searchBtn.addEventListener('click', getWeather);

cityInput.addEventListener('keydown', function(e) {
  if (e.key === 'Enter') getWeather();
});