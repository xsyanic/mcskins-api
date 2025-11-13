# **Syanic's MC Skins API**

A API powered by Cloudflare Worker that serves Minecraft skins from multiple sources with automatic fallbacks and 24-hour edge caching.

Base URL: `https://mcskinsapi.syanic.org`

## **Endpoints**

### **Minecraft (Minotar)**

* `/skin/<player>`
* `/skin/<player>.png`
* `/skin/minecraft/<player>`
* `/skin/minecraft/<player>.png`

### **TLauncher**

* `/skin/tlauncher/<player>`
* `/skin/tlauncher/<player>.png`

### **ElyBy**

* `/skin/elyby/<player>`
* `/skin/elyby/<player>.png`

## **Fallback Logic**

If the requested provider fails (404):

1. Fetch from Minotar (`https://minotar.net/skin/<player>`)
2. If Minotar 404 → return Steve (`https://minotar.net/skin/MHF_Steve`)

## **Caching**

* Valid responses are cached at Cloudflare’s edge for **1 hour**.

## **Deploy**

```bash
wrangler deploy
```
