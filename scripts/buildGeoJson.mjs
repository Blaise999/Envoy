// Converts the generated city module into a compact static JSON asset
// (public/geo-cities.json) that is fetched lazily at runtime instead of
// being bundled as a JS chunk. Shape: { "City, CC": [lat, lon] }.
import { CITY_COORDS_FROM_CSV } from "../src/utils/geoDb.cities.generated.js";
import { writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const out = {};
let n = 0;
for (const [k, v] of Object.entries(CITY_COORDS_FROM_CSV)) {
  if (v && typeof v.lat === "number" && typeof v.lon === "number") {
    out[k] = [v.lat, v.lon];
    n++;
  }
}
const dest = resolve(__dirname, "../public/geo-cities.json");
writeFileSync(dest, JSON.stringify(out));
console.log("wrote", dest, "entries:", n);
