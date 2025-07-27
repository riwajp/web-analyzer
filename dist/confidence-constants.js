"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DETECTION_TYPE_PRIORITY = exports.DETECTION_TYPE_CONFIDENCE = exports.getConfidenceLevel = exports.TECH_DETECTION_MODE_CONFIDENCE = exports.CONFIDENCE_THRESHOLDS = void 0;
// global confidence threshold levels
exports.CONFIDENCE_THRESHOLDS = {
    HIGH: 80,
    MEDIUM: 60,
    LOW: 40,
};
// confidence levels for technology detection mode
exports.TECH_DETECTION_MODE_CONFIDENCE = {
    STRICT: exports.CONFIDENCE_THRESHOLDS.HIGH,
    NORMAL: exports.CONFIDENCE_THRESHOLDS.MEDIUM,
    LOOSE: exports.CONFIDENCE_THRESHOLDS.LOW,
};
// get confidence level string from numerical value
const getConfidenceLevel = (confidence) => {
    if (confidence >= exports.CONFIDENCE_THRESHOLDS.HIGH)
        return "HIGH";
    if (confidence >= exports.CONFIDENCE_THRESHOLDS.MEDIUM)
        return "MEDIUM";
    if (confidence >= exports.CONFIDENCE_THRESHOLDS.LOW)
        return "LOW";
    return "NONE";
};
exports.getConfidenceLevel = getConfidenceLevel;
// default confidence levels for different types of detection (needed to calculate technology's overall confidence)
exports.DETECTION_TYPE_CONFIDENCE = {
    js: 60,
    scriptSrc: 70,
    headers: 80,
    cookies: 85,
    meta: 50,
    dom: 65,
    html: 45,
};
// default priority levels for different types of detection
exports.DETECTION_TYPE_PRIORITY = {
    cookies: "HIGH",
    headers: "HIGH",
    scriptSrc: "MEDIUM",
    js: "MEDIUM",
    meta: "LOW",
    dom: "MEDIUM",
    html: "MEDIUM",
};
