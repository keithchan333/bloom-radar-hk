(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const RADIUS_METERS = 1000;
  const state = { center: null, points: [], userMarker: null, radiusCircle: null, pointLayer: null, requestId: 0 };
  const labels = {
    roadside: '路邊', park: '公園', forest: '森林', waterside: '水邊', restaurant: '餐廳',
    cafe: '咖啡店', bakery: '麵包店', sweetshop: '甜品店', supermarket: '超市',
    convenience: '便利店', pharmacy: '藥房', clothing: '服裝店', station: '車站',
    airport: '機場', art: '美術館／藝術', museum: '博物館', shrine: '神社／寺廟',
    post: '郵局', beach: '海灘', bridge: '橋樑', bus: '巴士站', cinema: '戲院',
    hotel: '酒店', zoo: '動物園', amusement: '遊樂場', stadium: '體育場',
    hair: '髮廊', mountain: '山區', water: '水域', city: '城市／廣場', other: '其他地點'
  };
  const emoji = {
    roadside:'🛣️',park:'🌳',forest:'🌲',waterside:'🌊',restaurant:'🍽️',cafe:'☕',bakery:'🥐',
    sweetshop:'🍰',supermarket:'🛒',convenience:'🏪',pharmacy:'💊',clothing:'👕',station:'🚉',
    airport:'✈️',art:'🎨',museum:'🏛️',shrine:'⛩️',post:'📮',beach:'🏖️',bridge:'🌉',
    bus:'🚌',cinema:'🎬',hotel:'🏨',zoo:'🦁',amusement:'🎡',stadium:'🏟️',hair:'💇',
    mountain:'⛰️',water:'💧',city:'🏙️',other:'📍'
  };

  const map = L.map('map', { zoomControl: true }).setView([22.3193, 114.1694], 14);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);
  state.pointLayer = L.layerGroup().addTo(map);

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  }
  function distanceMeters(a, b) {
    const rad = n => n * Math.PI / 180;
    const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
    const x = Math.sin(dLat/2)**2 + Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dLng/2)**2;
    return 6371000 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1-x));
  }
  function distanceText(m) { return m < 1000 ? `${Math.round(m)} m` : `${(m/1000).toFixed(2)} km`; }

  function inferCategories(tags = {}) {
    const found = new Set();
    const amenity = String(tags.amenity || '');
    const shop = String(tags.shop || '');
    const leisure = String(tags.leisure || '');
    const tourism = String(tags.tourism || '');
    const natural = String(tags.natural || '');
    const railway = String(tags.railway || '');
    const highway = String(tags.highway || '');
    const historic = String(tags.historic || '');
    const building = String(tags.building || '');
    const landuse = String(tags.landuse || '');
    const sport = String(tags.sport || '');

    if (/restaurant|food_court|fast_food/.test(amenity)) found.add('restaurant');
    if (amenity === 'cafe' || shop === 'coffee') found.add('cafe');
    if (shop === 'bakery') found.add('bakery');
    if (/confectionery|pastry|chocolate|ice_cream/.test(shop) || amenity === 'ice_cream') found.add('sweetshop');
    if (/supermarket|greengrocer/.test(shop)) found.add('supermarket');
    if (shop === 'convenience') found.add('convenience');
    if (shop === 'chemist' || amenity === 'pharmacy') found.add('pharmacy');
    if (/clothes|fashion|shoes|boutique/.test(shop)) found.add('clothing');
    if (/station|halt|tram_stop|subway_entrance/.test(railway) || tags.public_transport === 'station' || amenity === 'bus_station') found.add('station');
    if (aeroCheck(tags)) found.add('airport');
    if (/gallery|arts_centre/.test(amenity) || /gallery|artwork/.test(tourism) || historic === 'artwork') found.add('art');
    if (amenity === 'museum' || tourism === 'museum' || historic === 'museum') found.add('museum');
    if (/place_of_worship/.test(amenity) && /shinto|buddhist|taoist/.test(String(tags.religion || ''))) found.add('shrine');
    if (amenity === 'post_office') found.add('post');
    if (natural === 'beach' || leisure === 'beach_resort') found.add('beach');
    if (manMadeBridge(tags)) found.add('bridge');
    if (highway === 'bus_stop' || tags.bus === 'yes') found.add('bus');
    if (amenity === 'cinema') found.add('cinema');
    if (tourism === 'hotel' || tourism === 'motel') found.add('hotel');
    if (tourism === 'zoo' || leisure === 'wildlife_park') found.add('zoo');
    if (/theme_park|amusement_arcade/.test(tourism) || leisure === 'amusement_arcade') found.add('amusement');
    if (leisure === 'stadium' || sport) found.add('stadium');
    if (/hairdresser|beauty/.test(shop)) found.add('hair');
    if (natural === 'wood' || landuse === 'forest' || landuse === 'orchard') found.add('forest');
    if (/park|garden|nature_reserve/.test(leisure) || landuse === 'recreation_ground') found.add('park');
    if (/river|lake|water|wetland|coastline/.test(natural) || landuse === 'reservoir') found.add('waterside');
    if (natural === 'peak' || natural === 'cliff' || tags.mountain === 'yes') found.add('mountain');
    if (/waterfall|river|lake|reservoir/.test(natural) || tags.waterway) found.add('water');
    if (amenity === 'hairdresser') found.add('hair');
    if (amenity === 'marketplace' || tags.place === 'square') found.add('city');
    if (!found.size) {
      if (shop) found.add('roadside');
      else if (amenity || tourism || historic || building || highway || railway) found.add('roadside');
      else found.add('other');
    }
    return [...found];
  }
  function aeroCheck(t) { return t.aeroway === 'aerodrome' || t.aeroway === 'terminal' || t. aeroway === 'gate'; }
  function manMadeBridge(t) { return t.man_made === 'bridge' || t.bridge === 'yes' || t.waterway === 'canal' && t.bridge; }

  function overpassQuery(lat, lng) {
    const south = lat - 0.0105, north = lat + 0.0105;
    const latDelta = 0.0105;
    const lngDelta = 0.0105 / Math.max(0.2, Math.cos(lat * Math.PI / 180));
    const box = `(${south},${lng-lngDelta},${north},${lng+lngDelta})`;
    // Wide selection of common OSM place, amenity, leisure, transport and natural features.
    return `[out:json][timeout:25];(
      node(around:${RADIUS_METERS},${lat},${lng})[name];
      way(around:${RADIUS_METERS},${lat},${lng})[name];
      relation(around:${RADIUS_METERS},${lat},${lng})[name];
      node(around:${RADIUS_METERS},${lat},${lng})[amenity];
      node(around:${RADIUS_METERS},${lat},${lng})[shop];
      node(around:${RADIUS_METERS},${lat},${lng})[leisure];
      node(around:${RADIUS_METERS},${lat},${lng})[tourism];
      node(around:${RADIUS_METERS},${lat},${lng})[natural];
      node(around:${RADIUS_METERS},${lat},${lng})[railway];
      node(around:${RADIUS_METERS},${lat},${lng})[highway="bus_stop"];
      node(around:${RADIUS_METERS},${lat},${lng})[historic];
      node(around:${RADIUS_METERS},${lat},${lng})[aeroway];
      node(around:${RADIUS_METERS},${lat},${lng})[waterway];
      way(around:${RADIUS_METERS},${lat},${lng})[amenity];
      way(around:${RADIUS_METERS},${lat},${lng})[shop];
      way(around:${RADIUS_METERS},${lat},${lng})[leisure];
      way(around:${RADIUS_METERS},${lat},${lng})[tourism];
      way(around:${RADIUS_METERS},${lat},${lng})[natural];
      way(around:${RADIUS_METERS},${lat},${lng})[landuse];
      way(around:${RADIUS_METERS},${lat},${lng})[historic];
      way(around:${RADIUS_METERS},${lat},${lng})[bridge];
      way(around:${RADIUS_METERS},${lat},${lng})[waterway];
      relation(around:${RADIUS_METERS},${lat},${lng})[leisure];
      relation(around:${RADIUS_METERS},${lat},${lng})[tourism];
    );out center tags;`;
  }

  function pointLatLng(el) {
    if (Number.isFinite(el.lat) && Number.isFinite(el.lon)) return {lat: el.lat, lng: el.lon};
    if (el.center && Number.isFinite(el.center.lat) && Number.isFinite(el.center.lon)) return {lat: el.center.lat, lng: el.center.lon};
    return null;
  }
  function nameFor(tags, cats) {
    return tags['name:zh'] || tags['name:zh-Hant'] || tags.name || tags['name:en'] || labels[cats[0]] || '未命名地點';
  }

  async function loadPoints() {
    if (!state.center) return;
    const requestId = ++state.requestId;
    $('refreshBtn').disabled = true;
    $('refreshBtn').textContent = '搜尋中…';
    $('locationStatus').textContent = `已定位：${state.center.lat.toFixed(5)}, ${state.center.lng.toFixed(5)}；搜尋半徑 1 km`;
    $('mapMessage').textContent = '正在查詢 OpenStreetMap 附近地點…';
    $('candidateList').innerHTML = '<div class="empty-state">正在載入附近地點…</div>';
    try {
      const query = overpassQuery(state.center.lat, state.center.lng);
      const endpoints = [
        'https://overpass-api.de/api/interpreter',
        'https://overpass.kumi.systems/api/interpreter'
      ];
      let json = null, lastError = null;
      for (const endpoint of endpoints) {
        try {
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: {'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'},
            body: `data=${encodeURIComponent(query)}`
          });
          if (!response.ok) throw new Error(`Overpass 回應 ${response.status}`);
          json = await response.json();
          break;
        } catch (err) { lastError = err; }
      }
      if (!json) throw lastError || new Error('無法連接 Overpass');
      if (requestId !== state.requestId) return;
      const byId = new Map();
      for (const el of (json.elements || [])) {
        const ll = pointLatLng(el);
        if (!ll) continue;
        const dist = distanceMeters(state.center, ll);
        if (dist > RADIUS_METERS) continue;
        const tags = el.tags || {};
        const cats = inferCategories(tags);
        const id = `${el.type}/${el.id}`;
        if (!byId.has(id)) byId.set(id, {
          id, name: nameFor(tags, cats), lat: ll.lat, lng: ll.lng, dist, categories: cats,
          tags, url: `https://www.openstreetmap.org/${el.type}/${el.id}`
        });
      }
      state.points = [...byId.values()].sort((a,b) => a.dist - b.dist);
      renderPoints();
      renderMarkers();
      $('mapMessage').textContent = `完成：找到 ${state.points.length} 個 OSM 地點候選。可能 Decor 類別由地理標籤推算，並非遊戲確認結果。`;
    } catch (err) {
      if (requestId !== state.requestId) return;
      $('candidateList').innerHTML = `<div class="empty-state">暫時無法載入地點。請檢查網絡／定位權限，或稍後重試。<br><small>${escapeHtml(err?.message || '查詢失敗')}</small></div>`;
      $('mapMessage').textContent = '查詢失敗；公共 OSM Overpass 服務可能繁忙或限流。';
      $('locationStatus').textContent = '地點查詢失敗';
    } finally {
      if (requestId === state.requestId) {
        $('refreshBtn').disabled = false;
        $('refreshBtn').textContent = '重新搜尋';
      }
    }
  }

  function visiblePoints() {
    const cat = $('categoryFilter').value;
    let points = state.points.filter(p => cat === 'all' || p.categories.includes(cat));
    const sort = $('sortFilter').value;
    if (sort === 'name') points.sort((a,b) => a.name.localeCompare(b.name, 'zh-Hant'));
    else if (sort === 'category') points.sort((a,b) => labels[a.categories[0]].localeCompare(labels[b.categories[0]], 'zh-Hant') || a.dist-b.dist);
    else points.sort((a,b) => a.dist-b.dist);
    return points;
  }

  function renderPoints() {
    const allCats = [...new Set(state.points.flatMap(p => p.categories))].sort((a,b) => labels[a].localeCompare(labels[b], 'zh-Hant'));
    const select = $('categoryFilter');
    const previous = select.value;
    select.innerHTML = '<option value="all">全部可能類別</option>' + allCats.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(emoji[c] || '📍')} ${escapeHtml(labels[c])}</option>`).join('');
    if (allCats.includes(previous)) select.value = previous;
    $('pointCount').textContent = String(state.points.length);
    $('categoryCount').textContent = String(allCats.length);
    const points = visiblePoints();
    $('resultCount').textContent = `${points.length} 個`;
    $('candidateList').innerHTML = points.length ? points.map(p => `
      <article class="candidate-item">
        <div class="candidate-icon">${emoji[p.categories[0]] || '📍'}</div>
        <div class="candidate-copy">
          <strong>${escapeHtml(p.name)}</strong>
          <p>${p.categories.map(c => `${emoji[c] || '📍'} ${escapeHtml(labels[c])}`).join(' · ')}<br>
          距離約 ${distanceText(p.dist)} · ${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}<br>
          <span class="prediction-label">預測類別，非遊戲確認</span> · <a href="${escapeHtml(p.url)}" target="_blank" rel="noopener">OSM 資料</a></p>
          <button class="secondary-button small-button" data-lat="${p.lat}" data-lng="${p.lng}">地圖定位</button>
        </div>
      </article>`).join('') : '<div class="empty-state">附近沒有符合條件的候選地點。可以重新搜尋或切換類別。</div>';
  }

  function renderMarkers() {
    state.pointLayer.clearLayers();
    const points = visiblePoints();
    points.forEach(p => {
      const color = categoryColor(p.categories[0]);
      const marker = L.circleMarker([p.lat, p.lng], {radius: 6, color:'#fff', weight:1.5, fillColor:color, fillOpacity:.9});
      marker.bindPopup(`<strong>${escapeHtml(p.name)}</strong><br>${p.categories.map(c => `${emoji[c] || '📍'} ${escapeHtml(labels[c])}`).join(' · ')}<br><small>OSM 推算候選點；非遊戲確認</small><br><a href="${escapeHtml(p.url)}" target="_blank" rel="noopener">查看 OSM</a>`);
      marker.addTo(state.pointLayer);
    });
  }
  function categoryColor(cat) {
    const colors = {restaurant:'#d97706',cafe:'#8b5e3c',bakery:'#b45309',park:'#15803d',forest:'#166534',station:'#2563eb',shop:'#9333ea',waterside:'#0891b2',beach:'#0e7490',art:'#db2777',shrine:'#dc2626',other:'#64748b'};
    return colors[cat] || '#c28b24';
  }

  function setCenter(lat, lng, label = '目前位置') {
    state.center = {lat, lng};
    map.setView([lat, lng], 16);
    if (state.userMarker) map.removeLayer(state.userMarker);
    if (state.radiusCircle) map.removeLayer(state.radiusCircle);
    state.userMarker = L.circleMarker([lat,lng], {radius:8,color:'#fff',weight:2,fillColor:'#2563eb',fillOpacity:1}).addTo(map).bindPopup(`${escapeHtml(label)}（只在此裝置顯示）`);
    state.radiusCircle = L.circle([lat,lng], {radius:RADIUS_METERS,color:'#2563eb',weight:2,dashArray:'6 6',fillColor:'#60a5fa',fillOpacity:.06}).addTo(map);
    loadPoints();
  }

  function locate() {
    if (!navigator.geolocation) {
      $('locationStatus').textContent = '此瀏覽器不支援定位；請用上方搜尋地點。';
      return;
    }
    $('locationStatus').textContent = '正在取得位置權限…';
    navigator.geolocation.getCurrentPosition(
      pos => setCenter(pos.coords.latitude, pos.coords.longitude, '你目前的位置'),
      err => {
        $('locationStatus').textContent = '未能定位；可搜尋城市／地點。';
        $('mapMessage').textContent = `定位失敗（${err.message}）。請允許 Safari 使用位置，或搜尋地點。`;
        $('candidateList').innerHTML = '<div class="empty-state">未取得定位。你可以輸入地點名稱搜尋，不需要分享精確地址。</div>';
      },
      {enableHighAccuracy:false, timeout:12000, maximumAge:60000}
    );
  }

  async function searchPlace() {
    const query = $('placeSearch').value.trim();
    if (!query) { $('placeSearch').focus(); return; }
    $('searchBtn').disabled = true; $('searchBtn').textContent = '搜尋中…';
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`;
      const res = await fetch(url, {headers:{'Accept':'application/json'}});
      if (!res.ok) throw new Error(`地點搜尋回應 ${res.status}`);
      const results = await res.json();
      if (!results.length) throw new Error('找不到這個地點，試試更完整的名稱。');
      setCenter(Number(results[0].lat), Number(results[0].lon), results[0].display_name || query);
    } catch (err) {
      $('locationStatus').textContent = `搜尋失敗：${err.message}`;
    } finally {
      $('searchBtn').disabled = false; $('searchBtn').textContent = '搜尋';
    }
  }

  $('locateBtn').addEventListener('click', locate);
  $('refreshBtn').addEventListener('click', loadPoints);
  $('searchBtn').addEventListener('click', searchPlace);
  $('placeSearch').addEventListener('keydown', e => { if (e.key === 'Enter') searchPlace(); });
  $('categoryFilter').addEventListener('change', () => { renderPoints(); renderMarkers(); });
  $('sortFilter').addEventListener('change', renderPoints);
  $('candidateList').addEventListener('click', e => {
    const btn = e.target.closest('button[data-lat]');
    if (!btn) return;
    const lat = Number(btn.dataset.lat), lng = Number(btn.dataset.lng);
    map.setView([lat,lng], 18);
    state.pointLayer.eachLayer(layer => {
      const ll = layer.getLatLng?.();
      if (ll && Math.abs(ll.lat-lat)<1e-7 && Math.abs(ll.lng-lng)<1e-7) layer.openPopup();
    });
  });

  // Request location on page open; geolocation only works on HTTPS or localhost.
  locate();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(err => console.warn('Service worker registration failed', err)));
  }
})();