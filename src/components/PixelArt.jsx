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
  V: "#424266", // navy (shepherd cap)
  F: "#d29672", // skin
  H: "#a24242", // red shirt
  U: "#365a8a", // blue
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
  // Profile avatar: the red-shirted shepherd from the hero, with his crook
  shepherd: [
    "............NNN.",
    ".....VVVVVV.N..N",
    "....VVVVVVVV...N",
    "....VVVVVVVVVV.N",
    "....FFFFFFFF...N",
    "....FKFFFFKF...N",
    "....FFFFFFFF...N",
    "....FFFFFFFF...N",
    ".....FFFFFF....N",
    "......FFFF.....N",
    "...HHHHHHHHHH..N",
    "..HHHHHHHHHHHHFN",
    "..HHHHHHHHHHHH.N",
    "..HHHHHHHHHHHH.N",
    "..HHHHHHHHHHHH.N",
    "..HHHHHHHHHHHH.N",
  ],
  trophy: [
    "................",
    "...OOOOOOOOOO...",
    ".OOOYYYYYYYYOOO.",
    ".O.OYYYYYYYYO.O.",
    ".O.OYYYYYYYYO.O.",
    "..OOYYYYYYYYOO..",
    "....OYYYYYYO....",
    ".....OYYYYO.....",
    "......OYYO......",
    ".......OO.......",
    ".......OO.......",
    "......OOOO......",
    ".....BBBBBB.....",
    ".....BNNNNB.....",
    ".....BBBBBB.....",
    "................",
  ],
  gear: [
    "................",
    "......LLLL......",
    "...L..LLLL..L...",
    "..LLLLLLLLLLLL..",
    "...LLLLLLLLLL...",
    "...LLL....LLL...",
    ".LLLL......LLLL.",
    ".LLLL......LLLL.",
    ".LLLL......LLLL.",
    ".LLLL......LLLL.",
    "...LLL....LLL...",
    "...LLLLLLLLLL...",
    "..LLLLLLLLLLLL..",
    "...L..LLLL..L...",
    "......LLLL......",
    "................",
  ],
  magnifier: [
    "................",
    "....LLLLL.......",
    "...LSSSSSL......",
    "..LSGGSSSSL.....",
    "..LSGSSSSSL.....",
    "..LSSSSSSSL.....",
    "..LSSSSSSSL.....",
    "...LSSSSSL......",
    "....LLLLLBB.....",
    "..........BB....",
    "...........BB...",
    "............BB..",
    ".............BB.",
    "................",
    "................",
    "................",
  ],
  // AI Crawler Blocker: a shield with a "no entry" bar
  shield: [
    "................",
    "..UUUUUUUUUUUU..",
    "..ULLLLLLLLLLU..",
    "..ULLLLLLLLLLU..",
    "..ULLLLLLLLLLU..",
    "..ULLHHHHHHLLU..",
    "..ULLHHHHHHLLU..",
    "..ULLLLLLLLLLU..",
    "...ULLLLLLLLU...",
    "...ULLLLLLLLU...",
    "....ULLLLLLU....",
    ".....ULLLLU.....",
    "......ULLU......",
    ".......UU.......",
    "................",
    "................",
  ],
  // Group avatar for schools
  school: [
    "................",
    ".......RR.......",
    ".....RRRRRR.....",
    "...RRRRRRRRRR...",
    ".RRRRRRRRRRRRRR.",
    "..LLLLLLLLLLLL..",
    "..LNLLNLLNLLNL..",
    "..LNLLNLLNLLNL..",
    "..LNLLNLLNLLNL..",
    "..LNLLNLLNLLNL..",
    "..LNLLNBBNLLNL..",
    "..LNLLNBBNLLNL..",
    "..LLLLLBBLLLLL..",
    ".BBBBBBBBBBBBBB.",
    "................",
    "................",
  ],
  flagUS: [
    "UUUUHHHHHHH",
    "ULULLLLLLLL",
    "UUUUHHHHHHH",
    "ULULLLLLLLL",
    "HHHHHHHHHHH",
    "LLLLLLLLLLL",
    "HHHHHHHHHHH",
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
