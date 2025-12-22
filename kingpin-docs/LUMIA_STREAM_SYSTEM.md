# Lumia Stream System

## Overview

The Lumia Stream integration provides real-time visual feedback through smart lights during gameplay. When players win jackpots, complete heists, level up, or experience other significant game events, their stream lights react instantly to enhance the viewer experience.

**Connection Method:** Official SDK (`@lumiastream/sdk`)
**Pattern:** Singleton Service
**Communication:** WebSocket (bidirectional, event-driven)

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Network & Security Requirements](#network--security-requirements)
3. [Installation](#installation)
4. [Configuration](#configuration)
5. [Service Architecture](#service-architecture)
6. [Advanced Features](#advanced-features)
7. [SDK Methods](#sdk-methods)
8. [Event Handling](#event-handling)
9. [Rate Limiting & Command Queue](#rate-limiting--command-queue)
10. [Testing](#testing)
11. [Game Event Mapping](#game-event-mapping-pending-approval)
12. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Lumia Stream Setup

1. **Install Lumia Stream** on the streamer's machine
2. **Enable Developers API:**
   - Open Lumia Stream
   - Navigate to **Settings > Advanced**
   - Toggle **Enable Developers API**
3. **Copy API Token:**
   - After enabling, a token will be displayed
   - This token is required for authentication

### Supported Light Brands

Lumia Stream supports 15+ brands including:
- Philips Hue
- LIFX
- Nanoleaf
- Govee
- Elgato Key Light
- Razer Chroma
- And more...

---

## Network & Security Requirements

### Token Security

> ⚠️ **CRITICAL:** Treat your Lumia Developer Token as a root password. It provides full access to physical hardware (lights) and audio systems (TTS).

- **Never commit tokens to version control**
- Store tokens exclusively in `.env` files
- Add `.env` to your `.gitignore`
- Rotate tokens if compromised via Lumia Stream settings

### Network Configuration

| Requirement | Setting | Reason |
|-------------|---------|--------|
| **AP/Client Isolation** | Disabled | Required for PC to communicate with wireless smart lights on the same network |
| **Firewall Port 39231** | Open (TCP inbound) | Required when triggering commands from external machines |
| **VPN Configuration** | Split Tunneling enabled | Prevents local API requests from routing through remote VPN gateway |

### Firewall Rule (Windows Example)

```powershell
# Allow Lumia Stream API access
netsh advfirewall firewall add rule name="Lumia Stream API" dir=in action=allow protocol=tcp localport=39231
```

### Router AP Isolation Check

If lights aren't responding but Lumia Stream shows them as connected:
1. Log into your router admin panel
2. Find Wireless/WiFi settings
3. Look for "AP Isolation", "Client Isolation", or "Wireless Isolation"
4. Ensure this is **Disabled**

---

## Installation

```bash
# From web/ directory
npm install @lumiastream/sdk
```

**Package:** `@lumiastream/sdk`
**Types:** Included (TypeScript native)

---

## Configuration

### Environment Variables

Add to `.env`:

```env
# Lumia Stream API
LUMIA_API_TOKEN=your-token-from-lumia-settings
LUMIA_APP_NAME=kingpin
```

### Environment Variable Documentation

| Variable | Required | Description |
|----------|----------|-------------|
| `LUMIA_API_TOKEN` | Yes | API token from Lumia Stream settings |
| `LUMIA_APP_NAME` | No | App identifier (defaults to "kingpin") |

---

## Service Architecture

### Singleton Pattern

The Lumia service uses a singleton pattern to maintain a single persistent WebSocket connection per application instance.

**File:** `web/src/lib/services/lumia.service.ts`

```typescript
import { LumiaSdk, LumiaAlertValues, LumiaEventTypes } from '@lumiastream/sdk';

export interface LumiaColor {
  r: number;
  g: number;
  b: number;
}

export interface LumiaCommandOptions {
  color?: LumiaColor;
  brightness?: number;
  duration?: number;
  transition?: number;
  lights?: Array<{ type: string; id: string }>;
  hold?: boolean;                                    // Persistent state changes
  extraSettings?: Record<string, string | number>;   // Variable injection for TTS/alerts
}

type QueuedCommand = () => Promise<void>;

class LumiaService {
  private static instance: LumiaService | null = null;
  private sdk: LumiaSdk;
  private initialized = false;
  private connected = false;
  private commandQueue: QueuedCommand[] = [];
  private processing = false;
  private readonly RATE_LIMIT_MS = 100; // 100ms between commands

  // State tracking to prevent API flooding
  private lastCommandValue: string | null = null;

  private constructor() {
    this.sdk = new LumiaSdk();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): LumiaService {
    if (!LumiaService.instance) {
      LumiaService.instance = new LumiaService();
    }
    return LumiaService.instance;
  }

  /**
   * Initialize connection to Lumia Stream
   * Call once at application startup
   */
  async init(): Promise<boolean> {
    if (this.initialized) {
      return this.connected;
    }

    const token = process.env.LUMIA_API_TOKEN;
    if (!token) {
      console.warn('[Lumia] No API token configured. Treat tokens as root passwords - never commit to version control.');
      return false;
    }

    try {
      await this.sdk.init({
        appName: process.env.LUMIA_APP_NAME || 'kingpin',
        token,
      });

      this.setupEventListeners();
      this.initialized = true;
      this.connected = true;
      console.log('[Lumia] Connected. Ensure AP Isolation is OFF and Port 39231 is open if accessing remotely.');
      return true;
    } catch (error) {
      console.error('[Lumia] Connection failed. Check if Lumia Stream is running (ECONNREFUSED indicates app not running).');
      this.initialized = true; // Prevent retry loops
      this.connected = false;
      return false;
    }
  }

  /**
   * Check if Lumia is available
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Setup event listeners for incoming Lumia events
   */
  private setupEventListeners(): void {
    this.sdk.on('event', (data: { type: LumiaEventTypes; origin?: string; data?: unknown }) => {
      switch (data.type) {
        case LumiaEventTypes.STATES:
          console.log('[Lumia] State changed:', data.data);
          break;
        case LumiaEventTypes.CHAT_COMMAND:
          // Chat command triggered in Lumia
          break;
        case LumiaEventTypes.CHAT:
          // Raw chat message
          break;
        case LumiaEventTypes.ALERT:
          // Alert triggered (follow, sub, etc.)
          break;
      }
    });
  }

  /**
   * Process command queue with rate limiting
   */
  private async processQueue(): Promise<void> {
    if (this.processing || this.commandQueue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.commandQueue.length > 0) {
      const command = this.commandQueue.shift();
      if (command) {
        try {
          await command();
        } catch (error) {
          console.error('[Lumia] Command failed:', error);
        }
        // Rate limit: wait between commands
        await new Promise((resolve) => setTimeout(resolve, this.RATE_LIMIT_MS));
      }
    }

    this.processing = false;
  }

  /**
   * Queue a command for execution
   */
  private queueCommand(command: QueuedCommand): void {
    if (!this.connected) {
      return; // Silently skip if not connected
    }
    this.commandQueue.push(command);
    this.processQueue();
  }

  // ─────────────────────────────────────────────────────────────
  // PUBLIC API METHODS
  // ─────────────────────────────────────────────────────────────

  /**
   * Send a predefined command by name
   * Commands are configured in Lumia Stream
   * 
   * @param commandName - The ID of the command in Lumia
   * @param options.hold - If true, state persists until explicitly changed (e.g., "Jail" mode)
   * @param options.extraSettings - Variables to inject into command (e.g., { username: "Player1" })
   */
  async sendCommand(
    commandName: string,
    options?: { hold?: boolean; extraSettings?: Record<string, string | number> }
  ): Promise<void> {
    // Skip duplicate commands unless variables have changed (prevents API flooding)
    if (this.lastCommandValue === commandName && !options?.extraSettings) {
      return;
    }

    this.queueCommand(async () => {
      await this.sdk.sendCommand({
        command: commandName,
        hold: options?.hold,
        extraSettings: options?.extraSettings,
      });
      this.lastCommandValue = commandName;
    });
  }

  /**
   * Set lights to a specific color
   * Includes state tracking to skip redundant color calls
   */
  async sendColor(options: LumiaCommandOptions): Promise<void> {
    if (!options.color) return;

    // Generate unique key for this color state
    const colorKey = `rgb-${options.color.r}-${options.color.g}-${options.color.b}`;

    // Skip redundant color calls to preserve network stability
    if (this.lastCommandValue === colorKey && !options.hold) {
      return;
    }

    this.queueCommand(async () => {
      await this.sdk.sendColor({
        color: options.color!,
        brightness: options.brightness ?? 100,
        duration: options.duration ?? 1000,
        transition: options.transition,
        lights: options.lights,
      });
      this.lastCommandValue = colorKey;
    });
  }

  /**
   * Set brightness without changing color
   */
  async sendBrightness(brightness: number): Promise<void> {
    this.queueCommand(async () => {
      await this.sdk.sendBrightness({ brightness });
    });
  }

  /**
   * Send text-to-speech message
   * Use extraSettings in sendCommand for dynamic TTS with {{variables}}
   */
  async sendTts(text: string): Promise<void> {
    this.queueCommand(async () => {
      await this.sdk.sendTts({ text });
    });
  }

  /**
   * Send message via Lumia chatbot
   */
  async sendChatbot(platform: 'twitch' | 'youtube', text: string): Promise<void> {
    this.queueCommand(async () => {
      await this.sdk.sendChatbot({ platform, text });
    });
  }

  /**
   * Trigger a mock alert (for testing or cross-platform event simulation)
   */
  async sendAlert(alert: LumiaAlertValues): Promise<void> {
    this.queueCommand(async () => {
      await this.sdk.sendAlert({ alert });
    });
  }

  /**
   * Get current Lumia Stream info (lights, state, etc.)
   */
  async getInfo(): Promise<unknown> {
    if (!this.connected) return null;
    return this.sdk.getInfo();
  }

  /**
   * Reset state tracking (useful when intentionally resending same command)
   */
  resetStateTracking(): void {
    this.lastCommandValue = null;
  }

  // ─────────────────────────────────────────────────────────────
  // CONVENIENCE METHODS (Color Presets)
  // ─────────────────────────────────────────────────────────────

  /**
   * Flash a color briefly then return to normal
   */
  async flash(color: LumiaColor, duration = 500): Promise<void> {
    await this.sendColor({ color, duration, brightness: 100 });
  }

  /**
   * Pulse a color (fade in/out effect)
   */
  async pulse(color: LumiaColor, duration = 1000): Promise<void> {
    await this.sendColor({ color, duration, brightness: 100, transition: duration / 2 });
  }

  // Preset colors
  static readonly COLORS = {
    RED: { r: 255, g: 0, b: 0 },
    GREEN: { r: 0, g: 255, b: 0 },
    BLUE: { r: 0, g: 0, b: 255 },
    GOLD: { r: 255, g: 215, b: 0 },
    PURPLE: { r: 128, g: 0, b: 128 },
    CYAN: { r: 0, g: 255, b: 255 },
    ORANGE: { r: 255, g: 165, b: 0 },
    PINK: { r: 255, g: 105, b: 180 },
    WHITE: { r: 255, g: 255, b: 255 },
  } as const;
}

// Export singleton getter
export const getLumiaService = (): LumiaService => LumiaService.getInstance();
export { LumiaService, LumiaAlertValues, LumiaEventTypes };
```

---

## Advanced Features

### Variable Injection (extraSettings)

Lumia commands support dynamic variable injection using `{{variable}}` placeholders. Pass values via the `extraSettings` object.

**Lumia Command Setup:**
In Lumia Stream, create a command with placeholder text:
```
Welcome to Lazarus City, {{username}}! Your bounty is {{amount}} credits.
```

**Code Usage:**
```typescript
const lumia = getLumiaService();

// Inject variables into the command
await lumia.sendCommand('player-welcome', {
  extraSettings: {
    username: 'Player1',
    amount: 5000
  }
});
```

**Supported Variable Types:**
- Strings (player names, messages)
- Numbers (amounts, scores, levels)

### Persistent States (hold)

By default, Lumia effects revert to the previous state after their duration. Use `hold: true` for states that should persist until explicitly changed.

**Use Cases:**
- **Jail Mode:** Red lights remain on until player escapes
- **Emergency Alert:** Flashing effect continues until resolved
- **Faction Territory:** Team colors persist during control

```typescript
// Persistent "Jail" state - lights stay red until changed
await lumia.sendCommand('jail-mode', { hold: true });

// ... later, when player escapes ...
await lumia.sendCommand('default-state'); // Explicitly revert
```

### State Tracking (API Flood Prevention)

The service automatically tracks the last sent command/color and skips duplicate calls. This prevents network congestion and API throttling.

**Behavior:**
- Duplicate `sendCommand('same-name')` calls are ignored
- Duplicate `sendColor({ same RGB values })` calls are ignored
- Commands with new `extraSettings` always execute (even if same command name)
- Use `resetStateTracking()` to force resend

```typescript
const lumia = getLumiaService();

await lumia.sendColor({ color: { r: 255, g: 0, b: 0 } }); // Executes
await lumia.sendColor({ color: { r: 255, g: 0, b: 0 } }); // Skipped (duplicate)
await lumia.sendColor({ color: { r: 0, g: 255, b: 0 } }); // Executes (different color)

// Force resend same command
lumia.resetStateTracking();
await lumia.sendColor({ color: { r: 0, g: 255, b: 0 } }); // Executes
```

---

## SDK Methods

### Available Methods

| Method | Description | Parameters |
|--------|-------------|------------|
| `sendCommand(name, options?)` | Trigger predefined command | Command name + optional `{ hold, extraSettings }` |
| `sendColor(options)` | Set light color | `{ color, brightness, duration, lights, hold }` |
| `sendBrightness(level)` | Adjust brightness | 0-100 |
| `sendTts(text)` | Text-to-speech | Message string |
| `sendChatbot(platform, text)` | Send chat message | Platform + message |
| `sendAlert(type)` | Trigger mock alert | Alert type enum |
| `getInfo()` | Get connected lights info | None |
| `resetStateTracking()` | Clear duplicate prevention cache | None |

### Color Object Format

```typescript
interface LumiaColor {
  r: number; // 0-255
  g: number; // 0-255
  b: number; // 0-255
}
```

### Command Options Interface

```typescript
interface LumiaCommandOptions {
  color?: LumiaColor;
  brightness?: number;           // 0-100, default 100
  duration?: number;             // milliseconds, default 1000
  transition?: number;           // fade time in milliseconds
  lights?: Array<{               // target specific lights
    type: string;
    id: string;
  }>;
  hold?: boolean;                // persist state (don't auto-revert)
  extraSettings?: Record<        // variable injection
    string,
    string | number
  >;
}
```

### Targeting Specific Lights

```typescript
await lumia.sendColor({
  color: { r: 255, g: 0, b: 0 },
  brightness: 100,
  duration: 1000,
  lights: [
    { type: 'hue', id: '1' },
    { type: 'nanoleaf', id: 'panel-1' }
  ]
});
```

---

## Event Handling

### Incoming Event Types

The SDK emits events when actions occur in Lumia Stream:

| Event Type | Description | Use Case |
|------------|-------------|----------|
| `STATES` | App state changed | Monitor connection status |
| `CHAT_COMMAND` | User triggered command | React to viewer interactions |
| `CHAT` | Raw chat message | Chat integration |
| `ALERT` | Platform alert (follow, sub) | Sync with monetization |

### Event Data Structure

```typescript
interface LumiaEvent {
  type: LumiaEventTypes;
  origin?: string;        // Platform origin (twitch, kick, etc.)
  data?: {
    username?: string;
    command?: string;
    // Additional fields vary by event type
  };
}
```

### Cross-Platform Alert Simulation

Use `sendAlert()` to trigger platform-agnostic alert effects:

```typescript
import { LumiaAlertValues } from '@lumiastream/sdk';

// Simulate a subscriber alert (works for Kick donations mapped to sub effects)
await lumia.sendAlert(LumiaAlertValues.TWITCH_SUBSCRIBER);
```

---

## Rate Limiting & Command Queue

### Why Queue Commands?

- Prevents API throttling from Lumia Stream
- Ensures commands execute in order
- Provides graceful degradation when disconnected
- State tracking prevents redundant network calls

### Queue Behavior

1. Commands are added to a FIFO queue
2. Queue processor runs with 100ms delay between commands
3. If disconnected, commands are silently dropped
4. Errors are logged but don't block the queue
5. Duplicate commands are skipped before queuing

### Adjusting Rate Limit

```typescript
// In LumiaService constructor
private readonly RATE_LIMIT_MS = 100; // Adjust as needed
```

**Recommended:** 100ms minimum between commands

---

## Testing

### Mock Server

The SDK includes a test server for development without Lumia Stream:

```bash
# Start mock server
node node_modules/@lumiastream/sdk/test-server.js
```

### Unit Testing with Vitest

```typescript
// web/src/lib/services/__tests__/lumia.service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the SDK
vi.mock('@lumiastream/sdk', () => ({
  LumiaSdk: vi.fn().mockImplementation(() => ({
    init: vi.fn().mockResolvedValue(undefined),
    sendCommand: vi.fn().mockResolvedValue(undefined),
    sendColor: vi.fn().mockResolvedValue(undefined),
    sendBrightness: vi.fn().mockResolvedValue(undefined),
    sendTts: vi.fn().mockResolvedValue(undefined),
    sendChatbot: vi.fn().mockResolvedValue(undefined),
    sendAlert: vi.fn().mockResolvedValue(undefined),
    getInfo: vi.fn().mockResolvedValue({ lights: [] }),
    on: vi.fn(),
  })),
  LumiaAlertValues: {
    TWITCH_FOLLOWER: 'twitch-follower',
    TWITCH_SUBSCRIBER: 'twitch-subscriber',
  },
  LumiaEventTypes: {
    STATES: 'states',
    CHAT_COMMAND: 'chat-command',
    CHAT: 'chat',
    ALERT: 'alert',
  },
}));

describe('LumiaService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset singleton for testing
    // @ts-ignore - accessing private for test reset
    LumiaService.instance = null;
  });

  it('should initialize as singleton', () => {
    const instance1 = getLumiaService();
    const instance2 = getLumiaService();
    expect(instance1).toBe(instance2);
  });

  it('should handle missing token gracefully', async () => {
    delete process.env.LUMIA_API_TOKEN;
    const service = getLumiaService();
    const result = await service.init();
    expect(result).toBe(false);
  });

  it('should queue commands when connected', async () => {
    process.env.LUMIA_API_TOKEN = 'test-token';
    const service = getLumiaService();
    await service.init();

    await service.sendCommand('test');
    // Command should be queued and processed
  });

  it('should skip duplicate commands', async () => {
    process.env.LUMIA_API_TOKEN = 'test-token';
    const service = getLumiaService();
    await service.init();

    await service.sendCommand('same-command');
    await service.sendCommand('same-command');
    // Second call should be skipped due to state tracking
  });

  it('should allow same command with different extraSettings', async () => {
    process.env.LUMIA_API_TOKEN = 'test-token';
    const service = getLumiaService();
    await service.init();

    await service.sendCommand('welcome', { extraSettings: { name: 'Player1' } });
    await service.sendCommand('welcome', { extraSettings: { name: 'Player2' } });
    // Both calls should execute (different variables)
  });
});
```

### Integration Testing

For integration tests against a real Lumia Stream instance:

```typescript
// Only run if LUMIA_API_TOKEN is set
const runIntegration = process.env.LUMIA_API_TOKEN && process.env.TEST_LUMIA;

describe.skipIf(!runIntegration)('Lumia Integration', () => {
  it('should connect and send color', async () => {
    const service = getLumiaService();
    await service.init();

    expect(service.isConnected()).toBe(true);

    await service.flash(LumiaService.COLORS.GREEN, 500);
  });
});
```

---

## Game Event Mapping (Pending Approval)

> **Note:** The following mappings are proposals and require approval before implementation. This section will be updated once specific game events are approved for Lumia integration.

### Proposed Event Categories

| Category | Example Events | Proposed Effect | Hold State? |
|----------|----------------|-----------------|-------------|
| **Wins** | Jackpot, Gambling Win | Gold/Green flash | No |
| **Losses** | Bust, Robbery Victim | Red flash | No |
| **Progression** | Level Up, Achievement | Rainbow/Purple cycle | No |
| **Social** | Heist Start, Faction War | Team color pulse | No |
| **Monetization** | Sub, Donation, Bits | Custom celebration | No |
| **Status Effects** | Jail, Wanted, Combat | Theme color | **Yes** |

### Implementation Pattern (Once Approved)

```typescript
// Example: Integrating with play.service.ts
import { getLumiaService, LumiaService } from './lumia.service';

// After a jackpot win (with TTS announcement)
const lumia = getLumiaService();
await lumia.flash(LumiaService.COLORS.GOLD, 2000);
await lumia.sendCommand('jackpot-announce', {
  extraSettings: {
    username: player.name,
    amount: winAmount
  }
});

// Player enters jail (persistent state)
await lumia.sendCommand('jail-mode', { hold: true });

// Player escapes jail
await lumia.sendCommand('default-lights');
```

### Pending Decisions

- [ ] Which game events should trigger Lumia effects?
- [ ] Should effects be configurable per-user?
- [ ] TTS voice for announcements?
- [ ] Duration/intensity of effects?
- [ ] Should negative events (busts) trigger effects?
- [ ] Which events need persistent `hold` states?

---

## Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| **ECONNREFUSED** | Lumia Stream not running | Start Lumia Stream application first |
| **Connection fails** | API not enabled | Settings > Advanced > Enable Developers API |
| **401 Unauthorized** | Invalid or regenerated token | Copy fresh token from Lumia settings; tokens invalidate when regenerated in app |
| **Status 200 (No Action)** | Command name doesn't exist | JSON is valid but the command name isn't in Lumia. Use `/api/retrieve` endpoint to verify exact spelling |
| **Commands ignored** | State tracking skipping duplicates | Call `resetStateTracking()` or pass different `extraSettings` |
| **Rate limited** | Too many rapid commands | Increase `RATE_LIMIT_MS` (minimum 100ms recommended) |
| **No lights respond** | Lights not configured | Configure lights in Lumia Stream app |
| **Lights not reachable** | AP Isolation enabled | Disable AP/Client Isolation in router settings |
| **Remote triggers fail** | Firewall blocking | Open Port 39231 for inbound TCP |
| **VPN interference** | Local traffic routed externally | Enable split tunneling for local network |
| **Malformed JSON error** | Incorrect parameter structure | Ensure values like `command` are nested inside `params` object |

### Error Response Patterns

```typescript
// 401 - Token invalid
{ error: 'Unauthorized', message: 'Token has been regenerated' }

// 200 with no effect - Command not found
{ success: true, executed: false } // Command name doesn't match any in Lumia

// ECONNREFUSED - App not running
Error: connect ECONNREFUSED 127.0.0.1:39231
```

### Debug Logging

Enable verbose logging:

```typescript
// Temporary debug in lumia.service.ts
private queueCommand(command: QueuedCommand): void {
  console.log('[Lumia] Queuing command, queue size:', this.commandQueue.length);
  console.log('[Lumia] Last command value:', this.lastCommandValue);
  // ...
}
```

### Validate Command Names

Use the Lumia retrieve endpoint to verify command names exist:

```bash
curl http://localhost:39231/api/retrieve
```

### Connection Health Check

```typescript
// Check connection status
const lumia = getLumiaService();
if (!lumia.isConnected()) {
  console.warn('Lumia not available - effects disabled');
}
```

---

## Integration Points

### Where to Initialize

**Web App (Next.js):** Initialize in API route or server action that handles game events.

```typescript
// web/src/app/api/play/route.ts
import { getLumiaService } from '@/lib/services/lumia.service';

// Initialize once (lazy, on first game event)
const lumia = getLumiaService();
await lumia.init();
```

**Bot (Node.js Worker):** Initialize on bot startup.

```typescript
// bot/src/index.ts
import { getLumiaService } from '../lib/services/lumia.service';

async function startBot() {
  const lumia = getLumiaService();
  await lumia.init();
  // Bot startup continues...
}
```

### Graceful Degradation

The Lumia service is designed to fail silently:

- No token configured: Service disabled, no errors
- Connection failed: Commands silently dropped
- Command errors: Logged but don't affect game logic
- Duplicate commands: Skipped via state tracking

This ensures game functionality is never blocked by Lumia issues.

---

## Related Documentation

- [Lumia Stream Developer Docs](https://dev.lumiastream.com/)
- [@lumiastream/sdk on npm](https://www.npmjs.com/package/@lumiastream/sdk)
- [Lumia-SDK-JS GitHub](https://github.com/lumiastream/Lumia-SDK-JS)
- [Juicernaut System](./JUICERNAUT_SYSTEM.md) - Streamer events integration
- [Communication System](./COMMUNICATION_SYSTEM.md) - Chat integration

---

*Document Version: 1.1*
*Last Updated: December 21, 2024*
*Changelog: Added Network & Security Requirements, Variable Injection, Persistent States, State Tracking, enhanced Troubleshooting*
