/**
 * Dynamic Expo config: merges app.json with env-based plugins.
 * Loads EXPO_PUBLIC_* from .env (Expo loads it when starting).
 *
 * Android: `react-native-maps` needs a Google Maps API key in native code.
 * Expo Go cannot use your key — use OSM WebView fallback in the app, or a dev build.
 */
const appJson = require("./app.json");

const mapsKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || "";

module.exports = {
  expo: {
    ...appJson.expo,
    plugins: [
      ...(appJson.expo.plugins || []),
      [
        "react-native-maps",
        {
          androidGoogleMapsApiKey: mapsKey,
          iosGoogleMapsApiKey: mapsKey,
        },
      ],
    ],
  },
};
