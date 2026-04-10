# NaijaGuard AI Threat Analysis Model Design

## 1. Multimodal NLP & Computer Vision Pipeline
The system uses a unified multimodal architecture to process text, images, and video simultaneously.

### A. Text Processing (NLP)
1.  **Multilingual Tokenization:** Uses a custom tokenizer trained on Nigerian English, Pidgin, and major local languages (Hausa, Yoruba, Igbo).
2.  **Named Entity Recognition (NER):** Specialized model to extract:
    *   **LOC (Location):** States, LGAs, specific neighborhoods (e.g., "Mando", "Oshodi").
    *   **ORG (Organization):** Security agencies (Police, Amotekun, Vigilantes).
    *   **TIME:** Temporal markers (e.g., "just now", "since 4pm").
3.  **Sentiment & Intent Analysis:** Detects "Panic" vs "Reporting" vs "Malicious Exaggeration".

### B. Visual Analysis (CV)
1.  **Scene Classification:** Identifies roadblocks, burning tires, weapons, or large crowds.
2.  **OCR:** Extracts text from signs, license plates, or banners in images/videos.
3.  **Action Recognition (Video):** Detects aggressive movements, fleeing crowds, or stationary blockades.

---

## 2. Training Data Strategy
### A. Local Datasets
*   **Social Media Scrapping:** Curated datasets from Twitter (X) and Facebook using Nigerian security-related hashtags (#SecureNorth, #EndSARS archives).
*   **News Archives:** Historical data from Nigerian news outlets (Punch, Vanguard, Daily Trust).
*   **Synthetic Data:** Generating Pidgin and local language variations of threat reports using LLMs to balance under-represented classes.

### B. Multilingual Handling
*   **Cross-Lingual Embeddings:** Using models like XLM-RoBERTa to map Hausa, Yoruba, and Igbo into a shared vector space with English.
*   **Pidgin Normalization:** A preprocessing layer to map common Pidgin terms (e.g., "dem don block road" -> "illegal roadblock") to standard classification tokens.

---

## 3. Model Recommendations
| Feature | Lightweight (Edge/Mobile) | High-Performance (Cloud/Server) |
| :--- | :--- | :--- |
| **Model** | DistilBERT / MobileNetV3 | **Gemini 3 Flash** / ViT-L |
| **Latency** | < 50ms | 500ms - 2s |
| **Use Case** | Initial on-device filtering | Deep verification & classification |
| **Accuracy** | 75-80% | 95%+ |

---

## 4. Real-Time Processing Flow
1.  **Ingestion:** User uploads post (Text + Media).
2.  **Preprocessing:** Media compression and text normalization.
3.  **Parallel Inference:**
    *   **Stream A:** Rapid classification for immediate local alert.
    *   **Stream B:** Deep analysis for credibility and misinformation detection.
4.  **Action:** If Urgency = "Critical" AND Credibility > 0.7, trigger **Immediate Push Notification** to users within 5km.

---

## 5. Example Prediction
**Input:** 
*   *Text:* "Omo, avoid Lagos-Ibadan expressway now. Some boys with guns are stopping cars near Long Bridge. Stay safe o!"
*   *Image:* (Photo of stationary cars and distant smoke)

**Output:**
```json
{
  "threat_type": "Armed Robbery / Illegal Roadblock",
  "urgency": "Critical",
  "entities": {
    "state": "Lagos/Ogun Border",
    "landmark": "Long Bridge",
    "route": "Lagos-Ibadan Expressway"
  },
  "credibility_score": 0.88,
  "analysis": {
    "misinformation_risk": "Low",
    "panic_level": "Moderate",
    "linguistic_pattern": "Authentic Nigerian Pidgin/English mix"
  },
  "action": "BROADCAST_PROXIMITY_ALERT"
}
```
