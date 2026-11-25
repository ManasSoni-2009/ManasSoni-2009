import opentype from 'opentype.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import fsSync from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function resolveFont(bundledRel, fontsourceRel) {
  const bundled = path.join(ROOT, 'fonts', bundledRel);
  if (fsSync.existsSync(bundled)) return bundled;
  const ghBundled = path.join(ROOT, 'github-profile', 'fonts', bundledRel);
  if (fsSync.existsSync(ghBundled)) return ghBundled;
  return path.join(ROOT, 'node_modules', '@fontsource', fontsourceRel);
}

const FONT_FILES = {
  anton: resolveFont('anton-latin-400-normal.woff', 'anton/files/anton-latin-400-normal.woff'),
  syneBold: resolveFont('syne-latin-800-normal.woff', 'syne/files/syne-latin-800-normal.woff'),
  mono: resolveFont('jetbrains-mono-latin-400-normal.woff', 'jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff'),
  italic: resolveFont('cormorant-garamond-latin-400-italic.woff', 'cormorant-garamond/files/cormorant-garamond-latin-400-italic.woff'),
  spaceBold: resolveFont('space-grotesk-latin-700-normal.woff', 'space-grotesk/files/space-grotesk-latin-700-normal.woff'),
};

const loadedFonts = {};

export async function loadVectorFonts() {
  if (Object.keys(loadedFonts).length > 0) return loadedFonts;
  for (const [key, filePath] of Object.entries(FONT_FILES)) {
    loadedFonts[key] = await opentype.load(filePath);
  }
  return loadedFonts;
}

/**
 * Converts text directly to pure mathematical SVG <path> outlines so GitHub's strict
 * camo image proxy renders exact typography with zero external font dependency.
 */
export function textToPath(font, text, x, y, fontSize, opts = {}) {
  const { fill = '#FFFFFF', opacity = 1, align = 'left', letterSpacing = 0 } = opts;
  const scale = fontSize / font.unitsPerEm;
  const glyphs = font.stringToGlyphs(text);

  let totalAdvance = 0;
  const advances = glyphs.map((g, idx) => {
    const adv = (g.advanceWidth || 0) * scale + (idx < glyphs.length - 1 ? letterSpacing : 0);
    totalAdvance += adv;
    return adv;
  });

  let cursorX = x;
  if (align === 'center') cursorX -= totalAdvance / 2;
  if (align === 'right') cursorX -= totalAdvance;

  let pathData = '';
  glyphs.forEach((glyph, idx) => {
    const p = glyph.getPath(cursorX, y, fontSize);
    pathData += p.toPathData(2);
    cursorX += advances[idx];
  });

  return `<path d="${pathData}" fill="${fill}" fill-opacity="${opacity}"/>`;
}

/**
 * Wraps multi-line copy neatly and renders each line via textToPath.
 */
export function wrapTextToPaths(font, text, x, startY, fontSize, lineHeight, maxWidth, opts = {}) {
  const words = text.split(/\s+/);
  const scale = fontSize / font.unitsPerEm;
  const lines = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    const width = font.getAdvanceWidth(candidate, fontSize) + (candidate.length * (opts.letterSpacing || 0));
    if (width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);

  // Use scale implicitly in textToPath; keep lint quiet
  void scale;

  return lines
    .map((line, i) => textToPath(font, line, x, startY + i * lineHeight, fontSize, opts))
    .join('\n');
}

/**
 * Renders a bespoke Ref-3 Chiaroscuro Architectural Poster Card SVG for each flagship repository.
 */
export function buildProjectCardSvg(fonts, project, idx) {
  const W = 446;
  const H = 124;
  const lightSlope = idx % 2 === 0 ? 'M260 0 L446 0 L446 124 L185 124 Z' : 'M0 0 L210 0 L130 124 L0 124 Z';
  const accentGradId = `chiaro_${project.id}`;

  const titlePath = textToPath(fonts.syneBold, project.title, 22, 40, 16.5, {
    fill: '#F5F5F5',
    letterSpacing: 0.9,
  });

  const indexWatermark = textToPath(fonts.anton, project.index, 424, 102, 76, {
    fill: '#FFFFFF',
    opacity: 0.06,
    align: 'right',
  });

  const stackPath = textToPath(fonts.mono, project.stack, 22, 20, 8.0, {
    fill: '#8E8E8E',
    letterSpacing: 1.4,
  });

  const catTag = textToPath(fonts.mono, `${project.index} // ${project.category === 'AGENTIC SYSTEMS' ? 'AGENTIC' : 'APPLIED AI'}`, 424, 20, 7.8, {
    fill: '#B5B5B5',
    align: 'right',
    letterSpacing: 1.3,
  });

  const descPaths = wrapTextToPaths(fonts.italic, project.tagline, 22, 66, 15.0, 17.5, 365, {
    fill: '#C4C4C4',
  });

  const ctaPath = textToPath(fonts.mono, 'INSPECT REPOSITORY ->', 22, 111, 7.5, {
    fill: '#7E7E7E',
    letterSpacing: 1.6,
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <defs>
    <linearGradient id="${accentGradId}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.065"/>
      <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0.008"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="#070707"/>
  <path d="${lightSlope}" fill="url(#${accentGradId})"/>
  <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" fill="none" stroke="#222222" stroke-width="1"/>
  <line x1="22" y1="47" x2="424" y2="47" stroke="#1E1E1E" stroke-width="1"/>
  ${indexWatermark}
  ${stackPath}
  ${catTag}
  ${titlePath}
  ${descPaths}
  ${ctaPath}
</svg>`;
}

/**
 * Generates Plate 04 Live Architectural Telemetry Matrix SVG (Ref 3 + Ref 7 inspired).
 */
export function buildLiveTelemetrySvg(fonts, telemetry) {
  const W = 900;
  const H = 132;
  const bars = telemetry.activityBars || [4, 7, 5, 9, 8, 6, 10, 7, 5, 8, 9, 11, 6, 8, 10, 12, 9, 7, 10, 8, 11, 9, 12, 10];
  const maxBar = Math.max(...bars, 1);
  const stackLine = `STACK: ${telemetry.topLanguages.slice(0, 3).join(' · ')}   //   SYNC: ${telemetry.updatedDate}`;

  const barRects = bars
    .map((val, i) => {
      const x = 492 + i * 15.8;
      const barH = Math.max(4, Math.round((val / maxBar) * 44));
      const y = 84 - barH;
      const opacity = (0.32 + (val / maxBar) * 0.68).toFixed(2);
      return `<rect x="${x}" y="${y}" width="8.5" height="${barH}" fill="#F4F4F4" fill-opacity="${opacity}"/>`;
    })
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="#050505"/>
  <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" fill="none" stroke="#1F1F1F" stroke-width="1"/>
  <!-- Hazard corner accent matching Ref 7 -->
  <rect x="18" y="18" width="6" height="96" fill="#F4F4F4"/>
  ${textToPath(fonts.mono, 'LIVE REPOSITORY TELEMETRY // AUTOMATED SYNC', 42, 32, 8.2, { fill: '#888888', letterSpacing: 1.5 })}
  ${textToPath(fonts.anton, `${String(telemetry.publicRepos).padStart(2, '0')} REPOSITORIES`, 42, 74, 30, { fill: '#F5F5F5', letterSpacing: 0.6 })}
  ${textToPath(fonts.mono, stackLine, 42, 104, 7.6, { fill: '#B5B5B5', letterSpacing: 0.9 })}

  <line x1="464" y1="18" x2="464" y2="114" stroke="#1D1D1D" stroke-width="1"/>
  ${textToPath(fonts.mono, 'CADENCE SIGNAL // 24-DAY MOMENTUM', 492, 32, 8.2, { fill: '#888888', letterSpacing: 1.5 })}
  ${barRects}
  ${textToPath(fonts.mono, `STARS INDEXED: ${telemetry.totalStars}   ·   BUILDING ENTHUSIASTIC SYSTEMS`, 492, 104, 7.6, { fill: '#9E9E9E', letterSpacing: 1.0 })}
</svg>`;
}

/**
 * Generates Plate 05 Calligraffiti & Open-Source Collaboration Banner SVG (Ref 6).
 */
export function buildCollabBannerSvg(fonts, profileMeta) {
  const W = 900;
  const H = 228;

  const calligraffitiRight = `
  <g transform="translate(692, -10) scale(0.95, 0.33)" fill="none">
    <path d="M185 -10 L70 95 L98 118 L218 12 Z" fill="#F4F4F4"/>
    <path d="M98 118 L52 162 L76 184 L126 140 Z" fill="#F4F4F4"/>
    <path d="M92 78 L195 -4 M102 88 L206 6" stroke="#050505" stroke-width="2.2"/>
    <path d="M108 18 C135 55, 165 92, 198 130 L172 152 C142 114, 114 78, 86 40 Z" fill="#F4F4F4"/>
    <path d="M128 135 L168 105 L168 258 L128 288 Z" fill="#F4F4F4"/>
    <path d="M142 128 L142 276 M152 120 L152 268" stroke="#050505" stroke-width="2.2"/>
    <path d="M58 190 L188 118 L204 142 L74 214 Z" fill="#F4F4F4"/>
    <path d="M84 226 C40 245, 42 295, 78 320 C56 286, 62 256, 98 242 Z" fill="#F4F4F4"/>
    <path d="M82 308 L138 274 L176 378 L120 412 Z" fill="#F4F4F4"/>
    <path d="M98 302 L134 398 M110 295 L146 391" stroke="#050505" stroke-width="2.2"/>
    <path d="M44 378 L194 292 L212 318 L62 404 Z" fill="#F4F4F4"/>
    <path d="M148 395 L196 365 L196 520 L148 550 Z" fill="#F4F4F4"/>
    <path d="M162 390 L162 536 M174 382 L174 528" stroke="#050505" stroke-width="2.2"/>
    <path d="M78 518 L142 480 L185 604 L122 642 Z" fill="#F4F4F4"/>
    <path d="M96 510 L138 628 M110 502 L152 620" stroke="#050505" stroke-width="2.2"/>
    <path d="M104 646 L216 582 L216 620 L104 684 Z" fill="#F4F4F4"/>
    <path d="M72 706 L178 648 L198 765 L154 765 L136 692 L88 724 Z" fill="#F4F4F4"/>
  </g>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="#050505"/>
  <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" fill="none" stroke="#1E1E1E" stroke-width="1"/>
  <line x1="686" y1="0" x2="686" y2="${H}" stroke="#1E1E1E" stroke-width="1"/>
  ${calligraffitiRight}
  ${textToPath(fonts.mono, '05 // OPEN SOURCE DISPATCH & RESEARCH', 36, 40, 9.2, { fill: '#888888', letterSpacing: 2.1 })}
  ${textToPath(fonts.anton, 'OPEN TO ARCHITECTURAL', 36, 98, 44, { fill: '#F5F5F5', letterSpacing: 0.6 })}
  ${textToPath(fonts.anton, 'COLLABORATION', 36, 146, 44, { fill: '#F5F5F5', letterSpacing: 0.6 })}
  ${wrapTextToPaths(fonts.italic, profileMeta.colophonFooter.statement, 36, 184, 17, 21, 610, { fill: '#BDBDBD' })}
</svg>`;
}

/**
 * Generates crisp 2-column architectural header strip sitting above the 2x4 clickable works grid.
 */
export function buildWorksHeaderSvg(fonts) {
  const W = 900;
  const H = 40;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="#050505"/>
  <line x1="0" y1="39.5" x2="${W}" y2="39.5" stroke="#222222" stroke-width="1"/>
  <line x1="450" y1="8" x2="450" y2="39" stroke="#1E1E1E" stroke-width="1"/>
  ${textToPath(fonts.mono, 'I // AGENTIC SYSTEMS & CORE INFRASTRUCTURE', 4, 26, 9.0, { fill: '#D8D8D8', letterSpacing: 1.8 })}
  ${textToPath(fonts.mono, 'II // CREATIVE & APPLIED INTELLIGENCE', 456, 26, 9.0, { fill: '#D8D8D8', letterSpacing: 1.8 })}
</svg>`;
}

/**
 * Generates crisp clickable vector dispatch buttons for Plate 05 bottom strip.
 */
export function buildContactTileSvg(fonts, anchor) {
  const W = 221;
  const H = 68;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="#070707"/>
  <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" fill="none" stroke="#262626" stroke-width="1"/>
  <rect x="0" y="0" width="4" height="${H}" fill="#EAEAEA"/>
  ${textToPath(fonts.mono, `${anchor.code} // ${anchor.label}`, 18, 25, 8.5, { fill: '#858585', letterSpacing: 1.8 })}
  ${textToPath(fonts.spaceBold, anchor.handle, 18, 48, 11.2, { fill: '#F5F5F5', letterSpacing: 0.4 })}
</svg>`;
}
