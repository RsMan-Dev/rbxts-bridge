import { RunService, ReplicatedStorage, Players } from "@rbxts/services";
import { setTimeout, clearTimeout, Object } from "@rbxts/jsnatives";

declare global {
  interface BridgeEventMap {
    [key: string]: unknown;
  }
  type BridgeFunction<T = unknown, R = unknown> = [T, R];
  interface BridgeFunctionMap {
    [key: string]: BridgeFunction;
  }
}


// -- TYPES --
interface JsonMessage<T = unknown> { type: string; data: T, ignoreUnset?: boolean; }

export type EventCallback<T = unknown> = (data: T, player: Player) => void;
export type FunctionCallback<T = unknown, R = unknown> = (data: T, player: Player) => R;

// -- INSTANCES --
const EVENT_NAME = "BridgeEvent", FUNCTION_NAME = "BridgeFunction";

let remoteEvent = ReplicatedStorage.FindFirstChild(EVENT_NAME) as RemoteEvent;
if (!remoteEvent) {
  remoteEvent = new Instance("RemoteEvent", ReplicatedStorage);
  remoteEvent.Name = EVENT_NAME;
}

let remoteFunction = ReplicatedStorage.FindFirstChild(FUNCTION_NAME) as RemoteFunction;
if (!remoteFunction) {
  remoteFunction = new Instance("RemoteFunction", ReplicatedStorage);
  remoteFunction.Name = FUNCTION_NAME;
}

// -- STORAGE --
const eventHandlers = new Map<string, Set<EventCallback>>();
const functionHandlers = new Map<string, FunctionCallback>();

function unwrapMsg(msg: unknown): JsonMessage | undefined {
  if (typeIs(msg, "table") && typeIs((msg as Record<string, unknown>).type, "string")) {
    return msg as JsonMessage;
  }
}

function makeDiffSerializable(data: unknown) { // as a symbol reference cannot be serialized, we need to replace it with a string that can be serialized back to the original symbol
  if (typeIs(data, "table")) {
    const dataTable = data as Record<string, unknown>;
    for(const key of Object.keys(dataTable))
      if(dataTable[key] === Object.diffDeletedSymbol) dataTable[key] = "$$DELETED$$";
      else if(typeIs(dataTable[key], "table")) dataTable[key] = makeDiffSerializable(dataTable[key]);
    return dataTable;
  }
  return data;
}

function makeSerializedDiffUsable(data: unknown) { // as a string cannot be serialized back to the original symbol, we need to replace it with the original symbol
  if (typeIs(data, "table")) {
    const dataTable = data as Record<string, unknown>;
    for(const key of Object.keys(dataTable)) 
      if(dataTable[key] === "$$DELETED$$") dataTable[key] = Object.diffDeletedSymbol;
      else if(typeIs(dataTable[key], "table")) dataTable[key] = makeSerializedDiffUsable(dataTable[key]);
    return dataTable;
  }
  return data;
}
// -- CONNECT EVENTS --
if (RunService.IsServer()) {
  remoteEvent.OnServerEvent.Connect((player, JsonMessage) => {
    const msg = unwrapMsg(JsonMessage);
    if (msg === undefined) return;
    if (!eventHandlers.has(msg.type)) return msg.ignoreUnset !== true ? warn(`[BRIDGE] No event registered for ${msg.type} on server`) : undefined;
    eventHandlers.get(msg.type)!.forEach((cb) => cb(msg.data, player));
  });

  remoteFunction.OnServerInvoke = (player, JsonMessage) => {
    const msg = unwrapMsg(JsonMessage);
    if (msg === undefined) return;
    if (!functionHandlers.has(msg.type)) return msg.ignoreUnset !== true ? warn(`[BRIDGE] No function registered for ${msg.type} on server`) : undefined;
    return functionHandlers.get(msg.type)!(msg.data, player);
  };
} else {
  const player = Players.LocalPlayer;
  remoteEvent.OnClientEvent.Connect((jsonMessage) => {
    const msg = unwrapMsg(jsonMessage);
    if (msg === undefined) return;
    if (!eventHandlers.has(msg.type)) return msg.ignoreUnset !== true ? warn(`[BRIDGE] No event registered for ${msg.type} on client`) : undefined;
    eventHandlers.get(msg.type)!.forEach((cb) => cb(msg.data, player));
  });

  remoteFunction.OnClientInvoke = jsonMessage => {
    const msg = unwrapMsg(jsonMessage);
    if (msg === undefined) return;
    if (!functionHandlers.has(msg.type)) return msg.ignoreUnset !== true ? warn(`[BRIDGE] No function registered for ${msg.type} on client`) : undefined;
    return functionHandlers.get(msg.type)!(msg.data, player);
  }
}

export type SyncContext<T = unknown> = {
  data: T,
  patch: (patcher: (data: T) => T) => void,
  onUpdated: (callback: (ctx: SyncContext<T>) => void) => () => void,
  version: number,  // Current data version 
  lastSyncedVersion: number,  // Version of last successful sync
  player: Player,
  destroy: () => void,
};
export type SyncConstructor<T = unknown> = (player?: Player) => SyncContext<T>;
const syncs = new Map<string, SyncConstructor>();

function throttle<T extends unknown[]>(callback: (...args: T) => void, delay?: number) {
  if (delay === undefined || delay === 0) return [callback, () => { }] as [(...args: T) => void, () => void];
  let lastArgs: T | undefined = undefined, timeout: symbol | undefined = undefined;
  return [(...args: T) => {
    if (timeout) return lastArgs = args;
    lastArgs = undefined;
    callback(...args);
    timeout = setTimeout(() => {
      if (lastArgs) callback(...lastArgs);
      timeout = undefined;
    }, delay);
  }, () => {
    if (timeout) clearTimeout(timeout);
    timeout = undefined;
  }] as [(...args: T) => void, () => void]
}

/**
 * # Bridge
 * Bridge is a simple way to communicate between server and client using events and functions.
 * It uses RemoteEvent and RemoteFunction to send data between server and client.
 * Look at each function for more details.
 */
const bridge = {
  /**
   * # Bridge.on
   * Bridge.on is used to register an event handler for a specific event.
   * The callback will be called with the data sent by the event and the player that triggered it (if on server), or local player (if on client).
   * 
   * To type the data sent by the event, you can use the BridgeEventMap interface, like:
   * ```ts
   * declare global {
   *  interface BridgeEventMap {
   *    myEvent: { myData: string };
   *  }
   * }
   * ```
   * Then you can use the event like this:
   * ```ts
   * // Client side
   * bridge.on("myEvent", (data, player) => {
   *   print("Server sent data: ", data, " local player: ", player.Name);
   * });
   * 
   * // Server side
   * bridge.on("myEvent", (data, player) => {
   *   print("Client sent data: ", data, " from player: ", player.Name);
   * });
   * ```
   * @param event The name of the event to register.
   * @param callback The callback to call when the event is triggered.
   */
  on: ((event: string, callback: EventCallback) => {
    let set = eventHandlers.get(event);
    if (!set) eventHandlers.set(event, new Set<EventCallback>([callback]));
    else set.add(callback);
  }) as {
    <T extends keyof BridgeEventMap>(event: T, callback: EventCallback<BridgeEventMap[T]>): void,
    <T extends string>(event: T, callback: EventCallback): void,
  },

  /**
   * # Bridge.off
   * Bridge.off is used to unregister an event handler for a specific event.  
   * Pass the same function as used in Bridge.on to unregister it.
   * 
   * Removing the event is done like this:
   * ```ts
   * const event = (data: BridgeEventMap["myEvent"]) => print("Server sent data: ", data);
   * bridge.on("myEvent", event);
   * 
   * // Later in the code, you can unregister the event
   * bridge.off("myEvent", event);
   * ```
   * @param event The name of the event to unregister.
   * @param callback The callback to unregister.
   */
  off(event: string, callback: EventCallback) {
    const set = eventHandlers.get(event);
    if (!set) return;
    set.delete(callback);
    if (set.size() === 0) eventHandlers.delete(event);
  },

  /**
   * # Bridge.send
   * Bridge.send is used to send an event to the server or client.  
   * If on server, you need to pass the player to send the event to.  
   * If on client, the event will be sent to the server.
   * 
   * To type the data sent by the event, you can use the BridgeEventMap interface, like:
   * ```ts
   * declare global {
   *  interface BridgeEventMap {
   *   hello: { myData: string };
   *   helloback: { myData: string };
   *  }
   * }
   * ```
   * Then you can send the event like this:
   * ```ts
   * // Client side
   * bridge.on("helloback", (data, player) => print("Server sent hello back with a present:", data, " local player: ", player.Name));
   * bridge.send("hello", { myData: "Hello from client" });
   * 
   * // Server side
   * bridge.on("hello", (data, player) => {
   *   print("Client sent hello with data: ", data, " from player: ", player.Name);
   *   bridge.send("helloback", { myData: "Hello from server" }, player);
   * });
   * ```
   * @param event The name of the event to send.
   * @param data The data to send with the event.
   * @param player The player to send the event to. Only used on server, giving it on client will do nothing.
   * @param ignoreUnset If true, if the other side doesn't have the event registered, it will not warn in the console.
   */
  send: ((event: string, data: unknown, player?: Player, ignoreUnset?: boolean) => {
    const msg: JsonMessage = { type: event, data, ignoreUnset };
    if (RunService.IsServer()) {
      if (player === undefined) throw "[BRIDGE] send: sending an event on server requires a player";
      remoteEvent.FireClient(player, msg);
    } else remoteEvent.FireServer(msg);
  }) as {
    <T extends keyof BridgeEventMap>(event: T, data: BridgeEventMap[T], player?: Player, ignoreUnset?: boolean): void,
    <T extends string>(event: T, data: unknown, player?: Player, ignoreUnset?: boolean): void,
  },

  /**
   * # Bridge.broadcast
   * Bridge.broadcast is used to send an event to all clients that are connected to the server and have the event registered.  
   * Used mostly to sync global data such as leaderboards or game state.
   * 
   * To type the data sent by the event, you can use the BridgeEventMap interface, like:
   * ```ts
   * declare global {
   *  interface BridgeEventMap {
   *   broadcasted: { myData: string };
   *  }
   * }
   * ```
   * Then you can broadcast the event like this:
   * ```ts
   * // Client side
   * bridge.on("broadcasted", (data) => print("Server sent broadcasted data: ", data));
   * 
   * // Server side
   * bridge.broadcast("broadcasted", { myData: "Hello from server" });
   *```
   * 
   * @param event 
   * @param data 
   */
  broadcast(event: string, data: unknown) {
    if (!RunService.IsServer()) throw "[BRIDGE] broadcast: only usable on server";
    const msg: JsonMessage = { type: event, data, ignoreUnset: true };
    remoteEvent.FireAllClients(msg);
  },

  /**
   * # Bridge.fn
   * Bridge.fn is used to register a function handler for a specific function.  
   * The callback will be called with the data sent by the function and the player that triggered it (if on server), or local player (if on client).  
   * **Note: A function can only be registered once on every scope (server or client), if you try to register it again, it will throw an error.**
   * 
   * To type the data sent by the function, you can use the BridgeFunctionMap interface, like:
   * ```ts
   * declare global {
   *  interface BridgeFunctionMap {
   *    myFunction: BridgeFunction<{ myData: string }, { myResult: number }>;
   *  }
   * }
   * ```
   * Then you can use the function like this:
   * ```ts
   * // Client side
   * bridge.fn("myFunction", (data, player) => {
   *  print("Server sent data: ", data, " local player: ", player.Name);
   *  return { myResult: 42 };
   * });
   * 
   * // Server side
   * bridge.fn("myFunction", (data, player) => {
   *  print("Client sent data: ", data, " from player: ", player.Name);
   *  return { myResult: 42 };
   * });
   * ```
   * @param name The name of the function to register.
   * @param callback The callback to call when the function is called.
   */
  fn: ((name: string, callback: FunctionCallback) => {
    if (functionHandlers.has(name)) throw `[BRIDGE] fn: function ${name} already registered`;
    functionHandlers.set(name, callback);
  }) as {
    <T extends keyof BridgeFunctionMap>(name: T, callback: FunctionCallback<BridgeFunctionMap[T][0], BridgeFunctionMap[T][1]>): void,
    <T extends string>(name: T, callback: FunctionCallback): void,
  },

  /**
   * # Bridge.fnOff
   * Bridge.fnOff is used to unregister a function handler for a specific function.
   * 
   * @param name The name of the function to unregister.
   */
  fnOff: (name: string) => {
    if (functionHandlers.has(name)) functionHandlers.delete(name);
  },

  /**
   * # Bridge.call
   * Bridge.call is used to call a function on the server or client.  
   * If on server, you need to pass the player to call the function on.  
   * If on client, the function will be called on the server.  
   * **Note: This method will block the thread until the function is called and the result is returned.  
   * {@link bridge.callAsync} is the promise alternative to this method.**
   * 
   * To type the data sent by the function, you can use the BridgeFunctionMap interface, like:
   * ```ts
   * declare global {
   *  interface BridgeFunctionMap {
   *    helloback: BridgeFunction<{ myData: string }, { myResult: number }>;
   *    hello: BridgeFunction<{ myData: string }, { myResult: number }>;
   *  }
   * }
   * ```
   * Then you can call the function like this:
   * ```ts
   * // Client side
   * bridge.fn("helloback", (data, player) => {
   *  print("Called helloback with data: ", data, " local player: ", player.Name);
   *  return { myResult: 42 };
   * });
   * const data = bridge.call("hello", { myData: "Hello from client" });
   * // note that here data is the result of the "helloback" function from
   * // client as the value returned by server is the one from the client
   * print("Server returned data: ", data.myResult);
   * 
   * // Server side
   * bridge.fn("hello", (data, player) => {
   *  print("Client sent hello with data: ", data, " from player: ", player.Name);
   *  return bridge.call("helloback", { myData: "Hello from server" }, player);
   * });
   * ```
   * @param name The name of the function to call.
   * @param data The data to send with the function.
   * @param player The player to call the function on (only on server).
   * @param ignoreUnset If true, if the other side doesn't have the function registered, it will not warn in the console.
   * @returns The result of the function called.
   */
  call: ((name: string, data: unknown, player?: Player, ignoreUnset?: boolean) => {
    const msg: JsonMessage = { type: name, data, ignoreUnset };
    if (RunService.IsServer()) {
      if (player === undefined) throw "[BRIDGE] call: calling a function on server requires a player";
      return remoteFunction.InvokeClient(player, msg);
    } else return remoteFunction.InvokeServer(msg);
  }) as {
    <T extends keyof BridgeFunctionMap>(name: T, data: BridgeFunctionMap[T][0], player?: Player, ignoreUnset?: boolean): BridgeFunctionMap[T][1],
    <T extends string>(name: T, data: unknown, player?: Player, ignoreUnset?: boolean): unknown,
  },

  /**
   * # Bridge.callAsync
   * The same as {@link bridge.call}, but will return a promise instead of blocking the thread.
   * 
   * @see {@link bridge.call}
   * @param name The name of the function to call.
   * @param data The data to send with the function.
   * @param player The player to call the function on (only on server).
   * @param ignoreUnset If true, if the other side doesn't have the function registered, it will not warn in the console.
   * @returns A promise that will resolve with the result of the function called.
   */
  callAsync: ((name: string, data: unknown, player?: Player, ignoreUnset?: boolean): Promise<unknown> => {
    const msg: JsonMessage = { type: name, data, ignoreUnset };
    if (RunService.IsServer()) {
      if (player === undefined) throw "[BRIDGE] callAsync: calling a function on server requires a player";
      return new Promise((resolve) => resolve(remoteFunction.InvokeClient(player, msg)));
    } else return new Promise((resolve) => resolve(remoteFunction.InvokeServer(msg)));
  }) as {
    <T extends keyof BridgeFunctionMap>(name: T, data: BridgeFunctionMap[T][0], player?: Player, ignoreUnset?: boolean): Promise<BridgeFunctionMap[T][1]>,
    <T extends string>(name: T, data: unknown, player?: Player, ignoreUnset?: boolean): Promise<unknown>,
  },

  /**
   * # Bridge.sync
   * A way to sync data between server and client.  
   * The synchronization can be throttled to avoid too many calls to the other side.  
   * The first call can be:
   * - sync (default) (will block the thread until the data is retrieved)
   * - async (will return a promise that will resolve when the data is retrieved, then flush current patches if any).
   * 
   * Writeable side can be specified to allow or restrict which side can modify the data.  
   * Any patch will lock the other side's patching until the flush is done, to ensure data integrity.  
   * Patches must be a function that alter data given as argument and return the altered data.  
   * Patches May not depend on data snapshot outside the patch argument if possible, as data inside may be different on each side.  
   * 
   * Usage:
   * ```ts
   * // shared/playerData.ts
   * // writeable on both sides, sync init, no throttle
   * const playerData = bridge.sync("playerData", { money: 0, level: 1 });
   * 
   * // Client side
   * const data = playerData(); // will be the data from the server if it exists, or the default value
   * const sub = data.onUpdated((ctx) => print("Level updated to: ", ctx.data.level));
   * setTimeout(() => {
   *  data.patch((data) => (data.money += 1, data)); // will patch +1 to the money value
   * }, 1000);
   * 
   * // Server side
   * const data = playerData(player); // will be the data from the client if it exists, or the default value
   * data.onUpdated((ctx) => {
   *  print(player.Name, " updated data with money: ", ctx.data.money, " and level: ", ctx.data.level);
   *  if(ctx.data.money > 100) ctx.patch((data) => (data.level += 1, data.money = 0, data)); // will patch +1 to the level value and reset money to 0
   * });
   * ```
   * @param useKey The key to use for the sync. Must be unique.
   * @param init The initial value to use for the sync.
   * @param writeableOn value in ["server", "client", "client-server"] to define where the data can be patched. Default is "client-server".
   * @param asyncInit If true, the sync will be initialized asynchronously. Default is false.
   * @param throttleDelay The delay in milliseconds to throttle the sync. Default is nil (no throttle).
   * @returns A function that takes an optional player parameter and returns the sync context.
   */
  sync: <T = unknown>(useKey: string, init: T, writeableOn: "server" | "client" | "client-server" = "client-server", asyncInit = false, throttleDelay?: number): SyncConstructor<T> => {
    // check if the sync constructor already exists, if so, return it
    const synced = syncs.get(useKey)
    if (synced !== undefined) throw `[BRIDGE] sync <${useKey}>: sync already registered, try using another key`;

    // A map to store contexts for different players
    const contextMap = new WeakMap<Player, SyncContext>();

    Players.PlayerRemoving.Connect((player) => {
      contextMap.get(player)?.destroy();
    });

    return ((player?: Player) => {
      // If on server, we require a player, if on client and no player provided, use LocalPlayer
      if (RunService.IsServer()) {
        if (player === undefined) throw `[BRIDGE] sync <${useKey}>: creating sync context on server requires a player`;
      } else if (player === undefined) {
        player = Players.LocalPlayer;
      }

      // Check if the context already exists for this player, if so, return it
      let context = contextMap.get(player!);
      if (context !== undefined) return context;


      let locked = false,
        isFlusing = false,
        initialized = false,
        retryTimeout: symbol | undefined,
        lockTimeout: symbol | undefined,
        destroyed = false;

      const key = `bridge_sync:${player.UserId}:${useKey}`,
        updateCallbacks = new Set<(ctx: SyncContext) => void>(),
        patchQueue = [] as ((data: unknown) => unknown)[],
        cleanups = new Set<() => void>([
          () => {
            if (lockTimeout) clearTimeout(lockTimeout);
            if (retryTimeout) clearTimeout(retryTimeout);
            flushThrottleCleanup();
            destroyed = true;
            // remove references in functions to help garbage collector (idk if it helps, but it doesn't hurt)
            cleanups.clear();
          }
        ]),

        // Checks if we need to retry the sync, retries if needed
        checkAndRetrySync = () => {
          if (destroyed) return;
          if (retryTimeout) retryTimeout = clearTimeout(retryTimeout) as undefined;

          // If versions are mismatched and not currently syncing, try again
          if (initialized && !isFlusing && !locked && context!.version > context!.lastSyncedVersion)
            flush();
        },


        // Creates a function, returns the caller to run the function on the other side
        newFn = (name: string, callback: (v: unknown) => void) => {
          bridge.fn(`${name}:${key}`, callback);
          cleanups.add(() => bridge.fnOff(`${name}:${key}`));
          return <As extends boolean>(v: unknown, async: As): As extends true ? Promise<unknown> : void => {
            if (async) return bridge.callAsync(`${name}:${key}`, v, player, true) as As extends true ? Promise<unknown> : void;
            return bridge.call(`${name}:${key}`, v, player, true) as As extends true ? Promise<unknown> : void;
          };
        },

        // Locks the context to avoid other side to send data while flushing
        lock = newFn("lock", () => {
          if (destroyed || isFlusing) return false;
          locked = true;

          // Clear any existing timeout
          if (lockTimeout) clearTimeout(lockTimeout);

          // Set a timeout to automatically unlock after 30 seconds
          lockTimeout = setTimeout(() => {
            if (!locked) return;
            warn(`[BRIDGE] sync <${useKey}>: Force unlocking after 30s timeout - potential deadlock detected`);
            locked = false;
            flush();
          }, 30000);

          return true;
        }),

        // Unlocks the context to allow other side to send data
        unlock = newFn("unlock", () => {
          if (destroyed) return false;
          if (lockTimeout) lockTimeout = clearTimeout(lockTimeout) as undefined;
          locked = false;
          flush();
        }),

        // patchs the new diff to the other side
        patch = newFn("patch", (payload) => {
          if (destroyed || !typeIs(payload, "table")) return;

          const asTable = payload as Record<string, unknown>;
          if (asTable.data !== undefined && typeIs(asTable.version, "number")) {
            const typedPayload = asTable as { data: unknown, version: number };

            // Only accept updates that have a higher version than our current state
            // This prevents out-of-order updates from causing issues
            if (typedPayload.version > context!.version) {
              Object.patch(context!.data, makeSerializedDiffUsable(typedPayload.data), true);
              context!.version = typedPayload.version;
              context!.lastSyncedVersion = typedPayload.version;
              updateCallbacks.forEach((cb) => cb(context!));
            }
          }
        }),

        // Retrieves the data from the other side
        retrieve = newFn("retrieve", () => !destroyed && context!.data),

        //flush function to send the data to the other side
        flush = async () => {
          if (locked || patchQueue.size() <= 0 || !initialized || destroyed) return;
          flushThrottleCleanup();
          isFlusing = true;

          // If we're about to apply patches, increment the version
          // lock the context to avoid other side to send data while flushing
          // if false, it means that the other side is already flushing, so we wait for it to finish
          // when it finishes, it will unlock the context and call this function again
          if (!await lock(undefined, true)) {
            isFlusing = false;
            return;
          }

          const syncingVersion = context!.version + 1, oldData = Object.dup(context!.data, true);

          for (const patch of patchQueue) try {
            context!.data = patch(context!.data);
          } catch (e) {
            warn("[BRIDGE] sync <" + useKey + ">: A patch failed, data has not all patchs applied because of error: " + e)
          }
          context!.version = syncingVersion; // update the version to the new value
          patchQueue.clear();

          const diff = Object.diff(context!.data, oldData, true); // get the diff between the data and the current data

          if (context!.version > context!.lastSyncedVersion) {
            let sent = false, tries = 0;
            while (!sent && tries < 3) {
              try {
                tries++;
                // Send both diff and its version
                await patch({ data: makeDiffSerializable(diff), version: syncingVersion }, true);

                //success, update the last synced version
                sent = true, context!.lastSyncedVersion = syncingVersion;
              } catch (e) {
                warn("[BRIDGE] sync <" + useKey + ">: Error sending data: " + e, "Retrying instantly for the " + tries + " time");
              }
            }
            if (!sent) {
              // If sending failed after retries, notify but keep the local changes
              warn(`[BRIDGE] sync <${useKey}>: Failed to send data after 3 tries. Local changes at version ${syncingVersion} not synchronized (last synced version: ${context!.lastSyncedVersion}). Will retry in 1 second.`);

              // Schedule a retry after 1 second
              if (retryTimeout) clearTimeout(retryTimeout);
              retryTimeout = setTimeout(checkAndRetrySync, 1000);
            }
          }

          // unlock the context
          await unlock(undefined, true);
          isFlusing = false;
        },

        // Throttles the flush function, for classic calls
        [_flushThrottle, flushThrottleCleanup] = throttle(() => flush(), throttleDelay),
        flushThrottle = () => !destroyed && _flushThrottle();

      // the main context
      context = {
        data: init,
        patch: (patcher: (data: unknown) => void) => {
          if (RunService.IsServer()) {
            if (writeableOn === "client") throw `[BRIDGE] sync <${useKey}>: patching is not allowed on server side as not configured to allow it`;
          } else if (writeableOn === "server") throw `[BRIDGE] sync <${useKey}>: patching is not allowed on client side as not configured to allow it`;

          patchQueue.push(patcher);
          if (patchQueue.size() > 100) flush()
          else flushThrottle();
        },
        onUpdated: (callback) => {
          updateCallbacks.add(callback);
          let cleanup = () => updateCallbacks.delete(callback);
          cleanups.add(cleanup);
          return () => {
            cleanup();
            cleanups.delete(cleanup);
            (cleanup as unknown) = undefined;
          };
        },
        version: 0,
        lastSyncedVersion: 0,
        player,
        destroy: () => {
          cleanups.forEach((cleanup) => cleanup());
          contextMap.delete(player);
        }
      };

      // store the context in the map
      contextMap.set(player, context);

      // retrieve already stored data on opposite side if any
      if (asyncInit) {
        retrieve(undefined, true).then((stored) => {
          initialized = true;
          if (stored !== undefined) {
            context!.data = stored as T;
            updateCallbacks.forEach((cb) => cb(context!));
            flushThrottle();
          }
        })
      } else {
        const stored = retrieve(undefined, false);
        if (stored !== undefined) context.data = stored as T;
        initialized = true;
      }

      //return the context
      return context;
    }) as SyncConstructor<T>
  },
};

export default bridge;