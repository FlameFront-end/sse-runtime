import { memo, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  PanResponder,
  StyleSheet,
  View,
  useWindowDimensions
} from "react-native";

import type { ReactNativeDevtoolsSnapshot } from "../registry/types";
import type { ReactNativeSSEDevtoolsExportPayload } from "./sse-devtools-provider";
import { PALETTES, type DevtoolsTheme } from "../theme/tokens";
import { ConnectionList } from "./connection-list";
import { DetailPane } from "./detail-pane";
import { EmptyState } from "./empty-state";
import { PanelHeader } from "./panel-header";
import { ToggleButton } from "./toggle-button";

const MIN_PANEL_HEIGHT = 300;
const MAX_PANEL_TOP_INSET = 56;
const PANEL_ANIMATION_MS = 180;
const CLOSE_DRAG_DISTANCE = 72;
const CLOSE_DRAG_VELOCITY = 1.1;

export type ReactNativeSSEDevtoolsPanelProps = {
  readonly clients: ReactNativeDevtoolsSnapshot;
  readonly clearEvents: (id: string) => void;
  readonly hideToggleButton: boolean;
  readonly isOpen: boolean;
  readonly onToggle: () => void;
  readonly onToggleTheme: () => void;
  readonly onCopyPayload?: (payload: string) => void | Promise<void>;
  readonly onExportEvents?: (payload: ReactNativeSSEDevtoolsExportPayload) => void | Promise<void>;
  readonly panelHeight: number;
  readonly theme: DevtoolsTheme;
  readonly toggleButtonPosition: "bottom-left" | "bottom-right" | "top-left" | "top-right";
};

export const ReactNativeSSEDevtoolsPanel = memo(function ReactNativeSSEDevtoolsPanel({
  clients,
  clearEvents,
  hideToggleButton,
  isOpen,
  onCopyPayload,
  onExportEvents,
  onToggle,
  onToggleTheme,
  panelHeight,
  theme,
  toggleButtonPosition
}: ReactNativeSSEDevtoolsPanelProps) {
  const palette = PALETTES[theme];
  const { height: windowHeight } = useWindowDimensions();
  const maxPanelHeight = Math.max(MIN_PANEL_HEIGHT, windowHeight - MAX_PANEL_TOP_INSET);
  const records = useMemo(() => Array.from(clients.values()), [clients]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isDetailVisible, setIsDetailVisible] = useState(false);
  const [isPanelMounted, setIsPanelMounted] = useState(isOpen);
  const [height, setHeight] = useState(() =>
    clampPanelHeight(panelHeight, MIN_PANEL_HEIGHT, maxPanelHeight)
  );
  const animationProgress = useRef(new Animated.Value(isOpen ? 1 : 0)).current;
  const dragTranslateY = useRef(new Animated.Value(0)).current;
  const dragStartHeight = useRef(height);

  useEffect(() => {
    setHeight((current) => clampPanelHeight(current, MIN_PANEL_HEIGHT, maxPanelHeight));
  }, [maxPanelHeight]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_event, gesture) => Math.abs(gesture.dy) > 4,
        onPanResponderGrant: () => {
          dragStartHeight.current = height;
          dragTranslateY.setValue(0);
        },
        onPanResponderMove: (_event, gesture) => {
          const nextHeight = clampPanelHeight(
            dragStartHeight.current - gesture.dy,
            MIN_PANEL_HEIGHT,
            maxPanelHeight
          );

          if (gesture.dy <= 0 || nextHeight > MIN_PANEL_HEIGHT) {
            dragTranslateY.setValue(0);
            setHeight(nextHeight);
            return;
          }

          setHeight(MIN_PANEL_HEIGHT);
          dragTranslateY.setValue(gesture.dy - (dragStartHeight.current - MIN_PANEL_HEIGHT));
        },
        onPanResponderRelease: (_event, gesture) => {
          if (gesture.dy > CLOSE_DRAG_DISTANCE || gesture.vy > CLOSE_DRAG_VELOCITY) {
            onToggle();
            return;
          }

          Animated.timing(dragTranslateY, {
            duration: PANEL_ANIMATION_MS,
            easing: Easing.out(Easing.cubic),
            toValue: 0,
            useNativeDriver: true
          }).start();
        }
      }),
    [dragTranslateY, height, maxPanelHeight, onToggle]
  );

  useEffect(() => {
    if (isOpen) {
      setIsPanelMounted(true);
      dragTranslateY.setValue(0);
      Animated.timing(animationProgress, {
        duration: PANEL_ANIMATION_MS,
        easing: Easing.out(Easing.cubic),
        toValue: 1,
        useNativeDriver: true
      }).start();
      return;
    }

    Animated.timing(animationProgress, {
      duration: PANEL_ANIMATION_MS,
      easing: Easing.in(Easing.cubic),
      toValue: 0,
      useNativeDriver: true
    }).start(({ finished }) => {
      if (finished) {
        dragTranslateY.setValue(0);
        setIsPanelMounted(false);
      }
    });
  }, [animationProgress, dragTranslateY, isOpen]);

  useEffect(() => {
    if (records.length === 0) {
      setSelectedId(null);
      setIsDetailVisible(false);
      return;
    }

    if (!selectedId || !clients.has(selectedId)) {
      setSelectedId(records[0].id);
      setIsDetailVisible(records.length === 1);
    }
  }, [clients, records, selectedId]);

  const selectedRecord = selectedId ? (clients.get(selectedId) ?? null) : null;
  const showConnections = !isDetailVisible || !selectedRecord;

  if (!isOpen && !isPanelMounted && !hideToggleButton) {
    return (
      <ToggleButton
        connectionCount={records.length}
        hasError={records.some((record) => record.status === "error")}
        palette={palette}
        position={toggleButtonPosition}
        onPress={onToggle}
      />
    );
  }

  if (!isOpen && !isPanelMounted) {
    return null;
  }

  const panelTranslateY = animationProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [height + 24, 0]
  });
  const panelCombinedTranslateY = Animated.add(panelTranslateY, dragTranslateY);

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <Animated.View
        pointerEvents="none"
        style={[
          styles.overlayShade,
          {
            backgroundColor: palette.overlay,
            opacity: animationProgress
          }
        ]}
      />
      <Animated.View
        style={[
          styles.panel,
          {
            backgroundColor: palette.background,
            borderColor: palette.border,
            height,
            transform: [{ translateY: panelCombinedTranslateY }]
          }
        ]}
      >
        <View style={styles.dragHandleArea} {...panResponder.panHandlers}>
          <View style={[styles.dragHandle, { backgroundColor: palette.border }]} />
        </View>

        <PanelHeader
          connectionCount={records.length}
          isDetailVisible={!showConnections}
          palette={palette}
          status={selectedRecord && !showConnections ? selectedRecord.status : undefined}
          subtitle={selectedRecord && !showConnections ? selectedRecord.url : undefined}
          title={selectedRecord && !showConnections ? "SSE Logs" : "SSE DevTools"}
          onBack={records.length > 1 ? () => setIsDetailVisible(false) : undefined}
          onClose={onToggle}
          onToggleTheme={onToggleTheme}
        />

        <View style={styles.body}>
          {showConnections ? (
            <ConnectionList
              palette={palette}
              records={records}
              selectedId={selectedId}
              onSelect={(id) => {
                setSelectedId(id);
                setIsDetailVisible(true);
              }}
            />
          ) : selectedRecord ? (
            <DetailPane
              clearEvents={clearEvents}
              palette={palette}
              record={selectedRecord}
              onCopyPayload={onCopyPayload}
              onExportEvents={onExportEvents}
            />
          ) : (
            <EmptyState palette={palette} text="No active SSE connections." />
          )}
        </View>
      </Animated.View>
    </View>
  );
});

function clampPanelHeight(height: number, minHeight: number, maxHeight: number): number {
  return Math.max(minHeight, Math.min(height, maxHeight));
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    minHeight: 0
  },
  dragHandle: {
    borderRadius: 999,
    height: 4,
    width: 56
  },
  dragHandleArea: {
    alignItems: "center",
    height: 32,
    justifyContent: "center"
  },
  overlay: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
    zIndex: 99999
  },
  overlayShade: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0
  },
  panel: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1,
    bottom: 0,
    left: 8,
    overflow: "hidden",
    position: "absolute",
    right: 8
  }
});
