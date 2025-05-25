import React, { useEffect, useState } from "react";
import { Dimensions, Platform, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { SharedValue } from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import { Point, log, logError } from "../utils/symbolUtils";

const { width, height } = Dimensions.get("window");
// Configurable canvas size - easily adjustable
const CANVAS_SIZE = Math.min(width, height) * 0.3; // You can change this multiplier to adjust size

interface CanvasProps {
  currentPath: SharedValue<Point[]>;
  paths: Point[][];
  onGestureStart?: () => void;
  onGestureEnd: (path: Point[]) => void;
}

const Canvas: React.FC<CanvasProps> = ({
  currentPath,
  paths,
  onGestureStart,
  onGestureEnd,
}) => {
  // Use regular state for rendering the current path to avoid accessing shared value during render
  const [currentDrawingPath, setCurrentDrawingPath] = useState<Point[]>([]);

  // Debug log for component state
  useEffect(() => {
    log("Canvas component mounted or updated");
  }, []);

  const gesture = Gesture.Pan()
    .runOnJS(true) // Force run gestures on JS thread for mobile compatibility
    .minDistance(5) // Minimum distance to recognize as a pan
    .onStart((e) => {
      try {
        // Call the onGestureStart callback if provided
        if (onGestureStart) {
          onGestureStart();
        }

        const newPath = [{ x: e.x, y: e.y }];
        currentPath.value = newPath;
        setCurrentDrawingPath(newPath); // Update render state
      } catch (error) {
        logError("Error in gesture start:", error);
      }
    })
    .onUpdate((e) => {
      try {
        if (currentPath.value && Array.isArray(currentPath.value)) {
          // Check if points are valid numbers
          if (!isNaN(e.x) && !isNaN(e.y)) {
            const updatedPath = [...currentPath.value, { x: e.x, y: e.y }];
            currentPath.value = updatedPath;
            setCurrentDrawingPath(updatedPath); // Update render state
          }
        }
      } catch (error) {
        logError("Error in gesture update:", error);
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
          setCurrentDrawingPath([]); // Clear render state

          log(`Processing gesture with ${rawPath.length} points`);

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
                log("Invalid points detected, skipping recognition");
                onGestureEnd([]);
              } else {
                log("Calling gesture end handler");
                onGestureEnd(pathCopy);
              }
            } catch (recogError) {
              logError("Recognition error:", recogError);
              onGestureEnd([]);
            }
          } else {
            log("Path too short for recognition:", pathCopy.length);
            onGestureEnd(pathCopy); // Pass the short path too for display
          }
        } catch (error) {
          logError("Error processing gesture:", error);
          onGestureEnd([]);
        }
      }
    });

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
            logError("Error rendering path:", err);
            return null;
          }
        })
        .filter(Boolean); // Remove any null paths
    } catch (error) {
      logError("Error in renderPaths:", error);
      return null;
    }
  };

  const renderCurrentPath = () => {
    try {
      if (currentDrawingPath && currentDrawingPath.length > 1) {
        // Filter and validate points
        const validPoints = currentDrawingPath
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
      logError("Error rendering current path:", error);
      return null;
    }
  };

  return (
    <View style={styles.canvasContainer}>
      <GestureDetector gesture={gesture}>
        <Animated.View style={styles.canvas}>
          <Svg height={CANVAS_SIZE} width={CANVAS_SIZE}>
            {renderPaths()}
            {renderCurrentPath()}
          </Svg>
        </Animated.View>
      </GestureDetector>
    </View>
  );
};

const styles = StyleSheet.create({
  canvasContainer: {
    width: CANVAS_SIZE,
    height: CANVAS_SIZE,
    backgroundColor: "#f5f5f5",
    borderRadius: 10,
    overflow: "hidden",
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
  },
});

export default Canvas;
