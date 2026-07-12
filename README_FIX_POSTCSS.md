# ASR Iron Vite/PostCSS Fix

This fixes the error:

`It looks like you're trying to use tailwindcss directly as a PostCSS plugin.`

## Replace in project root

- `postcss.config.js`
- `tailwind.config.js`

## Then restart Vite

```bash
Ctrl + C
npm run dev
```

If the browser still shows the same overlay, stop Vite and clear the Vite cache:

```bash
Ctrl + C
rmdir /s /q node_modules\.vite
npm run dev
```

This project is currently using plain CSS from `src/styles.css`, so Tailwind does not need to run through PostCSS.
