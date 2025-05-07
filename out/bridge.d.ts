declare global {
    interface BridgeEventMap {
        [key: string]: unknown;
    }
    type BridgeFunction<T = unknown, R = unknown> = [T, R];
    interface BridgeFunctionMap {
        [key: string]: BridgeFunction;
    }
}
export type EventCallback<T = unknown> = (data: T, player: Player) => void;
export type FunctionCallback<T = unknown, R = unknown> = (data: T, player: Player) => R;
export type SyncContext<T = unknown> = {
    data: T;
    patch: (patcher: (data: T) => T) => void;
    onUpdated: (callback: (ctx: SyncContext<T>) => void) => () => void;
    version: number;
    lastSyncedVersion: number;
    player: Player;
    destroy: () => void;
};
export type SyncConstructor<T = unknown> = (player?: Player) => SyncContext<T>;
/**
 * # Bridge
 * Bridge is a simple way to communicate between server and client using events and functions.
 * It uses RemoteEvent and RemoteFunction to send data between server and client.
 * Look at each function for more details.
 */
declare const bridge: {
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
    on: {
        <T extends keyof BridgeEventMap>(event: T, callback: EventCallback<BridgeEventMap[T]>): void;
        <T extends string>(event: T, callback: EventCallback): void;
    };
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
    off(event: string, callback: EventCallback): void;
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
    send: {
        <T extends keyof BridgeEventMap>(event: T, data: BridgeEventMap[T], player?: Player, ignoreUnset?: boolean): void;
        <T extends string>(event: T, data: unknown, player?: Player, ignoreUnset?: boolean): void;
    };
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
    broadcast(event: string, data: unknown): void;
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
    fn: {
        <T extends keyof BridgeFunctionMap>(name: T, callback: FunctionCallback<BridgeFunctionMap[T][0], BridgeFunctionMap[T][1]>): void;
        <T extends string>(name: T, callback: FunctionCallback): void;
    };
    /**
     * # Bridge.fnOff
     * Bridge.fnOff is used to unregister a function handler for a specific function.
     *
     * @param name The name of the function to unregister.
     */
    fnOff: (name: string) => void;
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
    call: {
        <T extends keyof BridgeFunctionMap>(name: T, data: BridgeFunctionMap[T][0], player?: Player, ignoreUnset?: boolean): BridgeFunctionMap[T][1];
        <T extends string>(name: T, data: unknown, player?: Player, ignoreUnset?: boolean): unknown;
    };
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
    callAsync: {
        <T extends keyof BridgeFunctionMap>(name: T, data: BridgeFunctionMap[T][0], player?: Player, ignoreUnset?: boolean): Promise<BridgeFunctionMap[T][1]>;
        <T extends string>(name: T, data: unknown, player?: Player, ignoreUnset?: boolean): Promise<unknown>;
    };
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
    sync: <T = unknown>(useKey: string, init: T, writeableOn?: "server" | "client" | "client-server", asyncInit?: boolean, throttleDelay?: number) => SyncConstructor<T>;
};
export default bridge;
