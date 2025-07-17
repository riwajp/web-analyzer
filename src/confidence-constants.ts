export const CONFIDENCE_THRESHOLDS = {
  HIGH: 80,
  MEDIUM: 60,
  LOW: 40,
};

export const TECH_DETECTION_MODE_CONFIDENCE = {
  STRICT: CONFIDENCE_THRESHOLDS.HIGH,
  NORMAL: CONFIDENCE_THRESHOLDS.MEDIUM,
  LOOSE: CONFIDENCE_THRESHOLDS.LOW,
};

export const getConfidenceLevel = (
  confidence: number
): "HIGH" | "MEDIUM" | "LOW" | "NONE" => {
  if (confidence >= CONFIDENCE_THRESHOLDS.HIGH) return "HIGH";
  if (confidence >= CONFIDENCE_THRESHOLDS.MEDIUM) return "MEDIUM";
  if (confidence >= CONFIDENCE_THRESHOLDS.LOW) return "LOW";
  return "NONE";
};

export const DETECTION_TYPE_CONFIDENCE: Record<string, number> = {
  js: 60,
  scriptSrc: 70,
  headers: 80,
  cookies: 85,
  meta: 50,
  dom: 65,
  html: 40,
};

export const DETECTION_TYPE_PRIORITY: Record<
  string,
  "HIGH" | "MEDIUM" | "LOW"
> = {
  cookies: "HIGH",
  headers: "HIGH",
  scriptSrc: "MEDIUM",
  js: "MEDIUM",
  meta: "LOW",
  dom: "MEDIUM",
  html: "MEDIUM",
};
