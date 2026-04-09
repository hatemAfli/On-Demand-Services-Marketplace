import React, { useRef, useEffect, useCallback } from "react";
import { StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";

type Props = {
  latitude: string;
  longitude: string;
  onCoordinateChange: (lat: number, lng: number) => void;
};

const DEFAULT_LAT = 36.8065;
const DEFAULT_LNG = 10.1815;

/** Inline Leaflet + OpenStreetMap — works in Expo Go on Android without a Google Maps API key. */
const OSM_HTML = `<!DOCTYPE html>
<html><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossorigin="" />
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" crossorigin=""></script>
<style>html,body,#map{margin:0;padding:0;height:100%;width:100%;touch-action:manipulation;background:#e8e4dc;}</style>
</head><body>
<div id="map"></div>
<script>
(function(){
  var ilat = ${DEFAULT_LAT}, ilng = ${DEFAULT_LNG};
  var map = L.map('map', { zoomControl: true }).setView([ilat, ilng], 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(map);
  var marker = L.marker([ilat, ilng], { draggable: true }).addTo(map);
  function send(lat, lng) {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ lat: lat, lng: lng }));
    }
  }
  map.on('click', function(e) {
    marker.setLatLng(e.latlng);
    send(e.latlng.lat, e.latlng.lng);
  });
  marker.on('dragend', function(e) {
    var p = e.target.getLatLng();
    send(p.lat, p.lng);
  });
  window.__setPin = function(lat, lng) {
    marker.setLatLng([lat, lng]);
    map.setView([lat, lng], Math.max(map.getZoom(), 14));
  };
})();
</script>
</body></html>`;

export function OsmLocationPicker({
  latitude,
  longitude,
  onCoordinateChange,
}: Props) {
  const webRef = useRef<WebView>(null);

  const injectPin = useCallback(
    (lat: number, lng: number) => {
      const js = `(function(){ if (window.__setPin) { window.__setPin(${lat}, ${lng}); } })(); true;`;
      webRef.current?.injectJavaScript(js);
    },
    [],
  );

  useEffect(() => {
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    if (
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      Math.abs(lat) <= 90 &&
      Math.abs(lng) <= 180
    ) {
      injectPin(lat, lng);
    }
  }, [latitude, longitude, injectPin]);

  const onMessage = (event: { nativeEvent: { data: string } }) => {
    try {
      const d = JSON.parse(event.nativeEvent.data) as {
        lat?: number;
        lng?: number;
      };
      if (typeof d.lat === "number" && typeof d.lng === "number") {
        onCoordinateChange(d.lat, d.lng);
      }
    } catch {
      /* ignore */
    }
  };

  return (
    <View style={styles.wrap}>
      <WebView
        ref={webRef}
        style={styles.web}
        originWhitelist={["*"]}
        source={{ html: OSM_HTML, baseUrl: "https://localhost" }}
        onMessage={onMessage}
        onLoadEnd={() => {
          const lat = parseFloat(latitude);
          const lng = parseFloat(longitude);
          if (
            Number.isFinite(lat) &&
            Number.isFinite(lng) &&
            Math.abs(lat) <= 90 &&
            Math.abs(lng) <= 180
          ) {
            injectPin(lat, lng);
          }
        }}
        javaScriptEnabled
        domStorageEnabled
        mixedContentMode="always"
        setSupportMultipleWindows={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    minHeight: 260,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#e8e4dc",
  },
  web: {
    flex: 1,
    backgroundColor: "transparent",
  },
});
