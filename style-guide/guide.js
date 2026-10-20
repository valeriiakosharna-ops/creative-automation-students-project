const policyUrl = document.currentScript.dataset.policyUrl;
fetch(policyUrl).then((response) => {
  if (!response.ok) throw Error("Palette unavailable");
  return response.json();
}).then((policy) => {
  const palette = document.getElementById("palette-colors");
  palette.replaceChildren();
  for (const [name, color] of Object.entries(policy.palette)) {
    const item = document.createElement("div"), swatch = document.createElement("div"), label = document.createElement("strong"), value = document.createElement("code");
    item.className = "color-card"; swatch.className = "swatch";
    swatch.style.backgroundColor = color; label.textContent = name; value.textContent = color;
    item.append(swatch, label, value); palette.append(item);
  }
}).catch(() => {}); // The HTML retains a readable palette when the JSON cannot load.
