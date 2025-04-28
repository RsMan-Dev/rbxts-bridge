# @rbxts/bridge

[![npm version](https://img.shields.io/npm/v/@rbxts/bridge)](https://www.npmjs.com/package/@rbxts/bridge)
[![GitHub license](https://img.shields.io/github/license/RsMan-Dev/rbxts-bridge)](https://github.com/RsMan-Dev/rbxts-bridge/blob/main/LICENSE)

A TypeScript library for Roblox that provides a simple and type-safe way to communicate between server and client using events and functions. It uses RemoteEvent and RemoteFunction under the hood to handle the communication.
This lib aims to have one single interface for both server and client, so you can use it in both places without any extra code.

> ℹ️ Note: Feel free to take a look at the code, jsdoc has more information about the functions usages and types.

## Table of Contents

- [Installation](#installation)
- [Features](#features)
- [API Reference](#api-reference)
  - [Events](#➤-events)
  - [Functions](#➤-functions)
  - [Sync](#➤-sync)
- [License](#license)
- [Contributing](#contributing)

## Installation

Currently available through GitHub:

```bash
npm install @rbxts/bridge@github:RsMan-Dev/rbxts-bridge
```

> Note: NPM package coming soon!

## Features

### Event System
Provides a simple way to send and receive events between server and client with type safety.

### Function Calls
Allows calling functions on the other side (server/client) with proper type checking and async support.

### Data Synchronization
Includes a robust sync system for keeping data in sync between server and client with version control and conflict resolution.

## API Reference

### ➤ Events

Register and handle events between server and client.

```typescript
import { bridge } from "@rbxts/bridge";

// Define your event types
declare global {
  interface BridgeEventMap {
    playerJoined: { name: string };
    playerLeft: { name: string };
  }
}

// Server side
bridge.on("playerJoined", (data, player) => {
  print(`${player.Name} joined with data:`, data);
});
// Broadcast to all clients (server only)
bridge.broadcast("playerLeft", { name: "Player1" });

// Client side
bridge.send("playerJoined", { name: "Player1" });
bridge.on("playerLeft", (data, localPlayer) => {
  print(`a player left with data:`, data);
});

```
<hr>

### ➤ Functions

Call functions on the other side with type safety.

```typescript
import { bridge } from "@rbxts/bridge";

// Define your function types
declare global {
  interface BridgeFunctionMap {
    getPlayerData: [{ playerId: number }, { coins: number, level: number }];
  }
}

// Server side
bridge.fn("getPlayerData", (data, player) => {
  return { coins: 100, level: 5 };
});

// Client side
const result = bridge.call("getPlayerData", { playerId: 123 });
// Async version
const result = await bridge.callAsync("getPlayerData", { playerId: 123 });
```
<hr>

### ➤ Sync

Keep data in sync between server and client with version control.

```typescript
import { bridge } from "@rbxts/bridge";

// Create a sync context
const playerData = bridge.sync("playerData", {
  coins: 0,
  level: 1
});

// Server side
const context = playerData();
context.patch(data => (data.coins += 100, data));

// Client side
const context = playerData();
context.onUpdated(ctx => {
  print("Data updated:", ctx.data);
});
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.
