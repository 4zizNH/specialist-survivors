# Character art

Generated concept art for the game's roster, organized one subfolder per
character (matching each character's `id` in `src/data/characters.js`):

```
assets/characters/
├── ember-knight/
├── riven/
├── deadeye/
├── junker/
├── arcanist/
└── thornweaver/
```

## During art-direction exploration

While comparing styles/models for a character, name files descriptively so
multiple candidates can sit side by side, e.g.:

```
ember-knight/ember-knight-pixel-art-nanobananapro.png
ember-knight/ember-knight-flat-vector-nanobananapro.png
ember-knight/ember-knight-flat-vector-gptimage2.png
```

## Once a style is finalized

Keep only the winning file per character, renamed to just `<id>.png`
(e.g. `ember-knight/ember-knight.png`), and remove the rejected candidates —
this folder should hold shipped assets, not the full exploration history.
