# SnapWrap Desktop Strategy & Technical Architecture

This document outlines the market landscape, technical solutions for event-day execution hurdles, and the phased roadmap for building the SnapWrap native desktop application.

---

## 1. Competitive Landscape & Positioning

| Product | Key Strengths | Key Weaknesses | SnapWrap Advantage |
| :--- | :--- | :--- | :--- |
| **Darkroom** | Outstanding print design engine, direct DSLR integration. | High price, outdated UX, locked to Windows tablet/DSLR setups. | Provide modern cloud CRM + browser-based AI print designers. |
| **Snappic** | Highly optimized for social activations (GIFs, Boomerangs). | Clunky dashboard management, lacks business tools, no AI capabilities. | Combine business suite and modern sharing mechanics. |
| **Simple Booth** | Very simple setup for amateur operators. | High subscription progression costs, minimal customization. | Deep customization engine combined with simple client management. |
| **Booth.Events** | Cloud-based management workflow. | Subpar live execution tools, sluggish UI. | Superior template flexibility and local offline resilience. |

---

## 2. Differentiators & Moats

### A. The Distributed QR Guest Session Model
Traditional photo booths force users to stand in a single physical queue to interact, take photos, and input emails.
* **The Concept:** Guests scan a QR code placed on physical tables, backdrops, or signage. This opens a private camera and session portal directly on their own mobile browsers.
* **The Impact:** Offloads capture, gallery selection, and social sharing onto guests' personal devices. The physical booth stays open for high-traffic sessions, dramatically boosting overall event capture counts and engagement.

### B. AI-Powered Template Editor
Operators spend unbillable hours manually creating frames and layouts in Photoshop.
* **The Concept:** A prompt-to-layout generator. The user describes the design style (e.g., *"clean minimal 2x6 strip for a wedding with gold foil accents and floral details"*), and the AI produces transparent overlay frames with mapped coordinates.
* **The Impact:** Reduces template design overhead from 2 hours to 30 seconds.

---

## 3. Resolving Event-Day Friction via Desktop Architecture

Relying entirely on web connections at live event venues is highly risky. Spotty Wi-Fi, concrete walls, and cell congestion frequently interrupt service. A native Electron desktop client running on Windows or macOS resolves these issues by acting as a local execution engine.

```
       EVENT VENUE (LOCAL LAN)
+------------------------------------+
|  [ Electron Desktop Application ]  |
|                 |                  |
|        (Direct OS Spooling)        |
|                 v                  |
|      [ Dye-Sublimation Printer ]   |
|                 |                  |
|     (Local Express Server)         |
|                 v                  |
|    [ Guest Phone Web Portals ]     |
|                 |                  |
|          (Local Database)          |
|                 v                  |
|          [ SQLite Cache ]          |
+-----------------|------------------+
                  |
         (When Online Syncs)
                  v
         [ Supabase Cloud ]
```

### Solution 1: Direct OS Printing Spool
* **The Web Limit:** Web browsers are sandboxed and cannot send print commands without opening native dialogs, which ruins automation.
* **The Desktop Solution:** Electron integrates Node.js, allowing background printing via OS spoolers (Windows Spooler / macOS CUPS) or directory watching ("hot-folders") to trigger printing immediately upon image render.

### Solution 2: 100% Offline Resilience
* **The Web Limit:** Spotty network signals freeze the interface or prevent files from uploading.
* **The Desktop Solution:** Photos are saved locally to disk, and all event logs are committed to a local SQLite database. Synchronizations to Supabase Storage and Databases happen in the background whenever an internet connection is established.

### Solution 3: LAN Local Server for Deadzones
* **The Web Limit:** Guests cannot load QR portals if they have no mobile data inside a venue.
* **The Desktop Solution:** The desktop client runs a local web server (e.g., Express.js). The operator brings a local travel router (no external internet needed). Guests connect to this Wi-Fi signal, and scanning the QR code loads the app directly off the laptop's local network IP.

---

## 4. Priority Roadmap

### Tier 1 — Core Execution & Moat
* **Desktop App Shell:** Offline-first Electron window with local file system caching.
* **Local Print Spooler:** Auto-trigger native printer drivers on new uploads.
* **Guest QR Session Flow:** Instant local mobile portals via QR scan.

### Tier 2 — AI & Complete Web Features
* **AI Print Designer:** Prompt-to-layout generation.
* **Public Mobile Web Capture:** In-browser mobile web camera interface.
* **SMS & Email Delivery:** Queued background delivery of photos.

### Tier 3 — Business Management Suite
* **Booking Pipeline:** Direct calendar bookings via public operator profiles.
* **Invoicing & Contracts:** Integrated billing and signature capture.
* **Client CRM:** Database of event host histories and contact details.

### Tier 4 — Scale & Marketplace
* **White-label Branding:** Custom domains and removal of SnapWrap branding.
* **Template Marketplace:** Allow operators to share or sell custom print layouts.
* **Zapier & Integrations:** Connect booking data to external workflows (HoneyBook, etc.).
