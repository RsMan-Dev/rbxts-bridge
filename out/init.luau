-- Compiled with roblox-ts v3.0.0
local TS = _G[script]
local exports = {}
local bridge = TS.import(script, script, "bridge").default
for _k, _v in TS.import(script, script, "bridge") or {} do
	exports[_k] = _v
end
local default = bridge
exports.default = default
return exports
