import { useEffect, useRef, useState } from 'react';

import { SubwayMapController } from './controller.js';

/*
 * The live map with its HUD and legend. Lazy-loaded by components/Subway.jsx,
 * so MapLibre, the engine and the network data are only fetched once a
 * visitor scrolls to the section.
 */

const Hud = ({ hud }) => {
  const live = hud.total > 0;
  return (
    <div className="absolute top-3 left-3 z-10 pointer-events-none bg-night/90 pixel-frame
      px-3 py-2 sm:px-4 sm:py-3 max-w-[60%]"
      style={{ '--px': '3px' }}>
      <p className="flex items-baseline gap-2">
        <span className="font-pixel text-sun text-[15px] sm:text-[20px]">
          {live ? (hud.shown === hud.total ? hud.total : `${hud.shown}/${hud.total}`) : '...'}
        </span>
        <span className="text-secondary text-[12px] sm:text-[14px] uppercase tracking-wider">trains live</span>
      </p>
      <p className="text-secondary text-[12px] sm:text-[13px] mt-1">
        {hud.ageSeconds == null ? 'Fetching MTA feeds...' : `Feeds polled ${hud.ageSeconds}s ago`}
      </p>
      {hud.feeds.length > 0 && (
        <ul className="hidden sm:grid grid-cols-4 gap-x-3 gap-y-0.5 mt-2" aria-label="Feed status">
          {hud.feeds.map((f) => (
            <li key={f.id} className="text-[11px] text-secondary flex items-center gap-1" title={f.ok ? 'ok' : f.error}>
              <span
                className={`inline-block w-[6px] h-[6px] ${!f.ok ? 'bg-horizon' : f.stale ? 'bg-ember' : 'bg-grass-light'}`}
                aria-hidden="true"
              />
              {f.label}
              <span className="sr-only">{f.ok ? (f.stale ? ' stale' : ' ok') : ' failing'}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const Legend = ({ legend, onPick }) => (
  <div className="absolute bottom-14 sm:bottom-8 left-3 z-10 bg-night/90 pixel-frame p-2 max-w-[calc(100%-24px)] sm:max-w-[280px]"
    style={{ '--px': '3px' }}>
    <p className="sr-only">Lines: pick one to show only it, pick it again to show all.</p>
    <ul className="flex flex-wrap gap-[5px]">
      {legend.map((b) => (
        <li key={b.routes.join(',')}>
          <button
            type="button"
            onClick={() => onPick(b.routes)}
            aria-pressed={!b.off}
            title={`${b.names.join(' / ')}: show only this line`}
            className={`min-w-[22px] h-[22px] px-[3px] font-pixel text-[9px] grid place-items-center
              transition-opacity hover:brightness-125 focus-visible:outline focus-visible:outline-2
              focus-visible:outline-sun ${b.off ? 'opacity-40' : ''}`}
            style={b.off
              ? { color: b.colour, boxShadow: `inset 0 0 0 2px ${b.colour}` }
              : { background: b.colour, color: b.text }}
          >
            {b.badge}
          </button>
        </li>
      ))}
    </ul>
  </div>
);

const SubwayMap = () => {
  const shellRef = useRef(null);
  const mapRef = useRef(null);
  const ctrlRef = useRef(null);
  const [hud, setHud] = useState({ ready: false, total: 0, shown: 0, ageSeconds: null, feeds: [], legend: [], error: '' });
  const [fatal, setFatal] = useState('');

  useEffect(() => {
    let onScreen = false;
    const ctrl = new SubwayMapController({
      container: mapRef.current,
      fullscreenTarget: shellRef.current,
      onUpdate: setHud,
    });
    ctrlRef.current = ctrl;
    const sync = () => ctrl.setActive(onScreen && !document.hidden);

    // Poll and animate only while the map is on screen and the tab visible.
    const io = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      sync();
    }, { threshold: 0.05 });
    io.observe(shellRef.current);
    document.addEventListener('visibilitychange', sync);

    ctrl.start().catch((err) => {
      console.warn('subway map:', err);
      setFatal(err && err.webgl
        ? 'The live map could not start in this browser (it needs WebGL 2).'
        : 'The live map could not load. Try refreshing the page.');
    });

    return () => {
      io.disconnect();
      document.removeEventListener('visibilitychange', sync);
      ctrl.destroy();
    };
  }, []);

  return (
    <div ref={shellRef} className="subway-shell relative w-full h-[72vh] min-h-[420px] max-h-[780px] pixel-frame bg-night overflow-hidden">
      {/* Sized with w/h-full: MapLibre's CSS forces position: relative on this element. */}
      <div ref={mapRef} className="subway-map w-full h-full" />
      {!fatal && <Hud hud={hud} />}
      {hud.legend.length > 0 && !fatal && (
        <Legend legend={hud.legend} onPick={(ids) => ctrlRef.current && ctrlRef.current.legendClick(ids)} />
      )}
      {!hud.ready && !fatal && (
        <div className="absolute inset-0 grid place-items-center pointer-events-none">
          <p className="font-pixel text-sun text-[12px] sm:text-[14px] pixel-shadow animate-pulse">Rounding up trains...</p>
        </div>
      )}
      {fatal && (
        <div className="absolute inset-0 grid place-items-center p-6 text-center">
          <p className="text-secondary text-[16px] max-w-sm">{fatal}</p>
        </div>
      )}
      {hud.error && !fatal && (
        <p role="status" className="absolute z-10 bg-night/90 border-2 border-horizon text-wool text-[12px] px-2 py-1
          left-3 right-14 top-[92px] sm:left-auto sm:top-3 sm:max-w-[45%]">
          {hud.error}
        </p>
      )}
    </div>
  );
};

export default SubwayMap;
