import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import {
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useSharedValue } from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const CANVAS_HEIGHT = SCREEN_HEIGHT * 0.6;

export default function Index() {
  const [currentSymbol, setCurrentSymbol] = useState("");
  const [paths, setPaths] = useState([]);
  const [confidence, setConfidence] = useState(0);
  const currentPath = useSharedValue([]);

  // Helper functions for more robust symbol recognition
  const getPathBoundingBox = (path) => {
    if (!path || path.length === 0)
      return { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, height: 0 };

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    path.forEach((point) => {
      minX = Math.min(minX, point.x);
      maxX = Math.max(maxX, point.x);
      minY = Math.min(minY, point.y);
      maxY = Math.max(maxY, point.y);
    });

    return {
      minX,
      maxX,
      minY,
      maxY,
      width: maxX - minX,
      height: maxY - minY,
    };
  };

  const calculateAngle = (p1, p2) => {
    return (Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180) / Math.PI;
  };

  const calculateCurvature = (path) => {
    if (path.length < 3) return 0;

    let totalAngleChange = 0;

    for (let i = 1; i < path.length - 1; i++) {
      const angle1 = calculateAngle(path[i - 1], path[i]);
      const angle2 = calculateAngle(path[i], path[i + 1]);

      // Calculate the absolute angle difference
      let angleDiff = Math.abs(angle2 - angle1);
      // Ensure we get the smallest angle
      if (angleDiff > 180) angleDiff = 360 - angleDiff;

      totalAngleChange += angleDiff;
    }

    return totalAngleChange / (path.length - 2);
  };

  // Simplify the path to reduce noise
  const simplifyPath = (path, tolerance = 5) => {
    if (path.length <= 2) return path;

    const result = [path[0]];
    let lastPoint = path[0];

    for (let i = 1; i < path.length; i++) {
      const dx = path[i].x - lastPoint.x;
      const dy = path[i].y - lastPoint.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance > tolerance) {
        result.push(path[i]);
        lastPoint = path[i];
      }
    }

    // Always include the last point
    if (
      path.length > 1 &&
      result[result.length - 1] !== path[path.length - 1]
    ) {
      result.push(path[path.length - 1]);
    }

    return result;
  };

  // Normalize the path to make recognition more consistent
  const normalizePath = (path) => {
    const bbox = getPathBoundingBox(path);
    if (bbox.width === 0 || bbox.height === 0) return path;

    // Scale to a standard size and center
    return path.map((point) => ({
      x: (point.x - bbox.minX) / bbox.width,
      y: (point.y - bbox.minY) / bbox.height,
    }));
  };

  // Extract features for recognition
  const extractFeatures = (path) => {
    if (path.length < 5) return null;

    const simplifiedPath = simplifyPath(path);
    const normalizedPath = normalizePath(simplifiedPath);

    if (normalizedPath.length < 3) return null;

    // Split path into sections
    const firstThird = normalizedPath.slice(
      0,
      Math.floor(normalizedPath.length / 3)
    );
    const middleThird = normalizedPath.slice(
      Math.floor(normalizedPath.length / 3),
      Math.floor((2 * normalizedPath.length) / 3)
    );
    const lastThird = normalizedPath.slice(
      Math.floor((2 * normalizedPath.length) / 3)
    );

    // Calculate direction changes
    const firstDirection =
      lastThird[0].x - firstThird[0].x > 0 ? "right" : "left";

    // Calculate vertical tendency
    const startY = normalizedPath[0].y;
    const midY = normalizedPath[Math.floor(normalizedPath.length / 2)].y;
    const endY = normalizedPath[normalizedPath.length - 1].y;

    // Calculate curvature
    const curvature = calculateCurvature(normalizedPath);

    // Calculate aspect ratio
    const bbox = getPathBoundingBox(normalizedPath);
    const aspectRatio = bbox.width / (bbox.height || 1);

    return {
      firstDirection,
      startY,
      midY,
      endY,
      curvature,
      aspectRatio,
      length: normalizedPath.length,
      normalizedPath,
    };
  };

  const recognizeSymbol = (path) => {
    if (path.length < 5) {
      return { symbol: "=", confidence: 0 };
    }

    const features = extractFeatures(path);
    if (!features) return { symbol: "=", confidence: 0 };

    // Initialize scores for each symbol
    let scores = {
      ">": 0,
      "<": 0,
    };

    // Check for ">" shape
    if (features.aspectRatio > 0.5 && features.aspectRatio < 2.0) {
      // Calculate key points for angle detection
      const firstPoint = features.normalizedPath[0];
      const midPoint =
        features.normalizedPath[Math.floor(features.normalizedPath.length / 2)];
      const lastPoint =
        features.normalizedPath[features.normalizedPath.length - 1];

      // ">" typically has the middle point furthest to the right
      if (midPoint.x > firstPoint.x && midPoint.x > lastPoint.x) {
        scores[">"] += 40;

        // First half should go down, second half up
        if (midPoint.y > firstPoint.y && midPoint.y > lastPoint.y) {
          scores[">"] += 30;
        }

        // Start and end points should be roughly at same height
        if (Math.abs(firstPoint.y - lastPoint.y) < 0.3) {
          scores[">"] += 30;
        }
      }

      // "<" typically has the middle point furthest to the left
      if (midPoint.x < firstPoint.x && midPoint.x < lastPoint.x) {
        scores["<"] += 40;

        // First half should go down, second half up
        if (midPoint.y > firstPoint.y && midPoint.y > lastPoint.y) {
          scores["<"] += 30;
        }

        // Start and end points should be roughly at same height
        if (Math.abs(firstPoint.y - lastPoint.y) < 0.3) {
          scores["<"] += 30;
        }
      }
    }

    // Determine the winner
    let maxScore = 0;
    let recognizedSymbol = "="; // Default to "=" instead of "Unknown"

    Object.entries(scores).forEach(([symbol, score]) => {
      if (score > maxScore) {
        maxScore = score;
        recognizedSymbol = symbol;
      }
    });

    // Require a minimum score to consider it recognized as ">" or "<"
    if (maxScore < 40) {
      return { symbol: "=", confidence: 0 };
    }

    // Normalize confidence to 0-100
    const confidence = Math.min(100, maxScore);

    return { symbol: recognizedSymbol, confidence };
  };

  const gesture = Gesture.Pan()
    .onStart((e) => {
      const newPath = [{ x: e.x, y: e.y }];
      currentPath.value = newPath;
    })
    .onUpdate((e) => {
      currentPath.value = [...currentPath.value, { x: e.x, y: e.y }];
    })
    .onEnd(() => {
      if (currentPath.value.length > 0) {
        const result = recognizeSymbol(currentPath.value);
        setCurrentSymbol(result.symbol);
        setConfidence(result.confidence);
        setPaths([...paths, { points: currentPath.value }]);
        currentPath.value = [];
      }
    });

  const clearCanvas = () => {
    setPaths([]);
    setCurrentSymbol("");
    setConfidence(0);
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
            ? `Recognized Symbol: ${currentSymbol}${
                confidence > 0 ? ` (${confidence}% confident)` : ""
              }`
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
