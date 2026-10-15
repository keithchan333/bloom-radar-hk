# Bloom Radar HK — iPhone/iPad PWA 試用版

一個靜態、手機優先的香港地圖工具。蘑菇記錄由使用者手動輸入並儲存在目前瀏覽器的 `localStorage`；Detector 候選點由 OpenStreetMap Overpass API 即時查詢，**只係地理候選點，並非 Pikmin Bloom 遊戲已確認資料**。

## 功能

- 香港互動地圖（Leaflet + OpenStreetMap）
- 手動新增、編輯、刪除蘑菇位置
- 狀態、種類、參戰人數、預計重生時間及備註
- 搜尋、狀態篩選、追蹤清單及地圖定位
- 查詢目前地圖範圍內 OSM 餐廳、公園、車站、商店及景點候選點
- JSON 匯出／匯入備份
- PWA manifest、service worker 及 iOS 主畫面安裝說明
- 追蹤中的重生時間會在頁面開啟時檢查；接近預計重生時顯示提醒

## 明確限制

1. 不連接 Pikmin Bloom 或 Niantic 帳戶，不會自動讀取全港蘑菇、參戰人數、戰鬥狀態或 Detector 結果。
2. 預設蘑菇清單為空，沒有植入任何假裝真實的蘑菇位置。
3. OSM 候選點不代表遊戲中一定存在對應飾品、蘑菇或花苗。
4. 本機記錄只在同一瀏覽器／裝置保存，不會跨裝置同步。請定期匯出 JSON。
5. 沒有伺服器推送。倒數提醒只在頁面開啟時檢查，iOS 將網頁放到背景或關閉後不保證觸發。
6. Leaflet、OpenStreetMap tiles 及 Overpass 查詢需要網絡。Overpass 是公共服務，可能限流或暫時不可用。
7. 地圖及 OSM 資料請遵守 OpenStreetMap 使用政策與歸屬要求。

## 本機測試

需要 Node.js 或 Python 以外的任何 build step 都不需要；可以用 Python 內建靜態伺服器：

```bash
cd bloom-radar-hk
python3 -m http.server 8080
```

在同一部電腦開啟 `http://localhost:8080`。要用 iPhone 安裝 PWA，應部署到 HTTPS 網址；`localhost` 只適用於本機測試。

## 部署到 GitHub Pages（免費靜態託管）

1. 建立 GitHub repository，例如 `bloom-radar-hk`。
2. 上傳此資料夾內所有檔案，保持 `index.html` 位於 repository 根目錄。
3. 開啟 repository 的 **Settings → Pages**。
4. 在 **Build and deployment** 選擇 **Deploy from a branch**，Branch 選 `main`、folder 選 `/(root)`，按 Save。
5. 等待 Pages 完成部署，取得 `https://<your-github-username>.github.io/bloom-radar-hk/` 網址。
6. 用 iPhone/iPad 的 Safari 開啟網址，按分享按鈕 → **加入主畫面**。
7. 重新開啟主畫面上的 Bloom Radar HK，允許定位（如需要）並測試新增記錄。

> 如果部署在 repository 子路徑，所有資源均使用相對路徑，應可正常運作。

## 更新及備份

- 修改檔案後推送至 `main`，GitHub Pages 會重新部署。
- 在「備份及資料管理」匯出 JSON；匯入會取代目前本機記錄。
- 不要分享含有私人位置或個人備註的備份檔。

## 使用的外部服務

- Leaflet 1.9.4 CDN：互動地圖程式庫
- OpenStreetMap tiles：地圖底圖
- OpenStreetMap Overpass API：候選地點查詢

## 專案結構

```text
bloom-radar-hk/
├── index.html
├── styles.css
├── app.js
├── manifest.webmanifest
├── sw.js
├── README.md
└── icons/
    ├── icon.svg
    ├── icon-192.png
    └── icon-512.png
```
