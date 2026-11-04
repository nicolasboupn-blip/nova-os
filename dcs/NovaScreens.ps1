# NOVA SCREENS: shows this PC's screens on the NOVA phone launcher (same Wi-Fi) and lets the phone click.
# Start it from NOVA (PC SCREENS > START ON PC) or: powershell -ExecutionPolicy Bypass -File NovaScreens.ps1
# Close this window to stop.
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class NovaWin {
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern bool SetProcessDpiAwarenessContext(IntPtr v);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern void mouse_event(int f, int x, int y, int d, int e);
}
"@
try { [NovaWin]::SetProcessDpiAwarenessContext([IntPtr](-4)) | Out-Null } catch { }
[NovaWin]::SetProcessDPIAware() | Out-Null
$port = 41910
$crlf = [string][char]13 + [string][char]10
$listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Any, $port)
$listener.Start()
$udp = New-Object System.Net.Sockets.UdpClient
$udp.EnableBroadcast = $true
$beacon = [System.Text.Encoding]::ASCII.GetBytes("NOVASCREEN;" + $port)
$bcast = New-Object System.Net.IPEndPoint([System.Net.IPAddress]::Broadcast, 41911)
$codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq "image/jpeg" }
$ips = [System.Net.Dns]::GetHostAddresses([System.Net.Dns]::GetHostName()) | Where-Object { $_.AddressFamily -eq "InterNetwork" }
Write-Host "NOVA SCREENS is running. PC address: $ips (port $port)"
Write-Host "Leave this window open. Close it to stop. If Windows asks, allow it on private AND public networks."
$last = [DateTime]::MinValue

function Shot($s, $w, $q) {
  $all = [System.Windows.Forms.Screen]::AllScreens
  if ($s -ge $all.Length -or $s -lt 0) { $s = 0 }
  $b = $all[$s].Bounds
  $big = New-Object System.Drawing.Bitmap($b.Width, $b.Height)
  $g = [System.Drawing.Graphics]::FromImage($big)
  $g.CopyFromScreen($b.X, $b.Y, 0, 0, $big.Size)
  $g.Dispose()
  if ($w -gt 0 -and $w -lt $b.Width) {
    $h = [int]($b.Height * $w / $b.Width)
    $small = New-Object System.Drawing.Bitmap($big, $w, $h)
    $big.Dispose()
    $big = $small
  }
  $ms = New-Object System.IO.MemoryStream
  $ep = New-Object System.Drawing.Imaging.EncoderParameters(1)
  $ep.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]$q)
  $big.Save($ms, $codec, $ep)
  $big.Dispose()
  return ,$ms.ToArray()
}

while ($true) {
  if (([DateTime]::Now - $last).TotalSeconds -gt 2) {
    try { $udp.Send($beacon, $beacon.Length, $bcast) | Out-Null } catch { }
    $last = [DateTime]::Now
  }
  if (-not $listener.Pending()) {
    Start-Sleep -Milliseconds 10
    continue
  }
  $c = $listener.AcceptTcpClient()
  try {
    $c.NoDelay = $true
    $st = $c.GetStream()
    $rd = New-Object System.IO.StreamReader($st)
    $line = $rd.ReadLine()
    $hl = $rd.ReadLine()
    while ($hl -ne $null -and $hl.Length -gt 0) { $hl = $rd.ReadLine() }
    $path = ($line -split " ")[1]
    $q = @{}
    if ($path.Contains("?")) {
      foreach ($kv in $path.Split("?")[1].Split("&")) {
        $p = $kv.Split("=")
        $q[$p[0]] = $p[1]
      }
    }
    $type = "text/plain"
    if ($path.StartsWith("/shot")) {
      $body = Shot ([int]$q["s"]) ([int]$q["w"]) ([int]$q["q"])
      $type = "image/jpeg"
    } elseif ($path.StartsWith("/click")) {
      $all = [System.Windows.Forms.Screen]::AllScreens
      $si = [int]$q["s"]
      if ($si -ge $all.Length) { $si = 0 }
      $b = $all[$si].Bounds
      $x = $b.X + [int]([double]::Parse($q["x"], [System.Globalization.CultureInfo]::InvariantCulture) * $b.Width)
      $y = $b.Y + [int]([double]::Parse($q["y"], [System.Globalization.CultureInfo]::InvariantCulture) * $b.Height)
      [NovaWin]::SetCursorPos($x, $y) | Out-Null
      if ($q["b"] -eq "R") {
        [NovaWin]::mouse_event(8, 0, 0, 0, 0)
        [NovaWin]::mouse_event(16, 0, 0, 0, 0)
      } elseif ($q["b"] -eq "L") {
        [NovaWin]::mouse_event(2, 0, 0, 0, 0)
        [NovaWin]::mouse_event(4, 0, 0, 0, 0)
      } elseif ($q["b"] -eq "D") {
        [NovaWin]::mouse_event(2, 0, 0, 0, 0)
        [NovaWin]::mouse_event(4, 0, 0, 0, 0)
        [NovaWin]::mouse_event(2, 0, 0, 0, 0)
        [NovaWin]::mouse_event(4, 0, 0, 0, 0)
      }
      $body = [System.Text.Encoding]::ASCII.GetBytes("ok")
    } else {
      $all = [System.Windows.Forms.Screen]::AllScreens
      $info = ($all | ForEach-Object { "" + $_.Bounds.Width + "x" + $_.Bounds.Height }) -join ";"
      $body = [System.Text.Encoding]::ASCII.GetBytes("NOVASCREEN;" + $all.Length + ";" + $info)
    }
    $head = [System.Text.Encoding]::ASCII.GetBytes("HTTP/1.0 200 OK" + $crlf + "Content-Type: " + $type + $crlf + "Content-Length: " + $body.Length + $crlf + "Connection: close" + $crlf + $crlf)
    $st.Write($head, 0, $head.Length)
    $st.Write($body, 0, $body.Length)
    $st.Flush()
  } catch {
  } finally {
    $c.Close()
  }
}
