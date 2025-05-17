import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
} from "react-native";
import { GestureDetector, Gesture } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useState } from "react";
import { StatusBar } from "expo-status-bar";
import Svg, { Path } from "react-native-svg";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const CANVAS_HEIGHT = SCREEN_HEIGHT * 0.6;

export default function Index() {
  const [currentSymbol, setCurrentSymbol] = useState<string>("");
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(
    null
  );
  const [endPoint, setEndPoint] = useState<{ x: number; y: number } | null>(
    null
  );
  const [paths, setPaths] = useState<
    Array<{ points: Array<{ x: number; y: number }> }>
  >([]);
  const currentPath = useSharedValue<Array<{ x: number; y: number }>>([]);

  const recognizeSymbol = (
    start: { x: number; y: number },
    end: { x: number; y: number }
  ) => {
    const midPoint = SCREEN_WIDTH / 2;

    // Check if both points are on the same side
    const bothOnLeft = start.x < midPoint && end.x < midPoint;
    const bothOnRight = start.x >= midPoint && end.x >= midPoint;
    const crossesMiddle =
      (start.x < midPoint && end.x >= midPoint) ||
      (start.x >= midPoint && end.x < midPoint);

    // If both points are on the left side -> ">"
    if (bothOnLeft) {
      return ">";
    }

    // If both points are on the right side -> "<"
    if (bothOnRight) {
      return "<";
    }

    // If the line crosses the middle -> "="
    if (crossesMiddle) {
      return "=";
    }

    return "Unknown";
  };

  const gesture = Gesture.Pan()
    .onStart((e) => {
      const newPath = [{ x: e.x, y: e.y }];
      currentPath.value = newPath;
      setStartPoint({ x: e.x, y: e.y });
    })
    .onUpdate((e) => {
      currentPath.value = [...currentPath.value, { x: e.x, y: e.y }];
    })
    .onEnd((e) => {
      const end = { x: e.x, y: e.y };
      setEndPoint(end);
      if (startPoint) {
        const symbol = recognizeSymbol(startPoint, end);
        setCurrentSymbol(symbol);
      }
      setPaths([...paths, { points: currentPath.value }]);
      currentPath.value = [];
    });

  const clearCanvas = () => {
    setPaths([]);
    setCurrentSymbol("");
    setStartPoint(null);
    setEndPoint(null);
  };

  return (
    <View style={styles.container}>
      <StatusBar style="auto" />

      <View style={styles.header}>
        <Text style={styles.title}>Symbol Recognition</Text>
        <Text style={styles.subtitle}>
          Draw a comparison symbol ({">"}, {"<"}, {"="})
        </Text>
      </View>

      <View style={styles.canvasContainer}>
        <GestureDetector gesture={gesture}>
          <Animated.View style={styles.canvas}>
            {/* Vertical divider */}
            <View style={styles.divider} />

            {/* Draw existing paths */}
            {paths.map((path, index) => (
              <Svg
                key={index}
                width={SCREEN_WIDTH}
                height={CANVAS_HEIGHT}
                viewBox={`0 0 ${SCREEN_WIDTH} ${CANVAS_HEIGHT}`}
                style={StyleSheet.absoluteFill}
              >
                <Path
                  d={path.points.reduce((acc, point, i) => {
                    return i === 0
                      ? `M ${point.x} ${point.y}`
                      : `${acc} L ${point.x} ${point.y}`;
                  }, "")}
                  stroke="black"
                  strokeWidth={3}
                  fill="none"
                />
              </Svg>
            ))}
          </Animated.View>
        </GestureDetector>
      </View>

      <View style={styles.resultContainer}>
        <Text style={styles.resultText}>
          {currentSymbol
            ? `Recognized Symbol: ${currentSymbol}`
            : "Draw a symbol"}
        </Text>
      </View>

      <TouchableOpacity style={styles.clearButton} onPress={clearCanvas}>
        <Text style={styles.clearButtonText}>Clear Canvas</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 20,
  },
  header: {
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
  },
  canvasContainer: {
    height: CANVAS_HEIGHT,
    backgroundColor: "#f5f5f5",
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#ddd",
    position: "relative",
  },
  canvas: {
    flex: 1,
    backgroundColor: "#fff",
    position: "relative",
  },
  divider: {
    position: "absolute",
    left: "50%",
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: "#ddd",
    zIndex: 1,
  },
  resultContainer: {
    marginTop: 20,
    padding: 15,
    backgroundColor: "#f0f0f0",
    borderRadius: 8,
    alignItems: "center",
  },
  resultText: {
    fontSize: 18,
    fontWeight: "500",
  },
  clearButton: {
    marginTop: 20,
    backgroundColor: "#007AFF",
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
  },
  clearButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
