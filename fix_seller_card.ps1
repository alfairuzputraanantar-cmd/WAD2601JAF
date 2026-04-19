$path  = 'C:\Users\alfai\OneDrive\Desktop\WADAUCTION\script.js'
$lines = [System.IO.File]::ReadAllLines($path, [System.Text.Encoding]::UTF8)

$before = $lines[0..385]
$after  = $lines[397..($lines.Length - 1)]

$middle = @(
  "  if (data.type === 'product') {",
  "    // Inline Food Card: right-floated in seller chat timeline",
  "    el.className = 'msg-row msg-row-seller';",
  "    el.innerHTML =",
  "      '<div class=""seller-food-card-inline"">' +",
  "      '<p class=""seller-food-card-badge"">Food Card Sent</p>' +",
  "      '<p class=""seller-food-card-name"">' + escapeHtml(data.name || '') + '</p>' +",
  "      (data.info ? '<p class=""seller-food-card-desc"">' + escapeHtml(data.info) + '</p>' : '') +",
  "      '<p class=""seller-food-card-price"">Rp ' + (data.price || 0).toLocaleString() + '</p>' +",
  "      (data.stock != null ? '<p class=""seller-food-card-stock"">' + (data.stock > 0 ? data.stock + ' in stock' : 'Out of stock') + '</p>' : '') +",
  "      '<span class=""msg-time"" style=""color:rgba(212,175,55,0.5);"">' + time + '</span>' +",
  "      '</div>';"
)

$newLines = $before + $middle + $after
[System.IO.File]::WriteAllLines($path, $newLines, [System.Text.Encoding]::UTF8)
Write-Host "Done - lines 387-397 replaced."
