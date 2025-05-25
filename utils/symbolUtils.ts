import { Dimensions } from "react-native";

// Set this to false to disable console logs
export const DEBUG = false;

// Custom logger that only logs when DEBUG is true
export const log = (message: string, ...data: any[]) => {
  if (DEBUG) {
    console.log(message, ...data);
  }
};

// Custom error logger that always logs errors (important for debugging)
export const logError = (message: string, error?: any) => {
  if (DEBUG || error) {
    console.error(message, error);
  }
};

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

export interface Point {
  x: number;
  y: number;
}

export interface BoundingBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width: number;
  height: number;
}

export interface Features {
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
export const getPathBoundingBox = (path: Point[]): BoundingBox => {
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

export const calculateAngle = (p1: Point, p2: Point): number => {
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
    logError("Error calculating angle:", error);
    return 0;
  }
};

export const calculateCurvature = (path: Point[]): number => {
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
        log("Skipping angle calculation at index", i);
      }
    }

    return validAngles > 0 ? totalAngleChange / validAngles : 0;
  } catch (error) {
    logError("Error in calculateCurvature:", error);
    return 0;
  }
};

export const simplifyPath = (path: Point[], tolerance = 5): Point[] => {
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

export const normalizePath = (path: Point[]): Point[] => {
  const bbox = getPathBoundingBox(path);
  if (bbox.width === 0 || bbox.height === 0) return path;

  return path.map((point) => ({
    x: (point.x - bbox.minX) / bbox.width,
    y: (point.y - bbox.minY) / bbox.height,
  }));
};

export const extractFeatures = (path: Point[]): Features | null => {
  try {
    if (!path || !Array.isArray(path) || path.length < 5) {
      log("Path too short for feature extraction");
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
      log("Not enough valid points after filtering");
      return null;
    }

    const simplifiedPath = simplifyPath(safePath);
    if (simplifiedPath.length < 3) {
      log("Simplified path too short");
      return null;
    }

    const normalizedPath = normalizePath(simplifiedPath);
    if (normalizedPath.length < 3) {
      log("Normalized path too short");
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
      log("Invalid path segments");
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
    logError("Error in extractFeatures:", error);
    return null;
  }
};

export const recognizeSymbol = (
  path: Point[]
): { symbol: string } => {
  // Early return with better validation
  if (!path || !Array.isArray(path) || path.length < 5) {
    log("Path too short or invalid:", path?.length || 0);
    return { symbol: "=" };
  }

  try {
    const features = extractFeatures(path);
    if (!features) {
      log("Failed to extract features");
      return { symbol: "=" };
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

    // Return the best symbol, or "=" if no clear winner
    if (maxScore < 40) {
      return { symbol: "=" };
    }

    return { symbol: recognizedSymbol };
  } catch (error) {
    logError("Recognition error:", error);
    return { symbol: "Error" };
  }
};
