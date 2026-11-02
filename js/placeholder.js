const PALETTES = [
  ["#ff9a8b", "#ff6a88"],
  ["#f6d365", "#fda085"],
  ["#84fab0", "#8fd3f4"],
  ["#a1c4fd", "#c2e9fb"],
  ["#fbc2eb", "#a6c1ee"],
  ["#fdcbf1", "#e6dee9"],
  ["#d4fc79", "#96e6a1"],
  ["#f093fb", "#f5576c"],
  ["#4facfe", "#00f2fe"],
  ["#43e97b", "#38f9d7"],
];

function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function initials(name) {
  const words = String(name || "?").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

export function paletteFor(name) {
  const [from, to] = PALETTES[hashString(String(name || "")) % PALETTES.length];
  return { from, to };
}

/**
 * Gắn ảnh món vào <img>. Nếu image_url rỗng hoặc load lỗi thì ẩn <img>
 * và hiện placeholder (được render sẵn trong cùng container).
 */
export function attachDishImage(container, imageUrl, dishName) {
  const img = container.querySelector("img");
  const ph = container.querySelector(".placeholder");

  const showPlaceholder = () => {
    if (img) img.style.display = "none";
    if (ph) ph.style.display = "flex";
  };

  if (ph) {
    const { from, to } = paletteFor(dishName);
    ph.style.backgroundImage = `linear-gradient(135deg, ${from}, ${to})`;
    ph.textContent = initials(dishName);
    ph.style.display = "flex";
  }

  if (!img) return;

  if (!imageUrl) {
    showPlaceholder();
    return;
  }

  img.onerror = showPlaceholder;
  img.onload = () => {
    img.style.display = "block";
    if (ph) ph.style.display = "none";
  };
  img.src = imageUrl;
}
