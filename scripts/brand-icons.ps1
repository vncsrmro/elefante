Add-Type -AssemblyName System.Drawing
$root=Split-Path $PSScriptRoot -Parent
$source=[Drawing.Image]::FromFile((Join-Path $root 'build/official-icon.png'))
foreach($size in @(16,32,48,64,128,256,512)){
$b=New-Object Drawing.Bitmap($size,$size)
$g=[Drawing.Graphics]::FromImage($b)
$g.InterpolationMode=[Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.DrawImage($source,0,0,$size,$size)
$b.Save((Join-Path $root "build/brand-$size.png"),[Drawing.Imaging.ImageFormat]::Png)
$g.Dispose();$b.Dispose()
}
$source.Dispose()
Copy-Item "$root/build/brand-512.png" "$root/build/icon.png" -Force
Copy-Item "$root/build/brand-256.png" "$root/src/renderer/src/assets/elefante-icon.png" -Force
Copy-Item "$root/build/brand-32.png" "$root/build/tray.png" -Force
