import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import {
  Dimensions,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useSharedValue } from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import { recognizeSymbol } from "../utils/symbolUtils";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const CANVAS_HEIGHT = SCREEN_HEIGHT * 0.6;

interface Point {
  x: number;
  y: number;
}

export default function Index() {
  const [currentSymbol, setCurrentSymbol] = useState("");
  const [paths, setPaths] = useState<Point[][]>([]);
  const [confidence, setConfidence] = useState(0);
  const currentPath = useSharedValue<Point[]>([]);

  const gesture = Gesture.Pan()
    .onStart((e) => {
      const newPath = [{ x: e.x, y: e.y }];
      currentPath.value = newPath;
    })
    .onUpdate((e) => {
      if (currentPath.value) {
        currentPath.value = [...currentPath.value, { x: e.x, y: e.y }];
      }
    })
    .onEnd(() => {
      if (currentPath.value && currentPath.value.length > 0) {
        try {
          const pathCopy = [...currentPath.value];
          const result = recognizeSymbol(pathCopy);
          setCurrentSymbol(result.symbol);
          setConfidence(result.confidence);
          setPaths((prevPaths) => [...prevPaths, pathCopy]);
        } catch (error) {
          console.error("Error processing gesture:", error);
        }
        // Clear current path after processing
        currentPath.value = [];
      }
    });

  const clearCanvas = () => {
    setPaths([]);
    setCurrentSymbol("");
    setConfidence(0);
    currentPath.value = [];
  };

  const renderPaths = () => {
    return paths.map((path, index) => (
      <Path
        key={index}
        d={path
          .map((point, i) => `${i === 0 ? "M" : "L"} ${point.x} ${point.y}`)
          .join(" ")}
        stroke="black"
        strokeWidth={2}
        fill="none"
      />
    ));
  };

  const renderCurrentPath = () => {
    if (currentPath.value && currentPath.value.length > 0) {
      return (
        <Path
          d={currentPath.value
            .map((point, i) => `${i === 0 ? "M" : "L"} ${point.x} ${point.y}`)
            .join(" ")}
          stroke="black"
          strokeWidth={2}
          fill="none"
        />
      );
    }
    return null;
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
