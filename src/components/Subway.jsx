import { Component, lazy, Suspense, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

import { styles } from '../styles';
import { SectionWrapper } from '../hoc';
import { fadeIn, textVariant } from '../utils/motion';

// MapLibre (~300 kB gzipped), the engine worker and the network data load only
// when a visitor gets near this section, never with the rest of the page.
const SubwayMap = lazy(() => import('../subway/map/SubwayMap.jsx'));

const Placeholder = ({ text }) => (
  <div className="w-full h-[72vh] min-h-[420px] max-h-[780px] pixel-frame bg-night grid place-items-center p-6 text-center">
    <p className="font-pixel text-sun text-[12px] sm:text-[14px] pixel-shadow">{text}</p>
  </div>
);

/* A failed chunk download (offline, deploy mid-visit) shows a message instead
 * of taking the whole page down with it. */
class MapBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() { return { failed: true }; }

  componentDidCatch(err) { console.warn('subway map failed to load:', err); }

  render() {
    if (this.state.failed) return <Placeholder text="The live map failed to load. Try refreshing." />;
    return this.props.children;
  }
}

const Subway = () => {
  const ref = useRef(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setNear(true);
        io.disconnect();
      }
    }, { rootMargin: '300px 0px' });
    io.observe(ref.current);
    return () => io.disconnect();
  }, []);

  return (
    <>
      <motion.div variants={textVariant()}>
        <p className={styles.sectionSubText}>Live project</p>
        <h2 className={styles.sectionHeadText}>NYC Subway.</h2>
      </motion.div>

      <motion.p
        variants={fadeIn('', '', 0.1, 1)}
        className="mt-4 text-secondary text-[17px] max-w-3xl leading-[30px]"
      >
        Every train on the New York subway, live. The MTA&apos;s realtime feeds carry no
        coordinates at all, only the next stop and a predicted arrival, so each
        train&apos;s position is rebuilt from the track geometry and animated between
        updates. It all runs in your browser: click a sheep for its next stop, or a
        line in the legend to follow just that one.
      </motion.p>

      <div ref={ref} className="mt-10">
        <MapBoundary>
          {near ? (
            <Suspense fallback={<Placeholder text="Rounding up trains..." />}>
              <SubwayMap />
            </Suspense>
          ) : <Placeholder text="Rounding up trains..." />}
        </MapBoundary>
      </div>

      <p className="mt-3 text-secondary text-[13px]">
        Train data: MTA GTFS-realtime feeds, polled once a minute while the map is on screen.
        Map: OpenFreeMap, OpenMapTiles, OpenStreetMap contributors.
      </p>
    </>
  );
};

export default SectionWrapper(Subway, 'subway');
