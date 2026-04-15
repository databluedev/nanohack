"""Hand-curated Chennai accident black spots based on public news reports / Chennai Traffic Police bulletins.
Each spot has a base risk weight, location, and the conditions under which it spikes."""

CHENNAI_BLACKSPOTS = [
    {
        "name": "Kathipara Junction (Cloverleaf)",
        "lat": 12.9756, "lng": 80.1873,
        "base": 95,
        "spikes": {"evening": 1.6, "rain": 1.8, "night": 1.4},
        "voice": "Approaching Kathipara cloverleaf. High accident zone — multiple merging lanes ahead. Slow down."
    },
    {
        "name": "Maduravoyal Junction",
        "lat": 13.0668, "lng": 80.1727,
        "base": 88,
        "spikes": {"morning": 1.4, "evening": 1.5, "rain": 1.7},
        "voice": "Maduravoyal junction ahead. Heavy turning traffic, frequent collisions. Reduce speed."
    },
    {
        "name": "Koyambedu Roundabout",
        "lat": 13.0697, "lng": 80.1959,
        "base": 82,
        "spikes": {"evening": 1.5, "weekend": 1.3},
        "voice": "Koyambedu roundabout. Watch for buses cutting across lanes."
    },
    {
        "name": "Tambaram",
        "lat": 12.9249, "lng": 80.1000,
        "base": 78,
        "spikes": {"morning": 1.4, "evening": 1.5, "rain": 1.6},
        "voice": "Tambaram stretch ahead. Two-wheeler accidents common in this area."
    },
    {
        "name": "Pallavaram",
        "lat": 12.9675, "lng": 80.1491,
        "base": 75,
        "spikes": {"evening": 1.5, "night": 1.5, "rain": 1.6},
        "voice": "Pallavaram ahead. Poor lighting after dark — extra caution advised."
    },
    {
        "name": "T Nagar (Pondy Bazaar)",
        "lat": 13.0418, "lng": 80.2341,
        "base": 72,
        "spikes": {"evening": 1.7, "weekend": 1.5},
        "voice": "T Nagar shopping zone. Pedestrian crossings ahead — slow stretch."
    },
    {
        "name": "Velachery",
        "lat": 12.9815, "lng": 80.2180,
        "base": 70,
        "spikes": {"evening": 1.5, "rain": 1.8},
        "voice": "Velachery junction. Known waterlogging spot — low visibility in rain."
    },
    {
        "name": "OMR - Thoraipakkam",
        "lat": 12.9395, "lng": 80.2398,
        "base": 80,
        "spikes": {"morning": 1.6, "evening": 1.7, "night": 1.4},
        "voice": "OMR ahead. IT corridor — high two-wheeler density during peak hours."
    },
    {
        "name": "GST Road - Chromepet",
        "lat": 12.9516, "lng": 80.1462,
        "base": 76,
        "spikes": {"evening": 1.5, "rain": 1.6, "night": 1.4},
        "voice": "GST Road stretch. Heavy truck traffic — maintain safe distance."
    },
    {
        "name": "Anna Salai (Mount Road)",
        "lat": 13.0604, "lng": 80.2496,
        "base": 68,
        "spikes": {"evening": 1.5, "weekend": 1.3},
        "voice": "Anna Salai. Frequent lane changes near signals — drive defensively."
    },
    {
        "name": "Adyar Signal",
        "lat": 13.0067, "lng": 80.2569,
        "base": 65,
        "spikes": {"evening": 1.4, "rain": 1.5},
        "voice": "Adyar signal. Pedestrian-heavy junction."
    },
    {
        "name": "Saidapet Bridge",
        "lat": 13.0220, "lng": 80.2210,
        "base": 70,
        "spikes": {"morning": 1.4, "evening": 1.5, "rain": 1.7},
        "voice": "Saidapet bridge. Narrow lanes — avoid overtaking."
    },
    {
        "name": "Vadapalani Signal",
        "lat": 13.0500, "lng": 80.2120,
        "base": 67,
        "spikes": {"evening": 1.5, "weekend": 1.3},
        "voice": "Vadapalani signal ahead. High two-wheeler accident zone."
    },
    {
        "name": "Guindy",
        "lat": 13.0067, "lng": 80.2206,
        "base": 73,
        "spikes": {"morning": 1.5, "evening": 1.6},
        "voice": "Guindy industrial estate. Watch for sudden lane cuts by trucks."
    },
    {
        "name": "Porur Junction",
        "lat": 13.0381, "lng": 80.1565,
        "base": 78,
        "spikes": {"morning": 1.5, "evening": 1.6, "rain": 1.6},
        "voice": "Porur junction. Multi-direction merge — slow approach essential."
    },
]
