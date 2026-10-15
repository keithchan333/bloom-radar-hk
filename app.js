(() => {
  'use strict';
  const STORAGE_KEY = 'bloom-radar-hk-v1';
  const $ = (id) => document.getElementById(id);
  const state = { mushrooms: [], candidates: [], addingMushroom: false, pendingLatLng: null, markerLayer: null, candidateLayer: null, candidateMarkers: new Map() };
  const statusLabels = { available: '空閒／可挑戰', battle: '戰鬥中', respawn: '預計重生', unknown: '未知／未確認' };
  const typeEmoji = { restaurant: '🍽️', park: '🌳', station: '🚉', shop: '🛍️', tourism: '📍', other: '📌' };
  const typeLabels = { restaurant: '餐廳候選', park: '公園／花園候選', station: '車站候選', shop: '商店／購物中心候選', tourism: '景點候選', other: '其他候選' };

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      state.mushrooms = Array.isArray(saved.mushrooms) ? saved.mushrooms : [];
    } catch { state.mushrooms = []; }
  }
  function persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, mushrooms: state.mushrooms, savedAt: new Date().toISOString() }));
    renderAll();
  }
  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }
  function formatDate(value) {
    if (!value) return '未設定';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? '未設定' : d.toLocaleString('zh-HK', { dateStyle: 'short', timeStyle: 'short' });
  }
  function isExpired(m) {
    return m.respawnAt && new Date(m.respawnAt).getTime() < Date.now();
  }
  function markerPopup(m) {
    return `<strong>${escapeHtml(m.name)}</strong><br>${escapeHtml(m.type)} · ${escapeHtml(statusLabels[m.status] || statusLabels.unknown)}<br><small>最後更新：${escapeHtml(formatDate(m.updatedAt))}</small>`;
  }
  const map = L.map('map', { zoomControl: true }).setView([22.3193, 114.1694], 11);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);
  state.markerLayer = L.layerGroup().addTo(map);
  state.candidateLayer = L.layerGroup().addTo(map);

  function renderStats() {
    $('mushroomCount').textContent = state.mushrooms.length;
    $('battleCount').textContent = state.mushrooms.filter(m => m.status === 'battle').length;
    $('watchCount').textContent = state.mushrooms.filter(m => m.watch).length;
  }
  function renderMushrooms() {
    const q = $('searchInput').value.trim().toLocaleLowerCase();
    const filter = $('statusFilter').value;
    const items = state.mushrooms.filter(m => {
      const matchesText = !q || [m.name, m.type, m.notes].some(v => String(v || '').toLocaleLowerCase().includes(q));
      return matchesText && (filter === 'all' || m.status === filter);
    }).sort((a,b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    $('mushroomList').innerHTML = items.length ? items.map(m => `
      <article class="item-card">
        <div class="item-top"><div><div class="item-title">${escapeHtml(m.name)}</div><div class="item-meta">${escapeHtml(m.type)} · ${Number(m.lat).toFixed(5)}, ${Number(m.lng).toFixed(5)}<br>最後更新：${escapeHtml(formatDate(m.updatedAt))}${m.participants !== '' && m.participants != null ? `<br>參戰人數：${escapeHtml(m.participants)}` : ''}${m.respawnAt ? `<br>預計重生：${escapeHtml(formatDate(m.respawnAt))}${isExpired(m) ? '（時間已過，請重新核實）' : ''}` : ''}${m.notes ? `<br>備註：${escapeHtml(m.notes)}` : ''}</div></div><span class="status-pill status-${escapeHtml(m.status)}">${escapeHtml(statusLabels[m.status] || statusLabels.unknown)}</span></div>
        <div class="item-actions"><button class="secondary-button" data-action="watch" data-id="${escapeHtml(m.id)}">${m.watch ? '★ 已追蹤' : '☆ 追蹤'}</button><button class="secondary-button" data-action="edit" data-id="${escapeHtml(m.id)}">編輯</button><button class="secondary-button" data-action="locate" data-id="${escapeHtml(m.id)}">地圖定位</button><button class="danger-button" data-action="delete" data-id="${escapeHtml(m.id)}">刪除</button></div>
      </article>`).join('') : '<div class="empty-state">沒有符合條件的記錄。</div>';
  }
  function renderMapMarkers() {
    state.markerLayer.clearLayers();
    state.mushrooms.forEach(m => {
      const marker = L.circleMarker([m.lat, m.lng], { radius: 8, color: '#ffffff', weight: 2, fillColor: m.status === 'battle' ? '#d28a20' : m.status === 'respawn' ? '#4269b2' : '#286a47', fillOpacity: .95 });
      marker.bindPopup(markerPopup(m));
      marker.on('click', () => { if (state.addingMushroom) openMushroomDialog({ lat: m.lat, lng: m.lng }); });
      marker.addTo(state.markerLayer);
    });
  }
  function renderAll() { renderStats(); renderMushrooms(); renderMapMarkers(); }

  function openMushroomDialog(latlng, existing = null) {
    state.pendingLatLng = latlng || (existing ? { lat: existing.lat, lng: existing.lng } : null);
    $('editId').value = existing?.id || '';
    $('dialogTitle').textContent = existing ? '編輯蘑菇記錄' : '新增蘑菇';
    $('mushroomName').value = existing?.name || '';
    $('mushroomType').value = existing?.type || '未知';
    $('mushroomStatus').value = existing?.status || 'unknown';
    $('participants').value = existing?.participants ?? '';
    $('respawnAt').value = existing?.respawnAt || '';
    $('mushroomNotes').value = existing?.notes || '';
    $('latitude').value = state.pendingLatLng?.lat ?? '';
    $('longitude').value = state.pendingLatLng?.lng ?? '';
    $('selectedCoords').textContent = state.pendingLatLng ? `座標：${Number(state.pendingLatLng.lat).toFixed(6)}, ${Number(state.pendingLatLng.lng).toFixed(6)}` : '請先在地圖選擇位置。';
    $('mushroomDialog').showModal();
  }
  function closeMushroomDialog() { $('mushroomDialog').close(); }
  map.on('click', (e) => {
    if (state.addingMushroom) {
      openMushroomDialog(e.latlng);
      state.addingMushroom = false;
      $('addMushroomBtn').textContent = '＋ 新增蘑菇';
      $('mapMessage').textContent = '請填寫資料並儲存；位置未經遊戲確認前會視為手動記錄。';
    }
  });
  $('addMushroomBtn').addEventListener('click', () => {
    state.addingMushroom = !state.addingMushroom;
    $('addMushroomBtn').textContent = state.addingMushroom ? '取消選擇位置' : '＋ 新增蘑菇';
    $('mapMessage').textContent = state.addingMushroom ? '請點擊地圖上嘅實際蘑菇位置。新增資料會標記為你手動輸入，請勿填入未確認嘅遊戲資訊。' : '提示：按「新增蘑菇」，再點擊地圖選擇位置。';
  });
  $('mushroomForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const lat = Number($('latitude').value), lng = Number($('longitude').value);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !state.pendingLatLng) { alert('請先在地圖選擇位置。'); return; }
    const id = $('editId').value || (crypto.randomUUID ? crypto.randomUUID() : `m-${Date.now()}`);
    const old = state.mushrooms.find(m => m.id === id);
    const item = { id, name: $('mushroomName').value.trim(), type: $('mushroomType').value, status: $('mushroomStatus').value, participants: $('participants').value === '' ? '' : Number($('participants').value), respawnAt: $('respawnAt').value, notes: $('mushroomNotes').value.trim(), lat, lng, watch: old?.watch || false, createdAt: old?.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString(), source: 'manual' };
    if (!item.name) { alert('請輸入位置名稱。'); return; }
    const idx = state.mushrooms.findIndex(m => m.id === id);
    if (idx >= 0) state.mushrooms[idx] = item; else state.mushrooms.push(item);
    closeMushroomDialog(); persist();
  });
  $('closeDialogBtn').addEventListener('click', closeMushroomDialog);
  $('cancelDialogBtn').addEventListener('click', closeMushroomDialog);
  $('mushroomList').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]'); if (!btn) return;
    const item = state.mushrooms.find(m => m.id === btn.dataset.id); if (!item) return;
    const action = btn.dataset.action;
    if (action === 'watch') { item.watch = !item.watch; item.updatedAt = new Date().toISOString(); persist(); }
    if (action === 'edit') openMushroomDialog({ lat: item.lat, lng: item.lng }, item);
    if (action === 'locate') { map.setView([item.lat, item.lng], 17); state.markerLayer.eachLayer(layer => { if (layer.getLatLng && layer.getLatLng().lat === item.lat && layer.getLatLng().lng === item.lng) layer.openPopup(); }); }
    if (action === 'delete' && confirm(`確定刪除「${item.name}」？`)) { state.mushrooms = state.mushrooms.filter(m => m.id !== item.id); persist(); }
  });
  $('searchInput').addEventListener('input', renderMushrooms);
  $('statusFilter').addEventListener('change', renderMushrooms);

  function selectedCategories() { return [...document.querySelectorAll('#candidateCategories input:checked')].map(el => el.value); }
  function overpassQuery(bounds, categories) {
    const s = bounds.getSouth().toFixed(6), w = bounds.getWest().toFixed(6), n = bounds.getNorth().toFixed(6), e = bounds.getEast().toFixed(6);
    const selectors = [];
    if (categories.includes('restaurant')) selectors.push(`node[amenity~"^(restaurant|cafe|fast_food|food_court)$"](${s},${w},${n},${e});way[amenity~"^(restaurant|cafe|fast_food|food_court)$"](${s},${w},${n},${e});`);
    if (categories.includes('park')) selectors.push(`node[leisure~"^(park|garden|nature_reserve)$"](${s},${w},${n},${e});way[leisure~"^(park|garden|nature_reserve)$"](${s},${w},${n},${e});relation[leisure~"^(park|garden|nature_reserve)$"](${s},${w},${n},${e});`);
    if (categories.includes('station')) selectors.push(`node[railway~"^(station|halt|tram_stop)$"](${s},${w},${n},${e});node[public_transport="station"](${s},${w},${n},${e});`);
    if (categories.includes('shop')) selectors.push(`node[shop](${s},${w},${n},${e});way[shop](${s},${w},${n},${e});node[shop="mall"](${s},${w},${n},${e});`);
    if (categories.includes('tourism')) selectors.push(`node[tourism~"^(attraction|museum|viewpoint|zoo|theme_park)$"](${s},${w},${n},${e});way[tourism~"^(attraction|museum|viewpoint|zoo|theme_park)$"](${s},${w},${n},${e});`);
    return `[out:json][timeout:25];(${selectors.join('')});out center tags;`;
  }
  function categoryFor(tags = {}) {
    if (tags.amenity && /restaurant|cafe|fast_food|food_court/.test(tags.amenity)) return 'restaurant';
    if (tags.leisure && /park|garden|nature_reserve/.test(tags.leisure)) return 'park';
    if (tags.railway || tags.public_transport === 'station') return 'station';
    if (tags.shop) return 'shop';
    if (tags.tourism) return 'tourism';
    return 'other';
  }
  function elementLatLng(el) {
    if (Number.isFinite(el.lat) && Number.isFinite(el.lon)) return [el.lat, el.lon];
    if (el.center && Number.isFinite(el.center.lat) && Number.isFinite(el.center.lon)) return [el.center.lat, el.center.lon];
    return null;
  }
  async function loadCandidates() {
    const cats = selectedCategories();
    if (!cats.length) { alert('請至少選擇一種候選地點類別。'); return; }
    const bounds = map.getBounds();
    if (bounds.getNorth() - bounds.getSouth() > 0.45 || bounds.getEast() - bounds.getWest() > 0.6) {
      if (!confirm('目前地圖範圍較大，查詢可能較慢。建議放大到一個地區。仍要繼續？')) return;
    }
    $('loadCandidatesBtn').disabled = true; $('loadCandidatesBtn').textContent = '載入中…'; $('candidateList').innerHTML = '<div class="empty-state">正在查詢 OpenStreetMap 公開資料…</div>';
    try {
      const query = overpassQuery(bounds, cats);
      const response = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' }, body: `data=${encodeURIComponent(query)}` });
      if (!response.ok) throw new Error(`Overpass 回應 ${response.status}`);
      const json = await response.json();
      const items = (json.elements || []).map(el => {
        const ll = elementLatLng(el); if (!ll) return null;
        const tags = el.tags || {}; const category = categoryFor(tags);
        return { id: `${el.type}/${el.id}`, name: tags.name || tags['name:zh'] || tags['name:en'] || typeLabels[category], category, lat: ll[0], lng: ll[1], details: [tags.amenity, tags.leisure, tags.railway, tags.shop, tags.tourism].filter(Boolean).join(' · ') || 'OSM 地點', url: `https://www.openstreetmap.org/${el.type}/${el.id}` };
      }).filter(x => x && cats.includes(x.category));
      const unique = new Map(items.map(item => [item.id, item]));
      state.candidates = [...unique.values()].slice(0, 400);
      renderCandidates();
      if (state.candidates.length) {
        state.candidateLayer.clearLayers(); state.candidateMarkers.clear();
        state.candidates.forEach(c => {
          const marker = L.circleMarker([c.lat, c.lng], { radius: 5, color: '#ffffff', weight: 1.5, fillColor: '#d39a2c', fillOpacity: .9 });
          marker.bindPopup(`<strong>${escapeHtml(c.name)}</strong><br>${escapeHtml(typeLabels[c.category])}<br><small>OSM 候選點；非遊戲確認</small><br><a href="${escapeHtml(c.url)}" target="_blank" rel="noopener">查看 OSM</a>`);
          marker.addTo(state.candidateLayer); state.candidateMarkers.set(c.id, marker);
        });
      } else {
        state.candidateLayer.clearLayers();
      }
      $('mapMessage').textContent = `已載入 ${state.candidates.length} 個 OSM 候選點。這些資料只代表地理位置，不代表遊戲內有對應飾品。`;
    } catch (err) {
      $('candidateList').innerHTML = `<div class="empty-state">未能載入候選地點。可能係公共服務繁忙、網絡或瀏覽器限制。請縮細地圖範圍後重試。<br><br><small>${escapeHtml(err.message || '查詢失敗')}</small></div>`;
      $('mapMessage').textContent = '候選點查詢失敗；蘑菇本機記錄仍然保留。';
    } finally { $('loadCandidatesBtn').disabled = false; $('loadCandidatesBtn').textContent = '載入畫面範圍候選點'; }
  }
  function renderCandidates() {
    $('candidateCount').textContent = `${state.candidates.length} 個`;
    $('candidateList').innerHTML = state.candidates.length ? state.candidates.slice(0, 120).map(c => `<div class="candidate-item"><div class="candidate-icon">${typeEmoji[c.category] || '📍'}</div><div class="candidate-copy"><strong>${escapeHtml(c.name)}</strong><p>${escapeHtml(typeLabels[c.category] || '候選地點')} · ${escapeHtml(c.details)}<br>${c.lat.toFixed(5)}, ${c.lng.toFixed(5)} · <a href="${escapeHtml(c.url)}" target="_blank" rel="noopener">OSM 資料</a><br>未經遊戲確認</p></div></div>`).join('') + (state.candidates.length > 120 ? `<div class="small-message">清單只顯示頭 120 個；地圖顯示最多 400 個。</div>` : '') : '<div class="empty-state">此範圍沒有找到所選類別；可放大地圖或更改類別。</div>';
  }
  $('loadCandidatesBtn').addEventListener('click', loadCandidates);

  $('locateBtn').addEventListener('click', () => {
    if (!navigator.geolocation) { alert('此瀏覽器不支援定位。'); return; }
    $('locateBtn').disabled = true; $('locateBtn').textContent = '定位中…';
    navigator.geolocation.getCurrentPosition(pos => {
      map.setView([pos.coords.latitude, pos.coords.longitude], 15);
      L.circleMarker([pos.coords.latitude, pos.coords.longitude], { radius: 7, color: '#fff', weight: 2, fillColor: '#356fc0', fillOpacity: 1 }).addTo(map).bindPopup('你目前嘅裝置位置（只在地圖顯示）').openPopup();
      $('locateBtn').disabled = false; $('locateBtn').textContent = '定位我';
    }, err => { alert(`無法取得位置：${err.message}`); $('locateBtn').disabled = false; $('locateBtn').textContent = '定位我'; }, { enableHighAccuracy: false, timeout: 10000 });
  });

  $('exportBtn').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify({ app: 'Bloom Radar HK', version: 1, exportedAt: new Date().toISOString(), mushrooms: state.mushrooms }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `bloom-radar-hk-${new Date().toISOString().slice(0,10)}.json`; a.click(); URL.revokeObjectURL(url);
  });
  $('importBtn').addEventListener('click', () => $('importFile').click());
  $('importFile').addEventListener('change', async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    try {
      const json = JSON.parse(await file.text());
      if (!Array.isArray(json.mushrooms)) throw new Error('檔案內沒有 mushrooms 清單');
      const valid = json.mushrooms.filter(m => m && typeof m.name === 'string' && Number.isFinite(Number(m.lat)) && Number.isFinite(Number(m.lng)) && ['available','battle','respawn','unknown'].includes(m.status)).map(m => ({ ...m, id: String(m.id || `m-${Date.now()}-${Math.random()}`), lat: Number(m.lat), lng: Number(m.lng) }));
      if (!confirm(`匯入 ${valid.length} 筆蘑菇記錄？現有記錄會被取代。`)) return;
      state.mushrooms = valid; persist(); alert('匯入完成。');
    } catch (err) { alert(`匯入失敗：${err.message}`); }
    finally { e.target.value = ''; }
  });
  $('clearBtn').addEventListener('click', () => {
    if (!confirm('確定清除這個瀏覽器內所有蘑菇記錄？建議先匯出備份。')) return;
    state.mushrooms = []; localStorage.removeItem(STORAGE_KEY); persist();
  });
  $('installHelpBtn').addEventListener('click', () => $('installDialog').showModal());
  $('closeInstallBtn').addEventListener('click', () => $('installDialog').close());

  // Reminder checks only while this page is open. It is not a background push service.
  const alerted = new Set();
  function checkVisibleReminders() {
    const now = Date.now();
    state.mushrooms.filter(m => m.watch && m.respawnAt && !isExpired(m)).forEach(m => {
      const diff = new Date(m.respawnAt).getTime() - now;
      if (diff > 0 && diff <= 5 * 60 * 1000 && !alerted.has(`${m.id}:${m.respawnAt}`)) {
        alerted.add(`${m.id}:${m.respawnAt}`);
        $('mapMessage').textContent = `提醒：${m.name} 預計 5 分鐘內重生（推算時間，請核實）。`;
        if (document.visibilityState === 'visible') alert(`Bloom Radar HK 提醒：${m.name} 預計 5 分鐘內重生。此為推算時間，請在遊戲內核實。`);
      }
    });
  }
  loadState(); renderAll(); setInterval(checkVisibleReminders, 30000);
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(err => console.warn('Service worker registration failed', err)));
  }
})();
