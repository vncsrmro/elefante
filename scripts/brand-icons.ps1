Add-Type -AssemblyName System.Drawing
$root=Split-Path $PSScriptRoot -Parent
foreach($size in @(16,32,48,64,128,256,512)){
$b=New-Object Drawing.Bitmap($size,$size)
$g=[Drawing.Graphics]::FromImage($b)
$g.SmoothingMode=[Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.ScaleTransform($size/512.0,$size/512.0)
$bg=New-Object Drawing.SolidBrush([Drawing.ColorTranslator]::FromHtml('#181722'))
$ear=New-Object Drawing.SolidBrush([Drawing.ColorTranslator]::FromHtml('#b6a3ff'))
$face=New-Object Drawing.SolidBrush([Drawing.ColorTranslator]::FromHtml('#ede8ff'))
$p=New-Object Drawing.Drawing2D.GraphicsPath
$p.AddArc(0,0,232,232,180,90);$p.AddArc(280,0,232,232,270,90);$p.AddArc(280,280,232,232,0,90);$p.AddArc(0,280,232,232,90,90);$p.CloseFigure()
$g.FillPath($bg,$p)
$g.FillEllipse($ear,92,136,152,200);$g.FillEllipse($ear,268,136,152,200)
$g.FillEllipse($face,196,142,120,120);$g.FillRectangle($face,196,202,120,56);$g.FillEllipse($face,196,198,120,120)
$pen=New-Object Drawing.Pen($face,46)
$pen.StartCap=[Drawing.Drawing2D.LineCap]::Round;$pen.EndCap=[Drawing.Drawing2D.LineCap]::Round
$trunk=New-Object Drawing.Drawing2D.GraphicsPath
$trunk.AddLine(256,265,256,351);$trunk.AddBezier(256,351,256,398,332,398,332,351)
$g.DrawPath($pen,$trunk)
$g.FillEllipse($bg,223,217,18,18);$g.FillEllipse($bg,271,217,18,18)
$b.Save((Join-Path $root "build/brand-$size.png"),[Drawing.Imaging.ImageFormat]::Png)
$trunk.Dispose();$pen.Dispose();$p.Dispose();$bg.Dispose();$ear.Dispose();$face.Dispose();$g.Dispose();$b.Dispose()
}
Copy-Item "$root/build/brand-512.png" "$root/build/icon.png" -Force
Copy-Item "$root/build/brand-256.png" "$root/src/renderer/src/assets/elefante-icon.png" -Force
Copy-Item "$root/build/brand-32.png" "$root/build/tray.png" -Force
