import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
  type ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const CAROUSEL_GAP = 12;

export type PhotoCarouselProps = {
  photos: string[];
  accessibilityLabelPrefix: string;
  groupLabel?: string;
  style?: ViewStyle;
  /** Total horizontal padding subtracted from window width (both sides). */
  horizontalInset?: number;
  activeDotColor?: string;
};

export function PhotoCarousel({
  photos,
  accessibilityLabelPrefix,
  groupLabel,
  style,
  horizontalInset = 72,
  activeDotColor = "#7C5CFC",
}: PhotoCarouselProps) {
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const lightboxRef = useRef<FlatList<string>>(null);

  const carouselLayout = useMemo(() => {
    const slideW = Math.max(200, windowWidth - horizontalInset);
    const slideH = Math.round(slideW * 0.56);
    const snapInterval = slideW + CAROUSEL_GAP;
    return { slideW, slideH, snapInterval };
  }, [windowWidth, horizontalInset]);

  useEffect(() => {
    setCarouselIndex(0);
  }, [photos]);

  useEffect(() => {
    if (!lightboxOpen || photos.length === 0) return;
    const idx = Math.min(Math.max(0, lightboxIndex), photos.length - 1);
    const id = setTimeout(() => {
      try {
        lightboxRef.current?.scrollToIndex({ index: idx, animated: false });
      } catch {
        /* layout not ready */
      }
    }, 32);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- index read from opening render only
  }, [lightboxOpen, photos.length]);

  if (photos.length === 0) return null;

  return (
    <View style={style}>
      {groupLabel ? (
        <Text style={styles.groupLabel}>{groupLabel}</Text>
      ) : null}
      <FlatList
        data={photos}
        keyExtractor={(uri, index) => `${uri}-${index}`}
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={carouselLayout.snapInterval}
        snapToAlignment="start"
        disableIntervalMomentum
        ItemSeparatorComponent={() => (
          <View style={{ width: CAROUSEL_GAP }} />
        )}
        renderItem={({ item: uri, index }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${accessibilityLabelPrefix} ${index + 1} of ${photos.length}. Opens full screen.`}
            onPress={() => {
              setLightboxIndex(index);
              setLightboxOpen(true);
            }}
            style={[
              styles.slide,
              {
                width: carouselLayout.slideW,
                height: carouselLayout.slideH,
              },
            ]}
          >
            <Image
              source={{ uri }}
              style={styles.slideImage}
              resizeMode="cover"
            />
          </Pressable>
        )}
        onMomentumScrollEnd={(e) => {
          const snap = carouselLayout.snapInterval;
          const idx = Math.round(e.nativeEvent.contentOffset.x / snap);
          setCarouselIndex(Math.min(photos.length - 1, Math.max(0, idx)));
        }}
      />
      {photos.length > 1 ? (
        <View style={styles.dotsRow}>
          {photos.map((uri, i) => (
            <View
              key={`${uri}-dot-${i}`}
              style={[
                styles.dot,
                i === carouselIndex && [
                  styles.dotActive,
                  { backgroundColor: activeDotColor },
                ],
              ]}
            />
          ))}
        </View>
      ) : null}

      <Modal
        visible={lightboxOpen}
        animationType="fade"
        presentationStyle="fullScreen"
        onRequestClose={() => setLightboxOpen(false)}
      >
        <View style={styles.lightboxRoot}>
          <StatusBar barStyle="light-content" />
          <FlatList
            ref={lightboxRef}
            style={styles.lightboxList}
            data={photos}
            keyExtractor={(uri, index) => `lb-${uri}-${index}`}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            initialNumToRender={3}
            onScrollToIndexFailed={({ index }) => {
              setTimeout(() => {
                try {
                  lightboxRef.current?.scrollToIndex({
                    index,
                    animated: false,
                  });
                } catch {
                  /* noop */
                }
              }, 120);
            }}
            getItemLayout={(_, index) => ({
              length: windowWidth,
              offset: windowWidth * index,
              index,
            })}
            onMomentumScrollEnd={(e) => {
              const idx = Math.round(
                e.nativeEvent.contentOffset.x / windowWidth,
              );
              setLightboxIndex(
                Math.min(photos.length - 1, Math.max(0, idx)),
              );
            }}
            renderItem={({ item: uri }) => (
              <View
                style={[
                  styles.lightboxPage,
                  { width: windowWidth, height: windowHeight },
                ]}
              >
                <Image
                  source={{ uri }}
                  style={{
                    width: windowWidth,
                    height: Math.max(280, Math.floor(windowHeight * 0.82)),
                  }}
                  resizeMode="contain"
                />
              </View>
            )}
          />
          <TouchableOpacity
            style={[styles.lightboxCloseBtn, { top: insets.top + 10 }]}
            onPress={() => setLightboxOpen(false)}
            activeOpacity={0.85}
            accessibilityLabel="Close photo"
          >
            <Ionicons name="close" size={26} color="#FFFFFF" />
          </TouchableOpacity>
          {photos.length > 1 ? (
            <View
              pointerEvents="none"
              style={[
                styles.lightboxCounter,
                { bottom: insets.bottom + 20 },
              ]}
            >
              <Text style={styles.lightboxCounterText}>
                {lightboxIndex + 1} / {photos.length}
              </Text>
            </View>
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  groupLabel: {
    fontSize: 14,
    fontWeight: "800",
    color: "#374151",
    marginBottom: 12,
  },
  slide: {
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    ...Platform.select({
      ios: {
        shadowColor: "#0F172A",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: { elevation: 3 },
    }),
  },
  slideImage: {
    width: "100%",
    height: "100%",
  },
  dotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    marginTop: 12,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#E2E8F0",
  },
  dotActive: {
    width: 18,
    borderRadius: 4,
  },
  lightboxRoot: {
    flex: 1,
    backgroundColor: "#0A0A0F",
  },
  lightboxList: {
    flex: 1,
    width: "100%",
    backgroundColor: "#0A0A0F",
  },
  lightboxPage: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0A0A0F",
  },
  lightboxCloseBtn: {
    position: "absolute",
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    zIndex: 2,
  },
  lightboxCounter: {
    position: "absolute",
    alignSelf: "center",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  lightboxCounterText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 0.4,
  },
});
