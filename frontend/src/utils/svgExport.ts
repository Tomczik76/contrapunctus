export async function svgToPngBase64(
  svgElement: SVGSVGElement,
  targetWidth = 1200,
  targetHeight = 630
): Promise<string> {
  // 1. Clone the SVG
  const clone = svgElement.cloneNode(true) as SVGSVGElement;

  // 2. Set explicit dimensions and namespace
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");

  // 3. Add white background rect as first child
  const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  bg.setAttribute("width", "100%");
  bg.setAttribute("height", "100%");
  bg.setAttribute("fill", "white");
  clone.insertBefore(bg, clone.firstChild);

  // 4. Remove foreignObject elements (HTML inputs won't serialize)
  clone.querySelectorAll("foreignObject").forEach(el => el.remove());

  // 5. Get the SVG's viewBox to maintain aspect ratio, cropping to export width if available
  const viewBox = svgElement.viewBox?.baseVal;
  const exportWidth = parseFloat(svgElement.getAttribute("data-export-width") || "0");
  const fullW = viewBox?.width || svgElement.clientWidth || targetWidth;
  const svgW = exportWidth > 0 && exportWidth < fullW ? exportWidth : fullW;
  const svgH = viewBox?.height || svgElement.clientHeight || targetHeight;

  // Update the clone's viewBox to crop out the extra editing measure
  if (exportWidth > 0 && exportWidth < fullW) {
    clone.setAttribute("viewBox", `0 0 ${svgW} ${svgH}`);
  }
  const scale = Math.min(targetWidth / svgW, targetHeight / svgH);
  const renderW = Math.round(svgW * scale);
  const renderH = Math.round(svgH * scale);

  clone.setAttribute("width", String(renderW));
  clone.setAttribute("height", String(renderH));

  // 6. Serialize to string and replace currentColor with black
  // (img-rendered SVGs don't inherit CSS color, so currentColor resolves to transparent)
  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(clone).replace(/currentColor/g, "#000000");

  // 8. Create Image from SVG blob
  const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const img = new Image();
  img.width = renderW;
  img.height = renderH;

  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = url;
  });

  // 9. Draw to canvas (use target dimensions, center the score)
  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, targetWidth, targetHeight);
  const offsetX = Math.round((targetWidth - renderW) / 2);
  const offsetY = Math.round((targetHeight - renderH) / 2);
  ctx.drawImage(img, offsetX, offsetY, renderW, renderH);
  URL.revokeObjectURL(url);

  // Return base64 without the data URL prefix
  return canvas.toDataURL("image/png").split(",")[1];
}
