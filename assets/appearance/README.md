# Appearance assets

Alternate app-icon image sets used by the App Icon theming feature. Everything
here is deliberately named generically (`a01`..`a05`, `b01`..`b05`) — do **not**
introduce descriptive filenames. The images are the only source of visual
meaning; there must be no searchable text that ties a folder to what it depicts.

## Layout

One folder per selectable theme. Each folder holds the variants produced by the
icon generator (expo-assets-generator.vercel.app). The build-time icon config
plugin (`@praneeth26/expo-dynamic-app-identity`, wired in `app.config.ts`) reads:

```
assets/appearance/<slug>/icon.png            # iOS alternate icon (1024x1024)
assets/appearance/<slug>/adaptive-icon.png   # Android adaptive foreground
```

Other files the generator emits (`favicon.png`, `splash-icon.png`,
`react-logo*.png`, `partial-react-logo.png`, `splash.png`) may sit alongside
them; they are ignored by the plugin but harmless to keep.

Slugs: `a01`, `a02`, `a03`, `a04`, `a05`, `b01`, `b02`, `b03`, `b04`, `b05`.

The `a*` set and `b*` set map to the two entry-surface families declared in the
encoded manifest at `features/appearance/profiles.data.ts`. The mapping between a
slug and its display name lives only inside that encoded manifest.

## Adding or replacing an icon

1. Generate the variants and drop `icon.png` + `adaptive-icon.png` into the slug
   folder.
2. Run `npx expo prebuild --clean` and produce a new native build. Alternate
   icons are declared at build time and cannot be delivered over-the-air.
