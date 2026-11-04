-- NOVA DCS LINK: sends your flight data to the NOVA phone launcher over Wi-Fi (UDP port 41900).
-- Put this file in Saved Games\DCS\Scripts\ (see the steps in NOVA: DCS COCKPIT > SETUP).
-- It keeps any other export scripts you already have (Tacview, SRS...) working.

local NOVA_IP = "255.255.255.255"
local NOVA_PORT = 41900
local novaUdp = nil
local novaNext = 0
local novaNextObj = 0
local novaPrevStart = LuaExportStart
local novaPrevAfter = LuaExportAfterNextFrame
local novaPrevStop = LuaExportStop

local function nv(f, a)
  if f == nil then return nil end
  local ok, r = pcall(f, a)
  if ok then return r end
  return nil
end

local function num(v)
  if v == nil then return "" end
  if type(v) == "number" then return string.format("%.3f", v) end
  return ""
end

local function clean(s)
  if s == nil then return "" end
  local r = string.gsub(tostring(s), "[;,|]", " ")
  return r
end

local function mv(x)
  if type(x) == "table" and x.value then return x.value end
  return 0
end

local function novaObjects(s)
  local w = nv(LoGetWorldObjects)
  if w == nil then return end
  local me = s.Position or {x = 0, z = 0}
  local myId = nv(LoGetPlayerPlaneId)
  local out = {"N2"}
  local n = 0
  for id, o in pairs(w) do
    if n >= 80 then break end
    local op = o.Position
    local ty = o.Type or {}
    local lvl = ty.level1 or 0
    if op and lvl >= 1 and lvl <= 3 and not (id == myId) then
      local dx = op.x - me.x
      local dz = op.z - me.z
      if dx * dx + dz * dz < 150000 * 150000 then
        n = n + 1
        table.insert(out, table.concat({tostring(id), tostring(lvl), tostring(o.CoalitionID or 0), num(op.x),
          num(op.z), num(op.y), num(o.Heading), clean(o.Name)}, ","))
      end
    end
  end
  novaUdp:sendto(table.concat(out, ";"), NOVA_IP, NOVA_PORT)
end

function LuaExportStart()
  if novaPrevStart then pcall(novaPrevStart) end
  package.path = package.path .. ";.\\LuaSocket\\?.lua"
  package.cpath = package.cpath .. ";.\\LuaSocket\\?.dll"
  local socket = require("socket")
  novaUdp = socket.udp()
  novaUdp:setoption("broadcast", true)
  novaUdp:settimeout(0)
end

function LuaExportAfterNextFrame()
  if novaPrevAfter then pcall(novaPrevAfter) end
  if novaUdp == nil then return end
  local t = nv(LoGetModelTime) or 0
  if t < novaNext then return end
  novaNext = t + 0.05
  local s = nv(LoGetSelfData)
  if s == nil then return end
  local e = nv(LoGetEngineInfo) or {}
  local m = nv(LoGetMechInfo) or {}
  local a = nv(LoGetAccelerationUnits) or {}
  local sn = nv(LoGetSnares) or {}
  local p = nv(LoGetPayloadInfo) or {}
  local rpm = e.RPM or {}
  local hook = nv(LoGetAircraftDrawArgumentValue, 25) or 0
  local shells = ""
  if p.Cannon and p.Cannon.shells then shells = tostring(p.Cannon.shells) end
  local weapons = 0
  if p.Stations then
    for i, st in pairs(p.Stations) do
      if st.count then weapons = weapons + st.count end
    end
  end
  local ld = ""
  local lc = ""
  local lname = ""
  local lalt = ""
  local lk = nv(LoGetLockedTargetInformation)
  if lk and lk[1] then
    local L = lk[1]
    ld = num(L.distance)
    lc = num(L.convergence_velocity)
    local o = nv(LoGetObjectById, L.ID)
    if o then
      lname = clean(o.Name)
      if o.LatLongAlt then lalt = num(o.LatLongAlt.Alt) end
    end
  end
  local pos = s.Position or {}
  local msg = table.concat({"N1", clean(s.Name), num(nv(LoGetIndicatedAirSpeed)), num(nv(LoGetTrueAirSpeed)),
    num(nv(LoGetMachNumber)), num(nv(LoGetAltitudeAboveSeaLevel)), num(nv(LoGetAltitudeAboveGroundLevel)),
    num(nv(LoGetVerticalVelocity)), num(nv(LoGetAngleOfAttack)), num(a.y), num(s.Heading), num(s.Pitch),
    num(s.Bank), num(e.fuel_internal), num(e.fuel_external), num(rpm.left), num(rpm.right), num(mv(m.gear)),
    num(mv(m.flaps)), num(mv(m.speedbrakes)), num(hook), num(mv(m.canopy)), num(mv(m.wheelbrakes)),
    tostring(sn.chaff or ""), tostring(sn.flare or ""), shells, num(pos.x), num(pos.y), num(pos.z), ld, lc,
    lname, lalt, tostring(weapons), tostring(s.CoalitionID or "")}, ";")
  novaUdp:sendto(msg, NOVA_IP, NOVA_PORT)
  if t >= novaNextObj then
    novaNextObj = t + 0.5
    pcall(novaObjects, s)
  end
end

function LuaExportStop()
  if novaPrevStop then pcall(novaPrevStop) end
  if novaUdp then novaUdp:close() end
  novaUdp = nil
end
