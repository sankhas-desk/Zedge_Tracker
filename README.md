<div align="center">

# 📊 Zedge Tracker

**Know exactly how many wallpapers you can upload today, and how much they've earned you.**

A tiny floating panel for the Zedge upload dashboard.

![Tampermonkey](https://img.shields.io/badge/Tampermonkey-userscript-00485b?style=flat-square)
![Version](https://img.shields.io/badge/version-2.1-5eead4?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-fcd34d?style=flat-square)

</div>

---

## ✨ What it does

Zedge lets you upload **100 items per 28 days**. Counting that in your head is no fun, so this script does it for you.

| | |
|---|---|
| 🎯 **Daily allowance** | Shows how many you can upload *today* to stay on pace (about 3 a day), and unused uploads carry over to the next day. |
| 📈 **Progress bar** | See your 28-day usage (`used / 100`) at a glance. |
| 🔄 **Rolling mode** | After your first 28 days, it switches to a true rolling window and tells you how many slots free up tomorrow. |
| 💵 **Live earnings** | Shows your Zedge revenue since a date you choose. It refreshes every 5 minutes, or click it to refresh now. |
| 🗓️ **History** | Every day's count is listed, so you can fix a mistake or delete an entry. |
| 🌏 **Sri Lanka time** | Days roll over at midnight in `Asia/Colombo` (UTC+5:30). |
| 🫥 **Collapsible** | Click the header to tuck it away when you don't need it. |

## 🚀 Install

1. Install [Tampermonkey](https://www.tampermonkey.net/) for your browser.
2. Open [`zedge-tracker.user.js`](./zedge-tracker.user.js) and click **Raw**. Tampermonkey will offer to install it.
3. Visit [upload.zedge.net](https://upload.zedge.net/) and look for the panel in the bottom-right corner.

## 🕹️ How to use it

1. **First run:** type how many images you've uploaded today (use `0` if none yet) and press **Add**. That starts **day 1** of your 28 days.
2. **After each upload session:** enter the number and press **Add**. Need to log a past day? Change the date first.
3. Watch the big number. That's how many you can upload today.

## 💵 Earnings setup

The script shows earnings from a fixed start date. To change it, edit this line near the top:

```js
const EARN_START = '2026-10-18';   // YYYY-MM-DD
```

Open your **business dashboard** page on Zedge so the panel can find your business and show the total.

## 💾 Your data

Everything is stored **locally in your browser** through Tampermonkey. Nothing is sent anywhere except Zedge's own API for your earnings.

**Back it up:** Tampermonkey dashboard → open the script → **Storage** tab (set *Config mode* to **Advanced** in Settings if you can't see it) → copy the value of `zedgeTracker_v1`. Paste it back into the same key to restore.

## 🛠️ How the earnings part works

The dashboard is a single-page app that already talks to Zedge's API. The script copies the request settings from the page's own calls (in memory only, never stored) and reuses them to ask for your revenue total. No passwords or tokens are written to disk, and none are in this repo.

## ⚠️ Heads up

- This is an unofficial, community-made tool and is **not affiliated with Zedge**.
- If Zedge changes its dashboard or API, the earnings line may stop working. The upload tracker will keep working regardless.
- The 100-per-28-days limit is hard-coded as `LIMIT` and `WINDOW` at the top of the script, so you can adjust them if Zedge's rules change.

## 📄 License

[MIT](./LICENSE). Use it, tweak it, share it.

---

<div align="center">

Made with ☕ in Sri Lanka by [sankhas-desk](https://github.com/sankhas-desk)

</div>
