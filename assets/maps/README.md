# Denizli çizgisel şehir haritası

`denizli-roads.svg`, gerçek OpenStreetMap yol geometrisinden üretilmiş, kuzeyi yukarı bakan bir Mercator çizimidir. Yer adları, bina dolguları ve işaretler içermez. Ana sayfa ile Denizli sayfasında ekrana sabittir; sıralama görünümlerinde gizlenir.

- Kaynak: OpenStreetMap katkıda bulunanlar, Overpass API.
- Alınma tarihi: 30 Eylül 2026.
- Alan: güney 37.69, batı 29.00, kuzey 37.86, doğu 29.22. Denizli merkezinin seçilmiş bir kesitidir; il sınırı değildir.
- Yol sayısı: 12.648. Sokak, toplayıcı ve ana arter çizgileri ayrı yoğunlukta çizilir.
- Veri lisansı: [Open Database License (ODbL)](https://www.openstreetmap.org/copyright). Kaynak atfı sitenin alt bölümündedir ve SVG açıklamasında da bulunur.
- Ham Overpass çıktısı yerel `.backups/denizli-roads-source.json` dosyasına kaydedildi. Yeniden üretim: `node scripts/build-denizli-map.cjs .backups/denizli-roads-source.json`.
- Projeksiyon sonrası ara noktalar yaklaşık 3 metreden az sapma ile sadeleştirildi; çizim 512.230 bayttır.

Sorgu:

```overpass
[out:json][timeout:40];
way["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street)(_link)?$"](37.69,29.00,37.86,29.22);
out geom;
```

Renk, yoğunluk, merkezdeki solma ve mobil ölçü `css/city-map.css` içindedir. Harita yereldir; ziyaret sırasında OpenStreetMap'e ağ isteği yapılmaz. `build.cjs`, harita dosyasını `dist/assets/` içine kopyalar.

Uygulama öncesi kaynak yedeği: `.backups/before-denizli-map-20260930-141648.zip` (43 dosya/dizin girdisi doğrulandı).
