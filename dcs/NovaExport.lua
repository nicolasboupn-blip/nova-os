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
local novaRx = nil
local ap = {on = false, was = false, hdg = 0, alt = 0, altOn = true, last = 0, cal = 0, calT = 0, rSign = 1, pSign = 1,
  turnSign = 1, turnAcc = 0}

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

local function clamp(v, a, b)
  if v < a then return a end
  if v > b then return b end
  return v
end

-- NOVA AUTOPILOT: the phone sends "AP;on;heading;altitude;altOn" 5 times a second. The script flies that heading
-- (and holds the altitude) by moving the pitch and roll axes. The first time it engages it nudges each axis for
-- half a second to learn which way is which. If the phone goes quiet for 1.5 s it lets go.
local function novaAutopilot(t)
  if novaRx == nil then return end
  while true do
    local m = novaRx:receive()
    if m == nil then break end
    local f = {}
    local start = 1
    while true do
      local i = string.find(m, ";", start, true)
      if i == nil then
        table.insert(f, string.sub(m, start))
        break
      end
      table.insert(f, string.sub(m, start, i - 1))
      start = i + 1
    end
    if f[1] == "AP" then
      ap.on = (f[2] == "1")
      ap.hdg = tonumber(f[3]) or ap.hdg
      ap.alt = tonumber(f[4]) or ap.alt
      ap.altOn = (f[5] == "1")
      ap.last = t
    end
  end
  if ap.on and t - ap.last > 1.5 then ap.on = false end
  if not ap.on then
    if ap.was then
      pcall(LoSetCommand, 2001, 0)
      pcall(LoSetCommand, 2002, 0)
      ap.was = false
    end
    return
  end
  ap.was = true
  local s = nv(LoGetSelfData)
  if s == nil then return end
  local bank = s.Bank or 0
  local pitch = s.Pitch or 0
  local hdg = s.Heading or 0
  -- learn the directions: roll nudge, level, pitch nudge
  if ap.cal == 0 then
    ap.cal = 1
    ap.calT = t
    ap.b0 = bank
  end
  if ap.cal == 1 then
    LoSetCommand(2002, 0.35)
    LoSetCommand(2001, 0)
    if t - ap.calT > 0.6 then
      if bank < ap.b0 then ap.rSign = -1 else ap.rSign = 1 end
      ap.cal = 2
      ap.calT = t
    end
    return
  end
  if ap.cal == 2 then
    LoSetCommand(2002, clamp(-bank * 2.5, -0.5, 0.5) * ap.rSign)
    if math.abs(bank) < 0.04 or t - ap.calT > 2 then
      ap.cal = 3
      ap.calT = t
      ap.p0 = pitch
    end
    return
  end
  if ap.cal == 3 then
    LoSetCommand(2001, 0.25)
    LoSetCommand(2002, clamp(-bank * 2.5, -0.5, 0.5) * ap.rSign)
    if t - ap.calT > 0.5 then
      if pitch < ap.p0 then ap.pSign = -1 else ap.pSign = 1 end
      ap.cal = 4
    end
    return
  end
  local dt = math.max(0.001, t - (ap.lt or (t - 0.02)))
  -- heading error, then a bank angle to turn with
  local e = math.rad(ap.hdg) - hdg
  while e > math.pi do e = e - 2 * math.pi end
  while e < -math.pi do e = e + 2 * math.pi end
  local bankT = clamp(e * 1.6, -0.5, 0.5) * ap.turnSign
  local rr = (bank - (ap.lb or bank)) / dt
  LoSetCommand(2002, clamp((bankT - bank) * 1.8 - rr * 0.35, -0.6, 0.6) * ap.rSign)
  if ap.altOn then
    local alt = nv(LoGetAltitudeAboveSeaLevel) or 0
    local v = math.max(60, nv(LoGetTrueAirSpeed) or 150)
    local vsT = clamp((ap.alt - alt) * 0.08, -15, 15)
    local pitchT = clamp(math.asin(clamp(vsT / v, -0.3, 0.3)), -0.25, 0.25) + (1 / math.max(0.5, math.cos(bank)) - 1) * 0.08
    local pr = (pitch - (ap.lp or pitch)) / dt
    LoSetCommand(2001, clamp((pitchT - pitch) * 2.2 - pr * 0.5, -0.5, 0.5) * ap.pSign)
  end
  -- learn which way a bank turns the jet
  local hd = hdg - (ap.lh or hdg)
  if hd > math.pi then hd = hd - 2 * math.pi end
  if hd < -math.pi then hd = hd + 2 * math.pi end
  if math.abs(bank) > 0.15 and math.abs(hd) > 0.0002 then
    if hd * bank > 0 then ap.turnAcc = ap.turnAcc + 1 else ap.turnAcc = ap.turnAcc - 1 end
    ap.turnAcc = clamp(ap.turnAcc, -30, 30)
    if ap.turnAcc < -10 then ap.turnSign = -1 elseif ap.turnAcc > 10 then ap.turnSign = 1 end
  end
  ap.lb = bank
  ap.lp = pitch
  ap.lh = hdg
  ap.lt = t
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
  novaRx = socket.udp()
  novaRx:setsockname("*", NOVA_PORT + 1)
  novaRx:settimeout(0)
end

function LuaExportAfterNextFrame()
  if novaPrevAfter then pcall(novaPrevAfter) end
  if novaUdp == nil then return end
  local t = nv(LoGetModelTime) or 0
  pcall(novaAutopilot, t)
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
  if novaRx then novaRx:close() end
  novaUdp = nil
  novaRx = nil
end
