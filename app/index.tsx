import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import {
  Dimensions,
  LogBox,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useSharedValue } from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";

// Ignore specific warnings that might be related to gesture handling
useEffect(() => {
  LogBox.ignoreLogs([
    "Non-serializable values were found in the navigation state",
    "Failed prop type",
    "Possible Unhandled Promise Rejection",
  ]);
}, []);

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const CANVAS_HEIGHT = SCREEN_HEIGHT * 0.6;

interface Point {
  x: number;
  y: number;
}

interface BoundingBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width: number;
  height: number;
}

interface Features {
  firstDirection: string;
  startY: number;
  midY: number;
  endY: number;
  curvature: number;
  aspectRatio: number;
  length: number;
  normalizedPath: Point[];
}

// Symbol recognition utility functions
const getPathBoundingBox = (path: Point[]): BoundingBox => {
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

const calculateAngle = (p1: Point, p2: Point): number => {
  try {
    // Validate points to prevent NaN errors
    if (
      !p1 ||
      !p2 ||
      typeof p1.x !== "number" ||
      typeof p1.y !== "number" ||
      typeof p2.x !== "number" ||
      typeof p2.y !== "number" ||
      isNaN(p1.x) ||
      isNaN(p1.y) ||
      isNaN(p2.x) ||
      isNaN(p2.y)
    ) {
      return 0;
    }

    // Check for identical points which would cause division by zero
    if (p1.x === p2.x && p1.y === p2.y) {
      return 0;
    }

    return (Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180) / Math.PI;
  } catch (error) {
    console.error("Error calculating angle:", error);
    return 0;
  }
};

const calculateCurvature = (path: Point[]): number => {
  try {
    if (!path || path.length < 3) return 0;

    let totalAngleChange = 0;
    let validAngles = 0;

    for (let i = 1; i < path.length - 1; i++) {
      try {
        const angle1 = calculateAngle(path[i - 1], path[i]);
        const angle2 = calculateAngle(path[i], path[i + 1]);

        // Check for NaN or Infinity
        if (
          isNaN(angle1) ||
          isNaN(angle2) ||
          !isFinite(angle1) ||
          !isFinite(angle2)
        ) {
          continue;
        }

        let angleDiff = Math.abs(angle2 - angle1);
        if (angleDiff > 180) angleDiff = 360 - angleDiff;

        totalAngleChange += angleDiff;
        validAngles++;
      } catch (error) {
        // Skip problematic angle calculations
        console.log("Skipping angle calculation at index", i);
      }
    }

    return validAngles > 0 ? totalAngleChange / validAngles : 0;
  } catch (error) {
    console.error("Error in calculateCurvature:", error);
    return 0;
  }
};

const simplifyPath = (path: Point[], tolerance = 5): Point[] => {
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

  if (path.length > 1 && result[result.length - 1] !== path[path.length - 1]) {
    result.push(path[path.length - 1]);
  }

  return result;
};

const normalizePath = (path: Point[]): Point[] => {
  const bbox = getPathBoundingBox(path);
  if (bbox.width === 0 || bbox.height === 0) return path;

  return path.map((point) => ({
    x: (point.x - bbox.minX) / bbox.width,
    y: (point.y - bbox.minY) / bbox.height,
  }));
};

const extractFeatures = (path: Point[]): Features | null => {
  try {
    if (!path || !Array.isArray(path) || path.length < 5) {
      console.log("Path too short for feature extraction");
      return null;
    }

    // Create a safe copy to handle potential invalid points
    const safePath = path.filter(
      (point) =>
        point &&
        typeof point.x === "number" &&
        typeof point.y === "number" &&
        !isNaN(point.x) &&
        !isNaN(point.y)
    );

    if (safePath.length < 5) {
      console.log("Not enough valid points after filtering");
      return null;
    }

    const simplifiedPath = simplifyPath(safePath);
    if (simplifiedPath.length < 3) {
      console.log("Simplified path too short");
      return null;
    }

    const normalizedPath = normalizePath(simplifiedPath);
    if (normalizedPath.length < 3) {
      console.log("Normalized path too short");
      return null;
    }

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

    if (!firstThird.length || !lastThird.length) {
      console.log("Invalid path segments");
      return null;
    }

    const firstDirection =
      lastThird[0].x - firstThird[0].x > 0 ? "right" : "left";

    const startY = normalizedPath[0].y;
    const midY = normalizedPath[Math.floor(normalizedPath.length / 2)].y;
    const endY = normalizedPath[normalizedPath.length - 1].y;

    const curvature = calculateCurvature(normalizedPath);
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
  } catch (error) {
    console.error("Error in extractFeatures:", error);
    return null;
  }
};

const recognizeSymbol = (
  path: Point[]
): { symbol: string; confidence: number } => {
  // Early return with better validation
  if (!path || !Array.isArray(path) || path.length < 5) {
    console.log("Path too short or invalid:", path?.length || 0);
    return { symbol: "=", confidence: 0 };
  }

  try {
    const features = extractFeatures(path);
    if (!features) {
      console.log("Failed to extract features");
      return { symbol: "=", confidence: 0 };
    }

    let scores = {
      ">": 0,
      "<": 0,
    };

    if (features.aspectRatio > 0.5 && features.aspectRatio < 2.0) {
      const firstPoint = features.normalizedPath[0];
      const midPoint =
        features.normalizedPath[Math.floor(features.normalizedPath.length / 2)];
      const lastPoint =
        features.normalizedPath[features.normalizedPath.length - 1];

      if (midPoint.x > firstPoint.x && midPoint.x > lastPoint.x) {
        scores[">"] += 40;

        if (midPoint.y > firstPoint.y && midPoint.y > lastPoint.y) {
          scores[">"] += 30;
        }

        if (Math.abs(firstPoint.y - lastPoint.y) < 0.3) {
          scores[">"] += 30;
        }
      }

      if (midPoint.x < firstPoint.x && midPoint.x < lastPoint.x) {
        scores["<"] += 40;

        if (midPoint.y > firstPoint.y && midPoint.y > lastPoint.y) {
          scores["<"] += 30;
        }

        if (Math.abs(firstPoint.y - lastPoint.y) < 0.3) {
          scores["<"] += 30;
        }
      }
    }

    let maxScore = 0;
    let recognizedSymbol = "=";

    Object.entries(scores).forEach(([symbol, score]) => {
      if (score > maxScore) {
        maxScore = score;
        recognizedSymbol = symbol;
      }
    });

    if (maxScore < 40) {
      return { symbol: "=", confidence: 0 };
    }

    const confidence = Math.min(100, maxScore);

    return { symbol: recognizedSymbol, confidence };
  } catch (error) {
    console.error("Recognition error:", error);
    return { symbol: "Error", confidence: 0 };
  }
};

// Main component
export default function Index() {
  const [currentSymbol, setCurrentSymbol] = useState("");
  const [paths, setPaths] = useState<Point[][]>([]);
  const [confidence, setConfidence] = useState(0);
  const currentPath = useSharedValue<Point[]>([]);

  // Debug log for component state
  useEffect(() => {
    console.log("Component mounted or updated");

    return () => {
      // Clean up any shared values on unmount
      currentPath.value = [];
    };
  }, []);

  // Synchronize state for debugging
  useEffect(() => {
    console.log(`Current Symbol: ${currentSymbol}, Confidence: ${confidence}`);
  }, [currentSymbol, confidence]);

  const gesture = Gesture.Pan()
    .runOnJS(true) // Force run gestures on JS thread for mobile compatibility
    .minDistance(5) // Minimum distance to recognize as a pan
    .onStart((e) => {
      try {
        const newPath = [{ x: e.x, y: e.y }];
        currentPath.value = newPath;
      } catch (error) {
        console.error("Error in gesture start:", error);
      }
    })
    .onUpdate((e) => {
      try {
        if (currentPath.value && Array.isArray(currentPath.value)) {
          // Check if points are valid numbers
          if (!isNaN(e.x) && !isNaN(e.y)) {
            currentPath.value = [...currentPath.value, { x: e.x, y: e.y }];
          }
        }
      } catch (error) {
        console.error("Error in gesture update:", error);
      }
    })
    .onEnd(() => {
      if (
        currentPath.value &&
        Array.isArray(currentPath.value) &&
        currentPath.value.length > 0
      ) {
        try {
          // Create a stable copy of the path data first
          const rawPath = [...currentPath.value];
          currentPath.value = []; // Clear early to prevent any issues

          console.log(`Processing gesture with ${rawPath.length} points`);

          // Create a safe copy with proper validation
          const pathCopy = rawPath
            .filter(
              (point) =>
                point &&
                typeof point.x === "number" &&
                typeof point.y === "number" &&
                !isNaN(point.x) &&
                !isNaN(point.y)
            )
            .map((point) => ({
              x: point.x,
              y: point.y,
            }));

          // Only process if we have enough valid points
          if (pathCopy.length >= 5) {
            try {
              // Skip recognition entirely if there's a chance of error
              if (pathCopy.some((p) => !isFinite(p.x) || !isFinite(p.y))) {
                console.log("Invalid points detected, skipping recognition");
                setCurrentSymbol("Invalid input");
                setConfidence(0);
              } else {
                console.log("Calling recognizeSymbol");
                const result = recognizeSymbol(pathCopy);
                console.log("Recognition result:", result);
                setCurrentSymbol(result.symbol);
                setConfidence(result.confidence);
              }

              // Always save the path for visualization
              setPaths((prevPaths) => [...prevPaths, pathCopy]);
            } catch (recogError) {
              console.error("Recognition error:", JSON.stringify(recogError));
              setCurrentSymbol("Error");
              setConfidence(0);
            }
          } else {
            console.log("Path too short for recognition:", pathCopy.length);
            setCurrentSymbol("Too short");
            setConfidence(0);
          }
        } catch (error) {
          console.error("Error processing gesture:", JSON.stringify(error));
          console.error(
            "Path data:",
            JSON.stringify(currentPath.value?.slice?.(0, 5) || "No valid path")
          );

          // Provide feedback to user
          setCurrentSymbol("Error");
          setConfidence(0);
        }
      }
    });

  const clearCanvas = () => {
    setPaths([]);
    setCurrentSymbol("");
    setConfidence(0);
    currentPath.value = [];
  };

  const renderPaths = () => {
    try {
      return paths
        .map((path, index) => {
          try {
            // Validate path to prevent rendering errors
            if (!path || !Array.isArray(path) || path.length < 2) {
              return null;
            }

            // Create SVG path data with safety checks
            const pathData = path
              .filter(
                (pt) =>
                  pt && typeof pt.x === "number" && typeof pt.y === "number"
              )
              .map((point, i) => {
                // Ensure values are finite numbers
                const x = isFinite(point.x) ? point.x : 0;
                const y = isFinite(point.y) ? point.y : 0;
                return `${i === 0 ? "M" : "L"} ${x} ${y}`;
              })
              .join(" ");

            return pathData.length > 0 ? (
              <Path
                key={index}
                d={pathData}
                stroke="black"
                strokeWidth={2}
                fill="none"
              />
            ) : null;
          } catch (err) {
            console.error("Error rendering path:", err);
            return null;
          }
        })
        .filter(Boolean); // Remove any null paths
    } catch (error) {
      console.error("Error in renderPaths:", error);
      return null;
    }
  };

  const renderCurrentPath = () => {
    try {
      if (
        currentPath.value &&
        Array.isArray(currentPath.value) &&
        currentPath.value.length > 1
      ) {
        // Filter and validate points
        const validPoints = currentPath.value
          .filter(
            (pt) => pt && typeof pt.x === "number" && typeof pt.y === "number"
          )
          .map((point) => ({
            x: isFinite(point.x) ? point.x : 0,
            y: isFinite(point.y) ? point.y : 0,
          }));

        if (validPoints.length < 2) return null;

        // Create SVG path data
        const pathData = validPoints
          .map((point, i) => `${i === 0 ? "M" : "L"} ${point.x} ${point.y}`)
          .join(" ");

        return <Path d={pathData} stroke="black" strokeWidth={2} fill="none" />;
      }
      return null;
    } catch (error) {
      console.error("Error rendering current path:", error);
      return null;
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="auto" />
      <View style={styles.header}>
        <Text style={styles.title}>Symbol Recognition</Text>
        <Text style={styles.subtitle}>Draw a symbol to recognize it</Text>
      </View>

      <View style={styles.canvasContainer}>
        <GestureDetector gesture={gesture}>
          <Animated.View style={styles.canvas}>
            <Svg height={CANVAS_HEIGHT} width={SCREEN_WIDTH}>
              {renderPaths()}
              {renderCurrentPath()}
            </Svg>
          </Animated.View>
        </GestureDetector>
      </View>

      <View style={styles.resultContainer}>
        <Text style={styles.resultText}>
          Recognized Symbol: {currentSymbol || "None"}
        </Text>
        {confidence > 0 && (
          <Text style={styles.confidenceText}>
            Confidence: {confidence.toFixed(1)}%
          </Text>
        )}
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
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    position: "absolute",
    top: 50,
    alignItems: "center",
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
    width: SCREEN_WIDTH,
    height: CANVAS_HEIGHT,
    backgroundColor: "#f5f5f5",
    borderRadius: 10,
    overflow: "hidden",
    // Using platform-specific styling without deprecated shadow props
    ...Platform.select({
      ios: {
        boxShadow: "0px 2px 4px rgba(0, 0, 0, 0.1)",
      },
      android: {
        elevation: 2,
      },
      web: {
        boxShadow: "0px 2px 4px rgba(0, 0, 0, 0.1)",
      },
    }),
  },
  canvas: {
    flex: 1,
    // Removed the deprecated pointerEvents prop
  },
  resultContainer: {
    marginTop: 20,
    alignItems: "center",
  },
  resultText: {
    fontSize: 18,
    fontWeight: "500",
  },
  confidenceText: {
    fontSize: 16,
    color: "#666",
    marginTop: 4,
  },
  clearButton: {
    marginTop: 20,
    backgroundColor: "#007AFF",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    // Using platform-specific styling without deprecated shadow props
    ...Platform.select({
      ios: {
        boxShadow: "0px 2px 4px rgba(0, 0, 0, 0.1)",
      },
      android: {
        elevation: 2,
      },
      web: {
        boxShadow: "0px 2px 4px rgba(0, 0, 0, 0.1)",
      },
    }),
  },
  clearButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "500",
  },
});
