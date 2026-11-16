// Scoate rețetele și ingredientele ca JSON, pentru scripturile Python (poze, CLIP).
import { RECIPES } from '../src/data/recipes';
import { BASE_INGREDIENTS } from '../src/data/ingredients';
import { GENERIC_FOODS } from '../src/data/generic_foods';
console.log(JSON.stringify({
  recipes: RECIPES.map((r) => ({ id: r.id, name: r.name, en: r.en, img: r.img, ing: r.ing })),
  ingredients: BASE_INGREDIENTS.map((i) => ({ id: i.id, name: i.name, img: i.img, staple: !!i.staple, aisle: i.aisle, pkg: i.pkg, price: i.price, unit: i.unit, gPerPiece: i.gPerPiece })),
  generic: GENERIC_FOODS.map((g) => ({ id: g.id, en: g.en })),
}));
