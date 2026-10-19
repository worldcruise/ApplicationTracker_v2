# Built-in layout samples

These PNGs show page one of the same synthetic resume rendered by each pinned built-in preset, using the bundled licensed Noto Sans assets. They contain fictional data only. The actual candidate PDF is generated separately; changing a template clears any stale draft preview.

Regenerate deliberately from the repository root with `npm run resume:thumbnails`. The command runs the renderer verification and writes these nine images. Normal `resume:verify` writes only ignored QA artifacts. Custom template versions use the actual PDF preview after generation; the built-in thumbnails are not substituted for a customized layout.
