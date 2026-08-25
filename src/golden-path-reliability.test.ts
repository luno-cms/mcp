import { describe, expect, it } from "vitest";
import {
  buildGoldenPathReliabilityReport,
  evaluateGoldenPathReliability,
  readReliabilityThresholdsFromEnv,
} from "./golden-path-reliability.js";

describe("golden-path-reliability", () => {
  it("passes when success and zero errors", () => {
    const out = evaluateGoldenPathReliability({
      metrics: {
        toolCalls: 11,
        uniqueTools: 9,
        errors: 0,
        validationErrors: 0,
        durationMs: 12_800,
        success: true,
      },
      toolCallSequence: ["create_entry"],
      thresholds: {
        maxErrors: 0,
        maxValidationErrors: 0,
        requireSuccess: true,
      },
    });
    expect(out.passed).toBe(true);
    expect(out.failureReasons).toEqual([]);
  });

  it("fails on errors or task failure", () => {
    const failed = evaluateGoldenPathReliability({
      metrics: {
        toolCalls: 142,
        uniqueTools: 20,
        errors: 2,
        validationErrors: 2,
        durationMs: 1000,
        success: false,
      },
      toolCallSequence: [],
      thresholds: readReliabilityThresholdsFromEnv({}),
    });
    expect(failed.passed).toBe(false);
    expect(failed.failureReasons.length).toBeGreaterThan(0);
  });

  it("emits soft warning for high tool-call count without failing", () => {
    const out = evaluateGoldenPathReliability({
      metrics: {
        toolCalls: 20,
        uniqueTools: 10,
        errors: 0,
        validationErrors: 0,
        durationMs: 1000,
        success: true,
      },
      toolCallSequence: [],
      thresholds: {
        maxErrors: 0,
        maxValidationErrors: 0,
        requireSuccess: true,
        maxToolCallsWarning: 15,
      },
    });
    expect(out.passed).toBe(true);
    expect(out.warnings.some((w) => w.includes("tool_calls"))).toBe(true);
  });

  it("builds schemaVersion 1 report", () => {
    const report = buildGoldenPathReliabilityReport({
      runAt: "2026-08-25T00:00:00.000Z",
      environment: {
        apiUrl: "https://stg-api.luno.rest/admin",
        mcpVersion: "0.2.31",
        nodeVersion: "v22.0.0",
        templateSlug: "blog",
      },
      metrics: {
        toolCalls: 11,
        uniqueTools: 9,
        errors: 0,
        validationErrors: 0,
        durationMs: 1000,
        success: true,
      },
      toolCallSequence: ["create_entry"],
      thresholds: readReliabilityThresholdsFromEnv({}),
    });
    expect(report.schemaVersion).toBe(1);
    expect(report.passed).toBe(true);
  });
});
