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

const calculateAngle = (p1: Point, p2: Point): number => {
  return (Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180) / Math.PI;
};

export const calculateCurvature = (path: Point[]): number => {
  if (path.length < 3) return 0;

  let totalAngleChange = 0;

  for (let i = 1; i < path.length - 1; i++) {
    const angle1 = calculateAngle(path[i - 1], path[i]);
    const angle2 = calculateAngle(path[i], path[i + 1]);

    let angleDiff = Math.abs(angle2 - angle1);
    if (angleDiff > 180) angleDiff = 360 - angleDiff;

    totalAngleChange += angleDiff;
  }

  return totalAngleChange / (path.length - 2);
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
  if (path.length < 5) return null;

  const simplifiedPath = simplifyPath(path);
  const normalizedPath = normalizePath(simplifiedPath);

  if (normalizedPath.length < 3) return null;

  const firstThird = normalizedPath.slice(0, Math.floor(normalizedPath.length / 3));
  const middleThird = normalizedPath.slice(
    Math.floor(normalizedPath.length / 3),
    Math.floor((2 * normalizedPath.length) / 3)
  );
  const lastThird = normalizedPath.slice(Math.floor((2 * normalizedPath.length) / 3));

  const firstDirection = lastThird[0].x - firstThird[0].x > 0 ? "right" : "left";

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
};

export const recognizeSymbol = (path: Point[]): { symbol: string; confidence: number } => {
  if (path.length < 5) {
    return { symbol: "=", confidence: 0 };
  }

  const features = extractFeatures(path);
  if (!features) return { symbol: "=", confidence: 0 };

  let scores = {
    ">": 0,
    "<": 0,
  };

  if (features.aspectRatio > 0.5 && features.aspectRatio < 2.0) {
    const firstPoint = features.normalizedPath[0];
    const midPoint = features.normalizedPath[Math.floor(features.normalizedPath.length / 2)];
    const lastPoint = features.normalizedPath[features.normalizedPath.length - 1];

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
}; 