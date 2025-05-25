import { StatusBar } from "expo-status-bar";
import React, { useEffect, useState } from "react";
import { Dimensions, LogBox, StyleSheet, Text, View } from "react-native";
import { useSharedValue } from "react-native-reanimated";
import Canvas from "../components/canvas";
import { log, logError, Point, recognizeSymbol } from "../utils/symbolUtils";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

// Main component
export default function Index() {
  const [currentSymbol, setCurrentSymbol] = useState("");
  const [paths, setPaths] = useState<Point[][]>([]);
  const [shouldClearOnNextDraw, setShouldClearOnNextDraw] = useState(false);
  const currentPath = useSharedValue<Point[]>([]);

  // Ignore specific warnings that might be related to gesture handling
  useEffect(() => {
    LogBox.ignoreLogs([
      "Non-serializable values were found in the navigation state",
      "Failed prop type",
      "Possible Unhandled Promise Rejection",
    ]);
  }, []);

  // Debug log for component state
  useEffect(() => {
    log("Component mounted or updated");

    return () => {
      // Clean up any shared values on unmount
      currentPath.value = [];
    };
  }, []);

  // Synchronize state for debugging
  useEffect(() => {
    log(`Current Symbol: ${currentSymbol}`);
  }, [currentSymbol]);

  // Auto-clear function
  const autoClearCanvas = () => {
    setPaths([]);
    setCurrentSymbol("");
    currentPath.value = [];
    setShouldClearOnNextDraw(false);
  };

  const handleGestureStart = () => {
    // Clear canvas when user starts drawing a new symbol
    if (shouldClearOnNextDraw) {
      autoClearCanvas();
    }
  };

  const handleGestureEnd = (path: Point[]) => {
    if (path.length >= 5) {
      try {
        // Skip recognition entirely if there's a chance of error
        if (path.some((p) => !isFinite(p.x) || !isFinite(p.y))) {
          log("Invalid points detected, skipping recognition");
          setCurrentSymbol("Invalid input");
        } else {
          log("Calling recognizeSymbol");
          const result = recognizeSymbol(path);
          log("Recognition result:", result);
          setCurrentSymbol(result.symbol);

          // Set flag to clear on next draw for recognized symbols (>, <, =)
          if (
            result.symbol &&
            (result.symbol === ">" ||
              result.symbol === "<" ||
              result.symbol === "=")
          ) {
            setShouldClearOnNextDraw(true);
          }
        }

        // Always save the path for visualization
        setPaths((prevPaths) => [...prevPaths, path]);
      } catch (recogError) {
        logError("Recognition error:", recogError);
        setCurrentSymbol("Error");
        // No auto-clear on error - user keeps the drawing to try again
      }
    } else if (path.length > 0) {
      log("Path too short for recognition:", path.length);
      setCurrentSymbol("Too short");
      setPaths((prevPaths) => [...prevPaths, path]);
      // No auto-clear for too short paths - user can continue drawing
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="auto" />
      <View style={styles.header}>
        <Text style={styles.title}>Symbol Recognition</Text>
        <Text style={styles.subtitle}>Draw a symbol to recognize it</Text>
      </View>

      <Canvas
        currentPath={currentPath}
        paths={paths}
        onGestureStart={handleGestureStart}
        onGestureEnd={handleGestureEnd}
      />

      <View style={styles.resultContainer}>
        <Text style={styles.resultText}>
          Recognized Symbol: {currentSymbol || "None"}
        </Text>
      </View>
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
  resultContainer: {
    marginTop: 20,
    alignItems: "center",
  },
  resultText: {
    fontSize: 18,
    fontWeight: "500",
  },
});
