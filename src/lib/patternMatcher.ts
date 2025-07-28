import { PatternMatch } from "../types";

export class PatternMatcher {
  private static readonly PATTERN_WEIGHTS = {
    HIGH: 1.0,
    MEDIUM: 0.7,
    LOW: 0.4,
  };

  static matchPatternWithConfidence(
    value: string,
    pattern: string | PatternMatch,
    baseConfidence: number = 50
  ): { matched: boolean; confidence: number; match: PatternMatch } {
    if (typeof pattern === "string") {
      const patternMatch: PatternMatch = {
        pattern,
        confidence: baseConfidence,
        priority: "MEDIUM",
        type: "exact",
        location: "",
        matchedValues: [],
      };
      return this.matchSinglePattern(value, patternMatch);
    }

    return this.matchSinglePattern(value, pattern);
  }

  private static matchSinglePattern(
    value: string,
    pattern: PatternMatch
  ): { matched: boolean; confidence: number; match: PatternMatch } {
    let matched = false;
    let confidence = 0;
    const matchedValues: string[] = [];

    switch (pattern.type) {
      case "exact": {
        const escapedPattern = pattern.pattern.replace(
          /[.*+?^${}()|[\]\\]/g,
          "\\$&"
        );
        const regexPattern: PatternMatch = {
          ...pattern,
          pattern: escapedPattern,
          type: "regex",
        };

        const result = this.matchSinglePattern(value, regexPattern);
        matched = result.matched;
        matchedValues.push(...(result.match?.matchedValues ?? []));
        break;
      }

      case "regex": {
        try {
          const regex = new RegExp(pattern.pattern, "gi");
          let m: RegExpExecArray | null;

          while ((m = regex.exec(value)) !== null) {
            if (m[0].length === 0) {
              regex.lastIndex++;
              continue;
            }
            matchedValues.push(m[0]);
          }

          matched = matchedValues.length > 0;
        } catch {
          const fallbackPattern: PatternMatch = { ...pattern, type: "exact" };
          const fallbackResult = this.matchSinglePattern(
            value,
            fallbackPattern
          );
          matched = fallbackResult.matched;
          matchedValues.push(...(fallbackResult.match?.matchedValues ?? []));
        }
        break;
      }
    }

    if (matched) {
      confidence = pattern.confidence * this.PATTERN_WEIGHTS[pattern.priority];
      return {
        matched: true,
        confidence,
        match: { ...pattern, matchedValues: matchedValues },
      };
    }

    return {
      matched: false,
      confidence: 0,
      match: pattern,
    };
  }
}
