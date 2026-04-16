export type Preset = { name: string; lat: number; lng: number; icon?: string };

export const CHENNAI_PRESETS: Preset[] = [
  // --- Major Transport Hubs ---
  { name: "Chennai Central", lat: 13.0827, lng: 80.2707, icon: "\u{1F689}" },
  { name: "Chennai Egmore", lat: 13.0732, lng: 80.2609, icon: "\u{1F689}" },
  { name: "Tambaram Railway", lat: 12.9249, lng: 80.1000, icon: "\u{1F689}" },
  { name: "Koyambedu Bus Stand", lat: 13.0697, lng: 80.1959, icon: "\u{1F68C}" },
  { name: "Chennai Airport", lat: 12.9941, lng: 80.1709, icon: "\u{2708}\uFE0F" },
  { name: "Guindy Metro", lat: 13.0067, lng: 80.2206, icon: "\u{1F687}" },

  // --- IT Corridors ---
  { name: "OMR - Thoraipakkam", lat: 12.9395, lng: 80.2398, icon: "\u{1F4BB}" },
  { name: "OMR - Sholinganallur", lat: 12.9010, lng: 80.2279, icon: "\u{1F4BB}" },
  { name: "Tidel Park", lat: 12.9480, lng: 80.2370, icon: "\u{1F3E2}" },
  { name: "SIPCOT IT Park", lat: 12.8390, lng: 80.2250, icon: "\u{1F3E2}" },

  // --- Commercial / Shopping ---
  { name: "T Nagar", lat: 13.0418, lng: 80.2341, icon: "\u{1F6CD}\uFE0F" },
  { name: "Anna Nagar", lat: 13.0850, lng: 80.2101, icon: "\u{1F3D8}\uFE0F" },
  { name: "Mylapore", lat: 13.0368, lng: 80.2676, icon: "\u{1F6D5}" },
  { name: "Spencer Plaza", lat: 13.0598, lng: 80.2595, icon: "\u{1F6CD}\uFE0F" },
  { name: "Express Avenue", lat: 13.0580, lng: 80.2620, icon: "\u{1F6CD}\uFE0F" },
  { name: "Phoenix Mall (Velachery)", lat: 12.9877, lng: 80.2275, icon: "\u{1F6CD}\uFE0F" },

  // --- Residential / Suburbs ---
  { name: "Adyar", lat: 13.0067, lng: 80.2569, icon: "\u{1F3E0}" },
  { name: "Velachery", lat: 12.9815, lng: 80.2180, icon: "\u{1F3E0}" },
  { name: "Porur", lat: 13.0381, lng: 80.1565, icon: "\u{1F3E0}" },
  { name: "Pallavaram", lat: 12.9675, lng: 80.1491, icon: "\u{1F3E0}" },
  { name: "Chromepet", lat: 12.9516, lng: 80.1462, icon: "\u{1F3E0}" },
  { name: "Ambattur", lat: 13.1143, lng: 80.1548, icon: "\u{1F3E0}" },
  { name: "Perambur", lat: 13.1120, lng: 80.2350, icon: "\u{1F3E0}" },
  { name: "Nungambakkam", lat: 13.0600, lng: 80.2420, icon: "\u{1F3E0}" },
  { name: "Besant Nagar", lat: 13.0002, lng: 80.2710, icon: "\u{1F3D6}\uFE0F" },
  { name: "Thiruvanmiyur", lat: 12.9830, lng: 80.2640, icon: "\u{1F3E0}" },
  { name: "Medavakkam", lat: 12.9200, lng: 80.1920, icon: "\u{1F3E0}" },

  // --- Landmarks ---
  { name: "Marina Beach", lat: 13.0500, lng: 80.2824, icon: "\u{1F3D6}\uFE0F" },
  { name: "IIT Madras", lat: 12.9916, lng: 80.2336, icon: "\u{1F393}" },
  { name: "Anna University", lat: 13.0108, lng: 80.2354, icon: "\u{1F393}" },
  { name: "Saidapet", lat: 13.0220, lng: 80.2210, icon: "\u{1F309}" },
  { name: "Vadapalani", lat: 13.0500, lng: 80.2120, icon: "\u{1F6D5}" },
  { name: "Maduravoyal", lat: 13.0668, lng: 80.1727, icon: "\u{1F6E3}\uFE0F" },

  // --- Hospitals ---
  { name: "Apollo Hospital", lat: 13.0604, lng: 80.2550, icon: "\u{1F3E5}" },
  { name: "MIOT Hospital", lat: 13.0120, lng: 80.1726, icon: "\u{1F3E5}" },
];

// Pre-built demo routes that showcase specific features
export const DEMO_ROUTES = [
  {
    name: "Central \u2192 Airport (Night Rain)",
    from: 0, to: 4, weather: "rain" as const, hour: 22,
    highlight: "Danger Mode + Emergency SOS demo",
  },
  {
    name: "OMR \u2192 T Nagar (Evening Rush)",
    from: 6, to: 10, weather: "clear" as const, hour: 18,
    highlight: "Traffic congestion + turn-by-turn",
  },
  {
    name: "Anna Nagar \u2192 Tambaram (Rainy Morning)",
    from: 11, to: 2, weather: "heavy_rain" as const, hour: 8,
    highlight: "Risk Window + waterlogging alerts",
  },
  {
    name: "Velachery \u2192 Koyambedu (Fog)",
    from: 17, to: 3, weather: "fog" as const, hour: 6,
    highlight: "Predictive hazard alerts + safe zones",
  },
  {
    name: "Marina Beach \u2192 IIT Madras (Safe Trip)",
    from: 27, to: 28, weather: "clear" as const, hour: 10,
    highlight: "Low risk route through safe zones",
  },
];
