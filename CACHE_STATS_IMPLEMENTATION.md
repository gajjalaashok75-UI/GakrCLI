# Cache Stats Implementation Summary

This document summarizes the implementation of the cache metrics feature across the codebase.

## Overview

The cache stats feature provides per-turn and session-wide cache hit/miss statistics for all API providers. It normalizes cache metrics from different provider formats (Anthropic, OpenAI, Kimi, DeepSeek, Gemini) into a unified format and displays them in the REPL and via the `/cache-stats` command.

## Files Created

### Core Implementation

1. **src/services/api/cacheMetrics.ts**
   - Cross-provider cache usage normalizer
   - Extracts cache metrics from raw provider usage
   - Converts to Anthropic-shaped usage
   - Formats cache metrics for display (compact and full modes)
   - Resolves cache provider from API provider

2. **src/services/api/cacheStatsTracker.ts**
   - Per-query and per-session cache metrics tracker
   - Maintains three buckets: currentTurn, session, and history
   - Uses ring buffer for bounded history (500 entries max)
   - Provides functions to record, reset, and retrieve metrics

3. **src/commands/cacheStats/cacheStats.ts**
   - Implementation of `/cache-stats` command
   - Displays current turn, session total, and recent request breakdown
   - Shows up to 20 most recent requests with timestamps

4. **src/commands/cacheStats/index.ts**
   - Command registration for `/cache-stats`
   - Lazy-loaded for minimal startup impact

### Tests

5. **src/services/api/cacheMetrics.test.ts**
   - Unit tests for cache metrics extraction and formatting
   - Tests all provider shapes (Anthropic, OpenAI, Kimi, DeepSeek, Gemini)
   - Tests provider resolution logic

6. **src/services/api/cacheStatsTracker.test.ts**
   - Unit tests for cache stats tracker
   - Tests aggregation, history management, and ring buffer semantics
   - Tests turn/session reset behavior

7. **src/commands/cacheStats/cacheStats.test.ts**
   - Tests for `/cache-stats` command rendering
   - Tests empty session, supported/unsupported providers, row capping
   - Tests timestamp and label formatting

8. **src/cost-tracker.cacheIntegration.test.ts**
   - Integration tests for cost-tracker → cacheStatsTracker wiring
   - Verifies that cache metrics are recorded on every API call
   - Tests that resetCostState also clears cache stats

9. **src/utils/config.showCacheStats.test.ts**
   - Tests for showCacheStats configuration
   - Validates Zod schema and default values
   - Tests config merging for legacy configs

## Files Modified

### Configuration

10. **src/utils/config.ts**
    - Added `showCacheStats` field to GlobalConfig type
    - Added `SHOW_CACHE_STATS_MODES` constant: `['off', 'compact', 'full']`
    - Set default value to `'compact'` in `createDefaultGlobalConfig()`
    - Added `'showCacheStats'` to `GLOBAL_CONFIG_KEYS` array

11. **src/tools/ConfigTool/supportedSettings.ts**
    - Added `showCacheStats` setting configuration
    - Type: `'string'` with options `['off', 'compact', 'full']`
    - Description: "Show cache hit/miss stats after each turn"

### Core Integration

12. **src/cost-tracker.ts**
    - Added imports for cache metrics and tracker
    - Updated `addToTotalSessionCost()` to record cache metrics
    - Wrapped `resetCostState()` to also clear cache stats
    - Resolves provider and extracts metrics on every API call

13. **src/commands.ts**
    - Added import for `cacheStats` command
    - Registered `cacheStats` in the `COMMANDS` array

14. **src/screens/REPL.tsx**
    - Added imports for cache metrics formatting and tracker
    - Added cache stats display logic after turn duration message
    - Respects `showCacheStats` config setting ('off', 'compact', 'full')
    - Calls `resetCurrentTurn()` unconditionally after each turn

## Feature Behavior

### Display Modes

- **off**: No cache stats displayed
- **compact**: One-liner format: `[Cache: 1.2k read • hit 60%]`
- **full**: Detailed format: `[Cache: read=1.2k created=340 hit=60%]`

### Provider Support

- **Supported**: Anthropic, OpenAI, Codex, Kimi/Moonshot, DeepSeek, Gemini
- **Unsupported**: GitHub Copilot (vanilla), Ollama, self-hosted endpoints without cache fields
- **Self-hosted**: Detected via private IP ranges, reserved TLDs (.local, .internal, etc.)

### Cache Metrics

- **read**: Tokens served from cache
- **created**: Tokens written to cache (Anthropic only)
- **total**: Total input tokens (fresh + read + created)
- **hitRate**: read / total (null when total is 0)
- **supported**: Whether the provider exposes cache data

### /cache-stats Command

Shows:
- Current turn aggregate
- Session total aggregate
- Recent requests (up to 20, with timestamps and model labels)
- Footnote for unsupported providers (N/A rows)

## Integration Points

1. **Cost Tracking**: Cache metrics are recorded alongside cost tracking in `addToTotalSessionCost()`
2. **REPL Display**: Cache stats line appears after turn duration message (if enabled)
3. **Config System**: Controlled via `/config showCacheStats` setting
4. **Command System**: `/cache-stats` command for detailed breakdown

## Testing

All tests use Bun test framework:
- Unit tests for each module
- Integration tests for cost-tracker wiring
- Command rendering tests with snapshot validation
- Config validation tests

## Design Decisions

1. **Ring Buffer**: History uses fixed-size ring buffer (500 entries) for O(1) insertion
2. **Provider Resolution**: Separate from extraction to avoid re-running env detection
3. **Honest N/A**: Unsupported providers show "N/A" instead of fabricated 0%
4. **Defensive Defaults**: Config fallback to 'compact' if undefined
5. **Unconditional Reset**: Turn counters reset even on user abort to prevent leakage

## Future Enhancements

Potential improvements not included in this implementation:
- Cache stats in `/cost` command output
- Export cache stats with session transcripts
- Cache hit rate trends over time
- Per-model cache statistics breakdown
- Integration with analytics/telemetry
