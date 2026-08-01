# Study tab images

Optional. Drop image files in here and the matching slot in the Study tab
picks them up on next load. Any slot whose file is missing removes itself,
so leaving this folder empty is fine — the sections read normally without
them.

Filenames the Study tab looks for:

| File                 | Section   | Caption                     |
|----------------------|-----------|-----------------------------|
| `energy-balance.jpg` | Nutrition | Energy balance              |
| `protein-sources.jpg`| Nutrition | Protein sources             |
| `fats.jpg`           | Nutrition | Dietary fats                |
| `carbs.jpg`          | Nutrition | Carbohydrate sources        |
| `muscle-fibre.jpg`   | Anatomy   | Skeletal muscle structure   |

Any web image format the browser can render works — swap the extension in
`apps/workout/study.js` if you use `.png` or `.webp`.
