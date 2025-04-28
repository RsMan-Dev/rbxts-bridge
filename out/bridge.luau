-- Compiled with roblox-ts v3.0.0
local TS = _G[script]
local _services = TS.import(script, TS.getModule(script, "@rbxts", "services"))
local RunService = _services.RunService
local ReplicatedStorage = _services.ReplicatedStorage
local Players = _services.Players
local _jsnatives = TS.import(script, TS.getModule(script, "@rbxts", "jsnatives").out)
local setTimeout = _jsnatives.setTimeout
local clearTimeout = _jsnatives.clearTimeout
-- -- TYPES --
-- -- INSTANCES --
local EVENT_NAME = "BridgeEvent"
local FUNCTION_NAME = "BridgeFunction"
local remoteEvent = ReplicatedStorage:FindFirstChild(EVENT_NAME)
if not remoteEvent then
	remoteEvent = Instance.new("RemoteEvent", ReplicatedStorage)
	remoteEvent.Name = EVENT_NAME
end
local remoteFunction = ReplicatedStorage:FindFirstChild(FUNCTION_NAME)
if not remoteFunction then
	remoteFunction = Instance.new("RemoteFunction", ReplicatedStorage)
	remoteFunction.Name = FUNCTION_NAME
end
-- -- STORAGE --
local eventHandlers = {}
local functionHandlers = {}
local function unwrapMsg(msg)
	local _msg = msg
	local _condition = type(_msg) == "table"
	if _condition then
		local _type = msg.type
		_condition = type(_type) == "string"
	end
	if _condition then
		return msg
	end
end
-- -- CONNECT EVENTS --
if RunService:IsServer() then
	remoteEvent.OnServerEvent:Connect(function(player, JsonMessage)
		local msg = unwrapMsg(JsonMessage)
		if msg == nil then
			return nil
		end
		local _type = msg.type
		if not (eventHandlers[_type] ~= nil) then
			return if msg.ignoreUnset ~= true then warn(`[BRIDGE] No event registered for {msg.type} on server`) else nil
		end
		local _type_1 = msg.type
		local _exp = eventHandlers[_type_1]
		-- ▼ ReadonlySet.forEach ▼
		local _callback = function(cb)
			return cb(msg.data, player)
		end
		for _v in _exp do
			_callback(_v, _v, _exp)
		end
		-- ▲ ReadonlySet.forEach ▲
	end)
	remoteFunction.OnServerInvoke = function(player, JsonMessage)
		local msg = unwrapMsg(JsonMessage)
		if msg == nil then
			return nil
		end
		local _type = msg.type
		if not (functionHandlers[_type] ~= nil) then
			return if msg.ignoreUnset ~= true then warn(`[BRIDGE] No function registered for {msg.type} on server`) else nil
		end
		local _type_1 = msg.type
		return functionHandlers[_type_1](msg.data, player)
	end
else
	local player = Players.LocalPlayer
	remoteEvent.OnClientEvent:Connect(function(jsonMessage)
		local msg = unwrapMsg(jsonMessage)
		if msg == nil then
			return nil
		end
		local _type = msg.type
		if not (eventHandlers[_type] ~= nil) then
			return if msg.ignoreUnset ~= true then warn(`[BRIDGE] No event registered for {msg.type} on client`) else nil
		end
		local _type_1 = msg.type
		local _exp = eventHandlers[_type_1]
		-- ▼ ReadonlySet.forEach ▼
		local _callback = function(cb)
			return cb(msg.data, player)
		end
		for _v in _exp do
			_callback(_v, _v, _exp)
		end
		-- ▲ ReadonlySet.forEach ▲
	end)
	remoteFunction.OnClientInvoke = function(jsonMessage)
		local msg = unwrapMsg(jsonMessage)
		if msg == nil then
			return nil
		end
		local _type = msg.type
		local _condition = not (functionHandlers[_type] ~= nil)
		if _condition then
			_condition = msg.ignoreUnset ~= true
		end
		if _condition then
			return warn(`[BRIDGE] No function registered for {msg.type} on client`)
		end
		local _type_1 = msg.type
		return functionHandlers[_type_1](msg.data, player)
	end
end
local syncs = {}
local function throttle(callback, delay)
	if delay == nil or delay == 0 then
		return { callback, function() end }
	end
	local lastArgs = nil
	local timeout = nil
	return { function(...)
		local args = { ... }
		if timeout ~= 0 and timeout == timeout and timeout ~= "" and timeout then
			lastArgs = args
			return lastArgs
		end
		lastArgs = nil
		callback(unpack(args))
		timeout = setTimeout(function()
			if lastArgs then
				callback(unpack(lastArgs))
			end
			timeout = nil
		end, delay)
	end, function()
		if timeout ~= 0 and timeout == timeout and timeout ~= "" and timeout then
			clearTimeout(timeout)
		end
		timeout = nil
	end }
end
--[[
	*
	 * # Bridge
	 * Bridge is a simple way to communicate between server and client using events and functions.
	 * It uses RemoteEvent and RemoteFunction to send data between server and client.
	 * Look at each function for more details.
	 
]]
local bridge
bridge = {
	on = (function(event, callback)
		local _event = event
		local set = eventHandlers[_event]
		if not set then
			local _event_1 = event
			local _arg1 = {
				[callback] = true,
			}
			eventHandlers[_event_1] = _arg1
		else
			local _set = set
			local _callback = callback
			_set[_callback] = true
		end
	end),
	off = function(self, event, callback)
		local _event = event
		local set = eventHandlers[_event]
		if not set then
			return nil
		end
		local _callback = callback
		set[_callback] = nil
		-- ▼ ReadonlySet.size ▼
		local _size = 0
		for _ in set do
			_size += 1
		end
		-- ▲ ReadonlySet.size ▲
		if _size == 0 then
			local _event_1 = event
			eventHandlers[_event_1] = nil
		end
	end,
	send = (function(event, data, player, ignoreUnset)
		local msg = {
			type = event,
			data = data,
			ignoreUnset = ignoreUnset,
		}
		if RunService:IsServer() then
			if player == nil then
				error("[BRIDGE] send: sending an event on server requires a player")
			end
			remoteEvent:FireClient(player, msg)
		else
			remoteEvent:FireServer(msg)
		end
	end),
	broadcast = function(self, event, data)
		if not RunService:IsServer() then
			error("[BRIDGE] broadcast: only usable on server")
		end
		local msg = {
			type = event,
			data = data,
			ignoreUnset = true,
		}
		remoteEvent:FireAllClients(msg)
	end,
	fn = (function(name, callback)
		local _name = name
		if functionHandlers[_name] ~= nil then
			error(`[BRIDGE] fn: function {name} already registered`)
		end
		local _name_1 = name
		local _callback = callback
		functionHandlers[_name_1] = _callback
	end),
	fnOff = function(name)
		local _name = name
		if functionHandlers[_name] ~= nil then
			local _name_1 = name
			functionHandlers[_name_1] = nil
		end
	end,
	call = (function(name, data, player, ignoreUnset)
		local msg = {
			type = name,
			data = data,
			ignoreUnset = ignoreUnset,
		}
		if RunService:IsServer() then
			if player == nil then
				error("[BRIDGE] call: calling a function on server requires a player")
			end
			return remoteFunction:InvokeClient(player, msg)
		else
			return remoteFunction:InvokeServer(msg)
		end
	end),
	callAsync = (function(name, data, player, ignoreUnset)
		local msg = {
			type = name,
			data = data,
			ignoreUnset = ignoreUnset,
		}
		if RunService:IsServer() then
			if player == nil then
				error("[BRIDGE] callAsync: calling a function on server requires a player")
			end
			return TS.Promise.new(function(resolve)
				return resolve(remoteFunction:InvokeClient(player, msg))
			end)
		else
			return TS.Promise.new(function(resolve)
				return resolve(remoteFunction:InvokeServer(msg))
			end)
		end
	end),
	sync = function(useKey, init, writeableOn, asyncInit, throttleDelay)
		if writeableOn == nil then
			writeableOn = "client-server"
		end
		if asyncInit == nil then
			asyncInit = false
		end
		-- check if the sync constructor already exists, if so, return it
		local _useKey = useKey
		local synced = syncs[_useKey]
		if synced ~= nil then
			error(`[BRIDGE] sync <{useKey}>: sync already registered, try using another key`)
		end
		-- A map to store contexts for different players
		local contextMap = setmetatable({}, {
			__mode = "k",
		})
		Players.PlayerRemoving:Connect(function(player)
			local _player = player
			local context = contextMap[_player]
			if context ~= nil then
				local _exp = context.cleanups
				-- ▼ ReadonlySet.forEach ▼
				local _callback = function(cleanup)
					return cleanup()
				end
				for _v in _exp do
					_callback(_v, _v, _exp)
				end
				-- ▲ ReadonlySet.forEach ▲
				local _player_1 = player
				contextMap[_player_1] = nil
			end
		end)
		return function(player)
			-- If on server, we require a player, if on client and no player provided, use LocalPlayer
			if RunService:IsServer() then
				if player == nil then
					error(`[BRIDGE] sync <{useKey}>: creating sync context on server requires a player`)
				end
			elseif player == nil then
				player = Players.LocalPlayer
			end
			-- Check if the context already exists for this player, if so, return it
			local _player = player
			local context = contextMap[_player]
			if context ~= nil then
				return context
			end
			local locked = false
			local isFlusing = false
			local initialized = false
			local retryTimeout
			local lockTimeout
			local flush, key, cleanups, updateCallbacks, patchQueue, flushThrottleCleanup, lock, send, checkAndRetrySync, unlock
			local key = `bridge_sync:{player.UserId}:{useKey}`
			local updateCallbacks = {}
			local patchQueue = {}
			local cleanups = {}
			local checkAndRetrySync = function()
				if retryTimeout ~= 0 and retryTimeout == retryTimeout and retryTimeout ~= "" and retryTimeout then
					retryTimeout = clearTimeout(retryTimeout)
				end
				-- If versions are mismatched and not currently syncing, try again
				if initialized and not isFlusing and not locked and context.version > context.lastSyncedVersion then
					flush()
				end
			end
			local newFn = function(name, callback)
				bridge.fn(`{name}:{key}`, callback)
				cleanups[function()
					return bridge.fnOff(`{name}:{key}`)
				end] = true
				return function(v, async)
					if async then
						return bridge.callAsync(`{name}:{key}`, v, player, true)
					end
					return bridge.call(`{name}:{key}`, v, player, true)
				end
			end
			local lock = newFn("lock", function()
				if isFlusing then
					return false
				end
				locked = true
				-- Clear any existing timeout
				if lockTimeout ~= 0 and lockTimeout == lockTimeout and lockTimeout ~= "" and lockTimeout then
					clearTimeout(lockTimeout)
				end
				-- Set a timeout to automatically unlock after 30 seconds
				lockTimeout = setTimeout(function()
					if not locked then
						return nil
					end
					warn(`[BRIDGE] sync <{useKey}>: Force unlocking after 30s timeout - potential deadlock detected`)
					locked = false
					flush()
				end, 30000)
				return true
			end)
			local unlock = newFn("unlock", function()
				if lockTimeout ~= 0 and lockTimeout == lockTimeout and lockTimeout ~= "" and lockTimeout then
					lockTimeout = clearTimeout(lockTimeout)
				end
				locked = false
				flush()
			end)
			local send = newFn("send", function(payload)
				-- Type checking since bridge.fn expects a different signature
				local _payload = payload
				if type(_payload) == "table" then
					local asTable = payload
					local _condition = asTable.data ~= nil
					if _condition then
						local _version = asTable.version
						_condition = type(_version) == "number"
					end
					if _condition then
						local typedPayload = asTable
						-- Only accept updates that have a higher version than our current state
						-- This prevents out-of-order updates from causing issues
						if typedPayload.version > context.version then
							context.data = typedPayload.data
							context.version = typedPayload.version
							context.lastSyncedVersion = typedPayload.version
							-- ▼ ReadonlySet.forEach ▼
							local _callback = function(cb)
								return cb(context)
							end
							for _v in updateCallbacks do
								_callback(_v, _v, updateCallbacks)
							end
							-- ▲ ReadonlySet.forEach ▲
						end
					end
				end
			end)
			local retrieve = newFn("retrieve", function()
				return context.data
			end)
			flush = TS.async(function()
				if locked or #patchQueue <= 0 or not initialized then
					return nil
				end
				flushThrottleCleanup()
				isFlusing = true
				-- If we're about to apply patches, increment the version
				-- lock the context to avoid other side to send data while flushing
				-- if false, it means that the other side is already flushing, so we wait for it to finish
				-- when it finishes, it will unlock the context and call this function again
				local _value = TS.await(lock(nil, true))
				if not (_value ~= 0 and _value == _value and _value ~= "" and _value) then
					isFlusing = false
					return nil
				end
				local syncingVersion = context.version + 1
				for _, patch in patchQueue do
					TS.try(function()
						context.data = patch(context.data)
						context.version = syncingVersion
					end, function(_)
						warn("[BRIDGE] sync <" .. useKey .. ">: A patch failed, data has not all patchs applied")
					end)
				end
				table.clear(patchQueue)
				if context.version > context.lastSyncedVersion then
					local sent = false
					local tries = 0
					while not sent and tries < 3 do
						TS.try(function()
							tries += 1
							-- Send both the data and its version
							TS.await(send({
								data = context.data,
								version = syncingVersion,
							}, true))
							--success, update the last synced version
							sent = true
							local _exp = sent
							context.lastSyncedVersion = syncingVersion
							local _ = context.lastSyncedVersion
						end, function(e)
							warn("[BRIDGE] sync <" .. useKey .. ">: Error sending data: " .. tostring(e), "Retrying instantly for the " .. tostring(tries) .. " time")
						end)
					end
					if not sent then
						-- If sending failed after retries, notify but keep the local changes
						warn(`[BRIDGE] sync <{useKey}>: Failed to send data after 3 tries. Local changes at version {syncingVersion} not synchronized (last synced version: {context.lastSyncedVersion}). Will retry in 1 second.`)
						-- Schedule a retry after 1 second
						if retryTimeout ~= 0 and retryTimeout == retryTimeout and retryTimeout ~= "" and retryTimeout then
							clearTimeout(retryTimeout)
						end
						retryTimeout = setTimeout(checkAndRetrySync, 1000)
					end
				end
				-- unlock the context
				TS.await(unlock(nil, true))
				isFlusing = false
			end)
			local _binding = throttle(function()
				return flush()
			end, throttleDelay)
			local flushThrottle = _binding[1]
			flushThrottleCleanup = _binding[2]
			-- the main context
			context = {
				data = init,
				patch = function(patcher)
					if RunService:IsServer() then
						if writeableOn == "client" then
							error(`[BRIDGE] sync <{useKey}>: patching is not allowed on server side as not configured to allow it`)
						end
					elseif writeableOn == "server" then
						error(`[BRIDGE] sync <{useKey}>: patching is not allowed on client side as not configured to allow it`)
					end
					local _patcher = patcher
					table.insert(patchQueue, _patcher)
					if #patchQueue > 100 then
						flush()
					else
						flushThrottle()
					end
				end,
				onUpdated = function(callback)
					local _callback = callback
					updateCallbacks[_callback] = true
					local cleanup = function()
						local _callback_1 = callback
						-- ▼ Set.delete ▼
						local _valueExisted = updateCallbacks[_callback_1] ~= nil
						updateCallbacks[_callback_1] = nil
						-- ▲ Set.delete ▲
						return _valueExisted
					end
					local _cleanup = cleanup
					cleanups[_cleanup] = true
					return function()
						cleanup()
						local _cleanup_1 = cleanup
						cleanups[_cleanup_1] = nil
						cleanup = nil
					end
				end,
				version = 0,
				lastSyncedVersion = 0,
				cleanups = cleanups,
				player = player,
			}
			-- store the context in the map
			local _player_1 = player
			local _context = context
			contextMap[_player_1] = _context
			-- retrieve already stored data on opposite side if any
			if asyncInit then
				retrieve(nil, true):andThen(function(stored)
					initialized = true
					if stored ~= nil then
						context.data = stored
						-- ▼ ReadonlySet.forEach ▼
						local _callback = function(cb)
							return cb(context)
						end
						for _v in updateCallbacks do
							_callback(_v, _v, updateCallbacks)
						end
						-- ▲ ReadonlySet.forEach ▲
						flushThrottle()
					end
				end)
			else
				local stored = retrieve(nil, false)
				if stored ~= nil then
					context.data = stored
				end
				initialized = true
			end
			--return the context
			return context
		end
	end,
}
local default = bridge
return {
	default = default,
}
