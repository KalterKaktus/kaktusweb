$port = 3000
$root = (Get-Location).Path
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Start()
Write-Host "Serving $root on http://localhost:$port"
$mime = @{
  ".html" = "text/html"; ".js" = "text/javascript"; ".mjs" = "text/javascript";
  ".css" = "text/css"; ".json" = "application/json"; ".svg" = "image/svg+xml";
  ".png" = "image/png"; ".jpg" = "image/jpeg"; ".jpeg" = "image/jpeg";
  ".webmanifest" = "application/manifest+json"; ".ico" = "image/x-icon";
  ".woff2" = "font/woff2"
}
while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  $path = [System.Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath)
  if ($path.EndsWith("/")) { $path += "index.html" }
  $file = Join-Path $root ($path.TrimStart("/"))
  if (Test-Path $file -PathType Leaf) {
    $ext = [System.IO.Path]::GetExtension($file).ToLower()
    $ct = $mime[$ext]
    if (-not $ct) { $ct = "application/octet-stream" }
    $bytes = [System.IO.File]::ReadAllBytes($file)
    $ctx.Response.ContentType = $ct
    $ctx.Response.ContentLength64 = $bytes.Length
    $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
  }
  else {
    $ctx.Response.StatusCode = 404
  }
  $ctx.Response.OutputStream.Close()
}
