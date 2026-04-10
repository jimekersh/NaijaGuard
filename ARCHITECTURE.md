# NaijaGuard: Initial System Architecture

## 1. High-Level Architecture
NaijaGuard follows a **Real-Time Event-Driven Architecture** optimized for the Nigerian mobile-first context.

### A. Frontend (The Client)
*   **Framework:** React (Vite) for a fast, responsive Single Page Application (SPA).
*   **Styling:** Tailwind CSS for utility-first, mobile-responsive design.
*   **Real-Time:** Socket.io-client for instant alert reception.
*   **Offline Support:** Service Workers (PWA) for asset caching and offline resilience.
*   **Localization:** Multi-language state management (English, Pidgin, Hausa, Yoruba, Igbo).

### B. Backend (The Server)
*   **Runtime:** Node.js with Express.
*   **Real-Time Engine:** Socket.io for bi-directional event broadcasting.
*   **AI Engine:** Gemini 3 Flash for automated threat classification and credibility scoring.
*   **Ingestion Layer:** REST API for Web/Mobile and an SMS Gateway simulation for feature phones.

### F. Low-Connectivity & Non-Smartphone Support
*   **Unified Ingestion:** All reports (Web, SMS, USSD) flow through the same `ingestReport` logic, ensuring consistent AI classification and credibility scoring.
*   **SMS Reporting:** Users can send a structured SMS (e.g., `KIDNAPPING Lagos Ikeja Men with guns`) to a shortcode. The system parses this and triggers the same alert engine.
*   **USSD Interaction:** A `*384#` style menu allows non-smartphone users to report threats and check recent alerts via a text-based interface.
*   **Multi-Channel Alerts:** 
    *   **Smartphone:** Real-time Socket.io push notifications.
    *   **Feature Phone:** Automated SMS broadcasts for critical threats in the user's registered state/LGA.
*   **Offline Sync (Web App):**
    *   **Caching:** Reports are cached in `localStorage` for offline viewing.
    *   **Sync Queue:** Reports created while offline are stored in a queue and automatically synced to the server once a connection is re-established.
    *   **Optimistic UI:** Offline reports appear in the feed with a "Syncing..." indicator to provide immediate feedback.

---

## 3. Wireframe Descriptions

1.  **Dashboard (Feed View):**
    *   Top: Sticky header with logo, language selector, and Low Data toggle.
    *   Middle: Stats cards (Verified vs. Active) followed by risk-level filters.
    *   Content: Scrollable list of threat cards with AI insights and community verification buttons.
2.  **Threat Map View:**
    *   A full-width interactive SVG radar showing the user's position relative to nearby threats.
    *   Threats are color-coded by risk level (Red = Critical, Amber = Moderate).
3.  **Report Submission Modal:**
    *   A bottom-sheet modal with clear labels and a toggle for anonymity.
    *   Includes a "Broadcast" button for immediate alert propagation.

1.  **Ingestion & AI:** (As previously defined).
2.  **Alert Trigger:**
    *   Once a report is saved, an `INTERNAL_REPORT_READY` event is emitted.
    *   The **Alert Engine** listens for this event.
3.  **Prioritization:**
    *   If `urgency == 'critical'` AND `credibility > 0.7`, it is flagged for **Immediate Broadcast**.
    *   Otherwise, it waits for at least 2 community verifications before a wide-radius broadcast.
4.  **Geo-Matching:**
    *   The engine scans active user locations (from socket metadata or `users` table).
    *   Users within the threat radius (e.g., 5km) are selected.
5.  **Multi-Channel Delivery:**
    *   **Push:** Sent via `emergency_alert` socket event.
    *   **SMS:** Simulated log entry for the SMS gateway.
6.  **Verification Loop:** (As previously defined).

---

## 3. Initial Tech Stack
*   **Frontend:** React 19, Vite, Tailwind CSS, Framer Motion, Lucide React.
*   **Backend:** Node.js, Express, Socket.io, tsx.
*   **Database:** SQLite (better-sqlite3).
*   **AI:** Google Gemini 3 Flash.
*   **Communication:** WebSockets (Socket.io), Fetch API.

---

## 4. Basic Database Schema

### `reports` Table
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | TEXT (PK) | Unique report identifier |
| `userId` | TEXT | Identifier of the reporter |
| `isAnonymous` | INTEGER | Boolean flag (0/1) |
| `category` | TEXT | Threat type (e.g., 'banditry') |
| `description` | TEXT | User-provided details |
| `state` | TEXT | Nigerian State |
| `lga` | TEXT | Local Government Area |
| `timestamp` | INTEGER | Unix timestamp |
| `riskLevel` | TEXT | AI-assigned urgency (low, moderate, high, critical) |
| `isVerified` | INTEGER | Boolean flag (0/1) |
| `aiScore` | REAL | AI-assigned credibility (0.0 - 1.0) |

### `verifications` Table
| Column | Type | Description |
| :--- | :--- | :--- |
| `reportId` | TEXT (FK) | Reference to the report |
| `userId` | TEXT (FK) | Reference to the verifier |

### `users` Table (Future Expansion)
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | TEXT (PK) | Unique user identifier |
| `phoneNumber` | TEXT | For SMS fallback and identity |
| `reputation` | REAL | Community trust score |
| `language` | TEXT | Preferred UI language |
