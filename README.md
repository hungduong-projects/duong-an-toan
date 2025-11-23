# Đường An Toàn (Safe Road) 🚗💧

> Real-time flood risk assessment and route safety analysis for Vietnam

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![React](https://img.shields.io/badge/React-19.2-blue.svg)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://www.typescriptlang.org/)

**Đường An Toàn** is a Vietnamese-language web application that provides intelligent flood risk assessment and route safety analysis during storms and heavy rainfall. Combining official NCHMF monitoring station data with AI-powered analysis, it helps travelers make informed decisions about their journeys.

[🇻🇳 Tiếng Việt](#vietnamese) | [🇬🇧 English](#english)

---

## ✨ Features

### 🗺️ Interactive Map Analysis
- **Point Analysis**: Click any location on the map to get flood risk assessment
- **Route Planning**: Analyze entire routes for safety with dangerous segment detection
- **Real-time Data**: Elevation, precipitation, and river discharge information
- **Monitoring Stations**: Live NCHMF weather stations displayed as color-coded markers (🔴 High risk, 🟡 Medium, 🟢 Low)

### 🚗 Vehicle-Specific Assessments
- **Multi-vehicle Support**: Car 🚗, Motorcycle 🏍️, or Pedestrian 🚶
- **Adaptive Risk Thresholds**: Different safety thresholds based on vehicle type
- **Customized Advice**: AI provides vehicle-specific safety recommendations

### 🤖 AI-Powered Safety Advice
- **Google Gemini Integration**: Advanced AI analysis using Gemini 2.5 Flash (primary)
- **Multi-Tier Fallback System**: Ensures continuous service with 4 layers of redundancy
- **Localized Context**: Vietnam-specific geographic knowledge (Mekong Delta, Red River Delta, etc.)
- **Expert Data Integration**: AI cross-references with nearby NCHMF monitoring stations (flash flood/landslide risk assessments from Vietnamese meteorologists)
- **Integrated Analysis**: AI considers dangerous segments and official expert assessments for consistent recommendations
- **Confidence Indicators**: Data quality transparency (High/Medium/Low confidence) - automatically boosted to HIGH when official NCHMF data is available
- **4-Layer Fallback Chain**: Primary Gemini → Backup Gemini → OpenAI GPT-5-Nano → Rule-based assessment for 99.9% uptime

### ⚡ Performance & Reliability
- **Smart Caching**: 7-day localStorage cache reduces API calls by ~70%
- **Retry Logic**: Automatic retry with exponential backoff for failed requests
- **6-Hour Forecast**: Current + next 6 hours precipitation data
- **Official Warnings**: Real-time alerts from Vietnam's NCHMF (National Center for Hydro-Meteorological Forecasting)

### 🌐 Multilingual Support
- **Vietnamese (Default)**: Full Vietnamese UI and AI responses
- **English**: Complete English translation
- **Persistent Preference**: Language choice saved in browser

### 🎯 Route Danger Detection
- **Segment Analysis**: Samples 8 points along your route
- **Visual Warnings**: Dangerous segments highlighted on map
- **Detailed Reports**: Distance and reason for each dangerous area

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- Google Gemini API key ([Get one free](https://aistudio.google.com/apikey))

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/hungduong-projects/duong-an-toan.git
   cd duong-an-toan
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   # Copy the example file and add your API key
   cp .env.example .env
   # Then edit .env and add your Gemini API key
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   ```
   http://localhost:3000
   ```

### Build for Production

```bash
npm run build
npm run preview
```

### Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/hungduong-projects/duong-an-toan)

1. **Click the "Deploy" button** above or visit [Vercel](https://vercel.com)
2. **Import your repository**
3. **Configure Environment Variables**:
   - `GEMINI_API_KEY` (required) - Your Google Gemini API key
   - `GEMINI_FALLBACK_KEY` (optional) - Secondary Gemini key
   - `OPENAI_API_KEY` (optional, not recommended) - OpenAI fallback (security risk)
4. **Deploy** - Vercel will automatically detect Vite and configure the build
5. **Secure your API key**:
   - Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
   - Add HTTP referrer restrictions: `*.vercel.app/*`, `yourdomain.com/*`
   - Set usage quotas to prevent abuse

**Note**: The app includes `vercel.json` for SPA routing configuration. All routes (`/about`, `/donate`) will work correctly.

---

## 🏗️ Architecture

### Tech Stack
- **Frontend**: React 19.2 + TypeScript 5.8
- **Routing**: React Router v7
- **Internationalization**: i18next + react-i18next
- **Maps**: Leaflet 1.9 + React-Leaflet 5.0
- **AI**: Google Generative AI (@google/genai)
- **Build Tool**: Vite 6.2
- **Styling**: Tailwind CSS (via CDN)

### Data Sources
- **Elevation**: [Open-Elevation API](https://open-elevation.com/) (with 7-day caching)
- **Weather**: [Open-Meteo Forecast API](https://open-meteo.com/) (current + 6h forecast)
- **Official Warnings & Monitoring Stations**: [NCHMF Vietnam](https://nchmf.gov.vn) (National Center for Hydro-Meteorological Forecasting)
  - Weather warnings scraped from main website
  - Real-time monitoring station data (rainfall, flash flood risk, landslide risk) from ~60-90 active stations
- **Routing**: [OSRM Demo Server](http://router.project-osrm.org/)
- **Geocoding**: [Nominatim (OpenStreetMap)](https://nominatim.openstreetmap.org/)

### Key Components

```
src/
├── components/
│   ├── Header.tsx              # Main navigation header
│   ├── Navigation.tsx          # Top-right nav (About, Donate, Language)
│   ├── LanguageToggle.tsx      # Language switcher with flags
│   ├── SearchBar.tsx           # Location search with autocomplete
│   ├── VehicleSelector.tsx     # Vehicle type selector
│   ├── InfoPanel.tsx           # Floating analysis results panel
│   └── MapContainerWrapper.tsx # Leaflet map integration
├── pages/
│   ├── MainPage.tsx            # Main map and analysis page
│   ├── AboutPage.tsx           # About page
│   └── DonatePage.tsx          # Donation/support page
├── services/
│   ├── geoService.ts           # Geographic data APIs
│   └── geminiService.ts        # AI analysis and safety advice
├── translations/
│   ├── vi.json                 # Vietnamese translations
│   └── en.json                 # English translations
└── types.ts                    # TypeScript type definitions
```

---

## 🎮 Usage

### Point Analysis Mode
1. Click anywhere on the map OR search for a location
2. View elevation, precipitation, and flood risk data
3. App automatically finds nearby NCHMF monitoring stations (up to 3 within 50km)
4. Get AI-powered safety advice that considers official expert assessments and your vehicle type

### Route Analysis Mode
1. Search for a destination (origin defaults to your location)
2. View the calculated route with travel time and distance
3. See dangerous segments highlighted on the map
4. App finds monitoring stations near start, end, and dangerous segments
5. Read AI analysis of overall route safety based on local expert data

### Vehicle Types
- **🚗 Car**: Water tolerance ~30cm
- **🏍️ Motorcycle**: Water tolerance ~15cm
- **🚶 Pedestrian**: Water tolerance ~15cm

### Language Switching
- Click the flag icon (🇻🇳/🇬🇧) in the top-right
- Choose your preferred language
- All UI text and placeholders update instantly
- Preference saved in browser localStorage

---

## 🔒 Environment Variables

Copy the `.env.example` file to create your own `.env`:

```bash
cp .env.example .env
```

Then edit `.env` and add your Google Gemini API key:

```env
GEMINI_API_KEY=your_actual_api_key_here
```

Get a free API key at: https://aistudio.google.com/apikey

**Important**: Never commit your `.env` file to version control. It's already in `.gitignore`.

---

## 🌍 Geographic Scope

This app is optimized for **Vietnam** 🇻🇳:
- Map bounds constrain to Vietnam region (6.0°N to 24.5°N)
- Location search filtered to Vietnamese locations
- AI prompts include Vietnam-specific geographic context
- Default center: Central Vietnam (15.9°N, 105.8°E)

---

## 🤝 Contributing

Contributions are welcome! Here's how you can help:

1. **Fork the repository**
2. **Create a feature branch** (`git checkout -b feature/amazing-feature`)
3. **Commit your changes** (`git commit -m 'Add amazing feature'`)
4. **Push to the branch** (`git push origin feature/amazing-feature`)
5. **Open a Pull Request**

### Development Guidelines
- Follow existing code style and TypeScript conventions
- Test your changes thoroughly
- Update translations if adding new UI text
- Keep commits focused and descriptive

---

## 📝 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **NCHMF (Vietnam National Center for Hydro-Meteorological Forecasting)** for official weather warnings and real-time monitoring station data
- **Open-Elevation** for elevation data
- **Open-Meteo** for weather and flood forecasting
- **OSRM** for routing services
- **OpenStreetMap** for geocoding and map data
- **Google Gemini** for primary AI-powered analysis
- **OpenAI** for backup AI fallback system
- **Leaflet** for map rendering

---

## 📧 Contact & Support

- **Issues**: [GitHub Issues](https://github.com/hungduong-projects/duong-an-toan/issues)
- **Discussions**: [GitHub Discussions](https://github.com/hungduong-projects/duong-an-toan/discussions)

---

## ⚠️ Disclaimer

This application provides **informational assistance only** and should not be the sole basis for safety decisions during severe weather. Always follow official government warnings and emergency services guidance.

The flood risk assessments are based on available data and AI predictions, which may not reflect real-time conditions or all local factors. Use at your own discretion.

---

<div align="center">

Made with ❤️ for safer travel in Vietnam

[⭐ Star this repo](https://github.com/hungduong-projects/duong-an-toan) if you find it helpful!

</div>
