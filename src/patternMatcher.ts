export interface PatternMatch {
  pattern: string;
  confidence: number;
  priority: "HIGH" | "MEDIUM" | "LOW";
  type: "exact" | "regex" | "fuzzy" | "encoded";
  location: string;
  matchedValue: string;
}

export class PatternMatcher {
  private static readonly PATTERN_WEIGHTS = {
    HIGH: 1.0,
    MEDIUM: 0.7,
    LOW: 0.4,
  };

  static matchPatternWithConfidence(
    value: string,
    pattern: string | PatternMatch | PatternMatch[],
    baseConfidence: number = 50
  ): { matched: boolean; confidence: number; matches: PatternMatch[] } {
    if (typeof pattern === "string") {
      const patternMatch: PatternMatch = {
        pattern,
        confidence: baseConfidence,
        priority: "MEDIUM",
        type: "exact",
        location: "",
        matchedValue: "",
      };
      return this.matchSinglePattern(value, patternMatch);
    }

    if (Array.isArray(pattern)) {
      return this.matchMultiplePatterns(value, pattern);
    }
    return this.matchSinglePattern(value, pattern);
  }

  private static matchSinglePattern(
    value: string,
    pattern: PatternMatch
  ): { matched: boolean; confidence: number; matches: PatternMatch[] } {
    const lowerValue = value.toLowerCase();
    const lowerPattern = pattern.pattern.toLowerCase();
    let matched = false;
    let confidence = 0;

    switch (pattern.type) {
      case "exact":
        matched = lowerValue.includes(lowerPattern);
        break;
      case "regex":
        try {
          const regex = new RegExp(pattern.pattern, "i");
          matched = regex.test(value);
        } catch (e) {
          matched = lowerValue.includes(lowerPattern);
        }
        break;
      case "fuzzy":
        matched = this.fuzzyMatch(lowerValue, lowerPattern);
        break;
      case "encoded":
        matched = this.matchEncodedPattern(value, pattern.pattern);
        break;
    }

    if (matched) {
      confidence = pattern.confidence * this.PATTERN_WEIGHTS[pattern.priority];
      return {
        matched: true,
        confidence,
        matches: [{ ...pattern, matchedValue: value }],
      };
    }

    return {
      matched: false,
      confidence: 0,
      matches: [],
    };
  }

  private static matchMultiplePatterns(
    value: string,
    patterns: PatternMatch[]
  ): { matched: boolean; confidence: number; matches: PatternMatch[] } {
    const matches: PatternMatch[] = [];
    let totalConfidence = 0;

    for (const pattern of patterns) {
      const result = this.matchSinglePattern(value, pattern);
      if (result.matched) {
        matches.push(...result.matches);
        totalConfidence += result.confidence;
      }
    }

    totalConfidence = Math.min(totalConfidence, 100);

    return {
      matched: matches.length > 0,
      confidence: totalConfidence,
      matches,
    };
  }

  private static fuzzyMatch(value: string, pattern: string): boolean {
    const cleanValue = value.replace(/[0-9_\-\[\]]/g, "");
    const cleanPattern = pattern.replace(/[0-9_\-\[\]]/g, "");
    if (cleanValue.includes(cleanPattern)) {
      return true;
    }

    const similarity = this.calculateStringSimilarity(cleanValue, cleanPattern);
    return similarity > 0.7;
  }

  private static matchEncodedPattern(value: string, pattern: string): boolean {
    try {
      const base64Pattern = btoa(pattern);
      if (value.includes(base64Pattern)) {
        return true;
      }
    } catch (e) {}

    const hexPattern = pattern
      .split("")
      .map((c) => c.charCodeAt(0).toString(16))
      .join("");
    if (value.includes(hexPattern)) {
      return true;
    }

    const urlEncodedPattern = encodeURIComponent(pattern);
    if (value.includes(urlEncodedPattern)) {
      return true;
    }

    return false;
  }

  private static calculateStringSimilarity(str1: string, str2: string): number {
    const len1 = str1.length;
    const len2 = str2.length;

    if (len1 === 0) return len2 === 0 ? 1 : 0;
    if (len2 === 0) return 0;

    const matrix = Array(len1 + 1)
      .fill(null)
      .map(() => Array(len2 + 1).fill(null));

    for (let i = 0; i <= len1; i++) matrix[i][0] = i;
    for (let j = 0; j <= len2; j++) matrix[0][j] = j;

    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }

    const maxLen = Math.max(len1, len2);
    return (maxLen - matrix[len1][len2]) / maxLen;
  }
}
