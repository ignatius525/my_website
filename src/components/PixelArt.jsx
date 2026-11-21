// Tiny pixel-art sprites drawn as character grids and rendered to crisp SVG.
// "." is transparent; every other character maps to a palette color.

const PAL = {
  W: "#dec6ae", // wool
  L: "#f6eac6", // wool highlight / cream
  K: "#1e1e1e", // sheep face, dark
  S: "#1c1938", // night screen
  G: "#759059", // grass light
  D: "#42664e", // grass
  O: "#ffc666", // sun
  E: "#ff964e", // ember
  Y: "#ffeaae", // sun core
  R: "#ab5860", // horizon red
  B: "#966636", // wood
  N: "#ae8a5a", // wood light
};

export const SPRITES = {
  sheep: [
    "................",
    "...LLLLLL.......",
    "..LLLLLLLLL.....",
    ".LLWWWWWWWLL....",
    ".LWWWWWWWWWLKKK.",
    ".LWWWWWWWWWKKKKK",
    ".LWWWWWWWWWKLKKK",
    "..WWWWWWWWWKKKK.",
    "...WWWWWWWW.KK..",
    "...K.K..K.K.....",
    "...K.K..K.K.....",
    "................",
  ],
  // Full stack: a monitor with code on it
  monitor: [
    "................",
    ".LLLLLLLLLLLLLL.",
    ".LSSSSSSSSSSSSL.",
    ".LSGGSSSSSSSSSL.",
    ".LSSSGGGGSSSSSL.",
    ".LSSSSSSSSSSSSL.",
    ".LSGGGSSSSSSSSL.",
    ".LSSSSGGGGGSSSL.",
    ".LSSSSSSSSSSSSL.",
    ".LSOOSSSSSSSSSL.",
    ".LLLLLLLLLLLLLL.",
    "......BBBB......",
    ".....NNNNNN.....",
    "....NNNNNNNN....",
    "................",
    "................",
  ],
  // C++
  cpp: [
    "................",
    "................",
    "................",
    "...LLLLL........",
    "..LL...LL.......",
    "..LL............",
    "..LL.....O...O..",
    "..LL....OOO.OOO.",
    "..LL.....O...O..",
    "..LL............",
    "..LL...LL.......",
    "...LLLLL........",
    "................",
    "................",
    "................",
    "................",
  ],
  // Trading systems: candlestick chart
  candles: [
    "................",
    ".L..........R...",
    ".L.........RRR..",
    ".L.........RRR..",
    ".L...G.....RRR..",
    ".L..GGG.....R...",
    ".L..GGG..G......",
    ".L..GGG.GGG.....",
    ".L...G..GGG.....",
    ".L......GGG.....",
    ".L.......G......",
    ".L..............",
    ".LLLLLLLLLLLLLL.",
    "................",
    "................",
    "................",
  ],
  // Load testing: lightning bolt
  bolt: [
    "................",
    "........EEEE....",
    ".......EYYE.....",
    "......EYYE......",
    ".....EYYE.......",
    "....EYYYEEEE....",
    "...EYYYYYYYE....",
    "...EEEEEYYE.....",
    ".......EYYE.....",
    "......EYYE......",
    ".....EYYE.......",
    "....EYE.........",
    "....EE..........",
    "................",
    "................",
    "................",
  ],
};

export const PixelSprite = ({ name, size = 64, className = "", title }) => {
  const grid = SPRITES[name];
  const w = grid[0].length;
  const h = grid.length;
  const rects = [];
  grid.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch !== ".") rects.push(<rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={PAL[ch]} />);
    });
  });
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width={size}
      height={(size * h) / w}
      shapeRendering="crispEdges"
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
    >
      {title && <title>{title}</title>}
      {rects}
    </svg>
  );
};
