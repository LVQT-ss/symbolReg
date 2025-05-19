import { StatusBar } from "expo-status-bar";
import React, { useEffect, useState } from "react";
import {
  Dimensions,
  LogBox,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSharedValue } from "react-native-reanimated";
import Canvas from "../components/canvas";
import { log, logError, Point, recognizeSymbol } from "../utils/symbolUtils";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

// Main component
export default function Index() {
  const [currentSymbol, setCurrentSymbol] = useState("");
  const [paths, setPaths] = useState<Point[][]>([]);
  const [confidence, setConfidence] = useState(0);
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
    log(`Current Symbol: ${currentSymbol}, Confidence: ${confidence}`);
  }, [currentSymbol, confidence]);

  const handleGestureEnd = (path: Point[]) => {
    if (path.length >= 5) {
      try {
        // Skip recognition entirely if there's a chance of error
        if (path.some((p) => !isFinite(p.x) || !isFinite(p.y))) {
          log("Invalid points detected, skipping recognition");
          setCurrentSymbol("Invalid input");
          setConfidence(0);
        } else {
          log("Calling recognizeSymbol");
          const result = recognizeSymbol(path);
          log("Recognition result:", result);
          setCurrentSymbol(result.symbol);
          setConfidence(result.confidence);
        }

        // Always save the path for visualization
        setPaths((prevPaths) => [...prevPaths, path]);
      } catch (recogError) {
        logError("Recognition error:", recogError);
        setCurrentSymbol("Error");
        setConfidence(0);
      }
    } else if (path.length > 0) {
      log("Path too short for recognition:", path.length);
      setCurrentSymbol("Too short");
      setConfidence(0);
      setPaths((prevPaths) => [...prevPaths, path]);
    }
  };

  const clearCanvas = () => {
    setPaths([]);
    setCurrentSymbol("");
    setConfidence(0);
    currentPath.value = [];
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
        onGestureEnd={handleGestureEnd}
      />

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
  },
  clearButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "500",
  },
});
