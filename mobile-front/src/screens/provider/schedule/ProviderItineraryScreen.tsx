import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { WebView } from "react-native-webview";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";
import type { ProviderStackParamList } from "../../../navigation/types";

type Props = NativeStackScreenProps<ProviderStackParamList, "ProviderItinerary">;

const C = {
  accent: "#2563eb",
  bg: "#f9fafb",
  white: "#ffffff",
  text: "#111827",
  textSub: "#6b7280",
  border: "#e5e7eb",
  success: "#059669",
};

function buildItineraryMapHtml(
  provLat: number,
  provLng: number,
  cliLat: number,
  cliLng: number,
): string {
  return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossorigin=""/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" crossorigin=""></script>
<style>
html,body,#map{margin:0;padding:0;height:100%;width:100%;background:#e8ecf4;}
.provider-icon,.client-icon{
  display:flex;align-items:center;justify-content:center;
  width:36px;height:36px;border-radius:50%;color:#fff;font-size:16px;font-weight:bold;
  box-shadow:0 3px 6px rgba(0,0,0,0.25);
}
.provider-icon{background:#059669;}
.client-icon{background:#2563eb;}
</style>
</head><body>
<div id="map"></div>
<script>
var map=L.map('map',{zoomControl:true}).setView([${(provLat + cliLat) / 2},${(provLng + cliLng) / 2}],13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
maxZoom:19,attribution:'&copy; OpenStreetMap'}).addTo(map);

var provIcon=L.divIcon({className:'',html:'<div class="provider-icon">&#x1F697;</div>',iconSize:[36,36],iconAnchor:[18,18]});
var cliIcon=L.divIcon({className:'',html:'<div class="client-icon">&#x1F464;</div>',iconSize:[36,36],iconAnchor:[18,18]});

L.marker([${provLat},${provLng}],{icon:provIcon}).addTo(map).bindPopup('You');
L.marker([${cliLat},${cliLng}],{icon:cliIcon}).addTo(map).bindPopup('Client');

L.polyline([[${provLat},${provLng}],[${cliLat},${cliLng}]],{
color:'#2563eb',weight:4,dashArray:'8,6',opacity:0.8}).addTo(map);

map.fitBounds([[${provLat},${provLng}],[${cliLat},${cliLng}]],{padding:[50,50]});
</script></body></html>`;
}

export const ProviderItineraryScreen: React.FC<Props> = ({
  route,
  navigation,
}) => {
  const { clientLat, clientLng, clientName } = route.params;

  const [providerLat, setProviderLat] = useState<number | null>(null);
  const [providerLng, setProviderLng] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          Alert.alert("Location needed", "Please allow location access to see the route.");
          setLoading(false);
          return;
        }
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        setProviderLat(pos.coords.latitude);
        setProviderLng(pos.coords.longitude);
        setLoading(false);
      } catch {
        setLoading(false);
      }
    })();
  }, []);

  const openExternalNav = useCallback(() => {
    const url = Platform.select({
      ios: `maps:0,0?saddr=My+Location&daddr=${clientLat},${clientLng}`,
      android: `google.navigation:q=${clientLat},${clientLng}`,
    });
    if (url) {
      Linking.openURL(url).catch(() =>
        Linking.openURL(
          `https://www.google.com/maps/dir/?api=1&destination=${clientLat},${clientLng}`,
        ),
      );
    }
  }, [clientLat, clientLng]);

  if (loading) {
    return (
      <SafeAreaView style={st.safe} edges={["top"]}>
        <View style={st.loadingWrap}>
          <ActivityIndicator size="large" color={C.accent} />
          <Text style={st.loadingText}>Loading route…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={st.safe} edges={["top", "bottom"]}>
      <View style={st.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={st.backBtn}
        >
          <Ionicons name="arrow-back" size={20} color={C.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={st.headerTitle}>Route to client</Text>
          <Text style={st.headerSub} numberOfLines={1}>
            {clientName}
          </Text>
        </View>
      </View>

      <View style={{ flex: 1 }}>
        <WebView
          style={{ flex: 1 }}
          originWhitelist={["*"]}
          source={{
            html: buildItineraryMapHtml(
              providerLat ?? clientLat,
              providerLng ?? clientLng,
              clientLat,
              clientLng,
            ),
            baseUrl: "https://localhost",
          }}
          javaScriptEnabled
          domStorageEnabled
          mixedContentMode="always"
          setSupportMultipleWindows={false}
        />
      </View>

      <View style={st.bottomBar}>
        <View style={st.clientCard}>
          <View style={st.clientAvatar}>
            <Ionicons name="person" size={18} color={C.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={st.clientCardName}>{clientName}</Text>
            <Text style={st.clientCardSub}>Client location</Text>
          </View>
        </View>
        <TouchableOpacity
          style={st.navButton}
          activeOpacity={0.85}
          onPress={openExternalNav}
        >
          <Ionicons name="navigate" size={18} color={C.white} />
          <Text style={st.navButtonText}>Open in Maps</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.white },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: { fontSize: 14, color: C.textSub },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    gap: 12,
    backgroundColor: C.white,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: C.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 16, fontWeight: "700", color: C.text },
  headerSub: { fontSize: 13, color: C.textSub, marginTop: 2 },

  bottomBar: {
    backgroundColor: C.white,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: C.border,
    gap: 14,
  },
  clientCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: C.bg,
    borderRadius: 14,
    padding: 14,
  },
  clientAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#eff6ff",
    alignItems: "center",
    justifyContent: "center",
  },
  clientCardName: { fontSize: 14, fontWeight: "700", color: C.text },
  clientCardSub: { fontSize: 12, color: C.textSub, marginTop: 2 },
  navButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F97316",
    borderRadius: 16,
    paddingVertical: 14,
    gap: 8,
    shadowColor: "#F97316",
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  navButtonText: {
    color: C.white,
    fontWeight: "700",
    fontSize: 15,
  },
});
