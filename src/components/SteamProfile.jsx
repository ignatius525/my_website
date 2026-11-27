import { useMemo } from 'react';
import { motion } from 'framer-motion';

import { styles } from '../styles';
import { experiences, profile, projects } from '../constants';
import { SectionWrapper } from '../hoc';
import { fadeIn, textVariant } from '../utils/motion';
import { PixelSprite } from './PixelArt';

// Work experience as a Steam-style gamer profile, in the site's pixel theme.
// Jobs are "games", resume bullets are "achievements". Layout only: no Valve
// logos or wordmarks. Content lives in constants (experiences, profile, projects).

/* ------------------------------------------------------------- helpers -- */

const HOURS_PER_WEEK = 40;
const parseYM = (ym) => {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1);
};
const endOfMonth = (d) => new Date(d.getFullYear(), d.getMonth() + 1, 0);
const monthLabel = (ym) => parseYM(ym).toLocaleString('en-US', { month: 'short', year: 'numeric' });
const fmt = (n) => n.toLocaleString('en-US');

/** Estimated hours at ~40 hrs/week between the start month and the end month (or now). */
const hoursOnRecord = (exp, now) => {
  const start = parseYM(exp.start);
  const end = exp.end ? endOfMonth(parseYM(exp.end)) : now;
  return Math.max(0, Math.round(((end - start) / (7 * 864e5)) * HOURS_PER_WEEK));
};

/** Dark text on light logo tiles, cream text on dark ones. */
const textOn = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.55 ? '#1c1938' : '#f6eac6';
};

/* -------------------------------------------------------------- pieces -- */

const Panel = ({ title, right, children, index = 0 }) => (
  <motion.section
    variants={fadeIn('up', 'spring', index * 0.1, 0.6)}
    className="bg-black-100/90 shadow-card"
  >
    <div className="bg-hedge px-4 py-2 flex justify-between items-baseline gap-4">
      <h3 className="text-white-100 text-[18px] font-semibold">{title}</h3>
      {right && <span className="text-secondary text-[15px]">{right}</span>}
    </div>
    <div className="p-4">{children}</div>
  </motion.section>
);

/** A job's "game header" capsule: the company logo tile with the game name. */
const GameCapsule = ({ exp, large = false }) => (
  <div
    className={`flex items-center gap-3 shrink-0 pixel-frame-plum pixel-frame
    ${large ? 'w-full sm:w-[300px] h-[140px] px-5' : 'w-[150px] sm:w-[184px] h-[69px] px-3'}`}
    style={{ background: exp.iconBg, color: textOn(exp.iconBg) }}
  >
    <img
      src={exp.icon}
      alt=""
      className={`${large ? 'w-16 h-16' : 'w-9 h-9'} object-contain shrink-0`}
    />
    <span className={`font-pixel leading-snug ${large ? 'text-[16px]' : 'text-[10px] sm:text-[11px]'}`}>
      {exp.game}
    </span>
  </div>
);

const AchievementIcon = ({ icon, title, size = 40 }) => (
  <span
    className="inline-flex items-center justify-center bg-night pixel-frame"
    style={{ '--px': '2px', '--frame': '#ffc666', width: size, height: size }}
    title={title}
  >
    <PixelSprite name={icon} size={size - 10} />
  </span>
);

/** Segmented "Achievement Progress" bar. */
const Progress = ({ value, max }) => (
  <div className="flex gap-[3px]" role="img" aria-label={`${value} of ${max} achievements`}>
    {Array.from({ length: max }, (_, i) => (
      <span key={i} className={`h-2 flex-1 ${i < value ? 'bg-sun' : 'bg-plum'}`} />
    ))}
  </div>
);

/* -------------------------------------------------------------- header -- */

const Header = ({ level }) => (
  <motion.header
    variants={fadeIn('down', 'spring', 0, 0.6)}
    className="flex flex-col sm:flex-row gap-6 sm:items-start"
  >
    <div
      className="w-[136px] h-[136px] shrink-0 pixel-frame pixel-frame-sun bg-gradient-to-b
      from-plum to-horizon flex items-end justify-center overflow-hidden"
    >
      <PixelSprite name="shepherd" size={120} title="Pixel-art shepherd avatar" />
    </div>

    <div className="flex-1 min-w-0">
      <p className="text-white-100 text-[30px] font-semibold leading-tight pixel-shadow">{profile.name}</p>
      <p className="text-secondary text-[17px] mt-1 flex items-center gap-2 flex-wrap">
        {profile.realName}
        <PixelSprite name="flagUS" size={22} title="United States" />
        {profile.location}
      </p>
      <p className="text-wool text-[17px] mt-4 max-w-xl">{profile.summary}</p>
      {/* the sidebar's Friends sit at the very bottom on phones, so surface the links here too */}
      <ul className="lg:hidden mt-4 flex gap-3" aria-label="Contact links">
        {profile.friends.map((f) => (
          <li key={f.url}>
            <a href={f.url} target="_blank" rel="noopener noreferrer"
              className="inline-block bg-plum hover:bg-horizon text-white-100 text-[15px] px-3 py-1 pixel-frame"
              style={{ '--px': '2px', '--frame': '#ffc666' }}>
              {f.name}
            </a>
          </li>
        ))}
      </ul>
    </div>

    <div className="sm:w-[280px] shrink-0">
      <p className="text-white-100 text-[26px] flex items-center gap-3">
        Level
        <span className="font-pixel text-[16px] text-sun px-3 py-2 pixel-frame pixel-frame-sun bg-night">
          {level}
        </span>
      </p>
      <div className="mt-3 bg-night/80 p-3 flex items-center gap-3">
        <AchievementIcon icon="trophy" title="Years of Service" size={44} />
        <div>
          <p className="text-white-100 text-[16px] leading-tight">Years of Service</p>
          <p className="text-secondary text-[14px]">
            {level} {level === 1 ? 'year' : 'years'} in industry
          </p>
        </div>
      </div>
    </div>
  </motion.header>
);

/* ------------------------------------------------------------- sidebar -- */

const Sidebar = ({ current }) => (
  <motion.aside
    variants={fadeIn('left', 'spring', 0.2, 0.6)}
    className="bg-black-100/90 p-5 flex flex-col gap-7 self-start shadow-card"
  >
    <div>
      <p className="text-grass-light text-[22px]">Currently In-Game</p>
      {current && <p className="text-grass-light text-[17px] mt-1">{current.game}</p>}
    </div>

    <div>
      <p className="text-white-100 text-[18px]">
        Badges <span className="text-secondary text-[22px] ml-1">{profile.skills.length}</span>
      </p>
      <ul className="mt-3 flex flex-wrap gap-2" aria-label="Skills">
        {profile.skills.map((skill) => (
          <li key={skill} className="bg-plum text-white-100 text-[14px] px-2 py-1 pixel-frame"
            style={{ '--px': '2px', '--frame': '#665a7e' /* cloud */ }}>
            {skill}
          </li>
        ))}
      </ul>
    </div>

    <a href="#recent-activity" className="text-white-100 text-[18px] hover:text-sun">
      Games <span className="text-secondary text-[22px] ml-1">{experiences.length}</span>
    </a>

    {/* phones already see Favorite Groups right above the sidebar */}
    <div className="hidden lg:block">
      <p className="text-white-100 text-[18px]">
        Groups <span className="text-secondary text-[22px] ml-1">{profile.groups.length}</span>
      </p>
      <ul className="mt-3 flex flex-col gap-3">
        {profile.groups.map((g) => (
          <li key={g.name} className="flex items-center gap-3">
            <span className="bg-night p-1 shrink-0"><PixelSprite name="school" size={28} /></span>
            <span className="text-wool text-[15px] leading-tight">{g.name}</span>
          </li>
        ))}
      </ul>
    </div>

    <div>
      <p className="text-white-100 text-[18px]">
        Friends <span className="text-secondary text-[22px] ml-1">{profile.friends.length}</span>
      </p>
      <ul className="mt-3 flex flex-col gap-3">
        {profile.friends.map((f) => (
          <li key={f.name}>
            <a
              href={f.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 group"
            >
              <span className="w-9 h-9 bg-night text-white-100 font-pixel text-[11px] flex items-center
                justify-center shrink-0 pixel-frame" style={{ '--px': '2px', '--frame': '#759059' }}>
                {f.glyph}
              </span>
              <span className="leading-tight">
                <span className="block text-white-100 text-[16px] group-hover:text-sun">{f.name}</span>
                <span className="block text-grass-light text-[13px]">Online</span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  </motion.aside>
);

/* ----------------------------------------------------------- showcases -- */

const FavoriteGame = ({ exp, hours }) => (
  <Panel title="Favorite Game" index={1}>
    <div className="flex flex-col sm:flex-row gap-5">
      <GameCapsule exp={exp} large />
      <div className="flex-1 min-w-0">
        <p className="text-white-100 text-[22px] leading-tight">{exp.game}</p>
        <p className="text-secondary text-[15px]">{exp.title}</p>
        <p className="text-wool text-[18px] mt-2">
          <span className="text-sun">{fmt(hours)}</span> hrs on record
        </p>
        <p className="text-secondary text-[14px] mt-3 mb-1">
          Achievement Progress: {exp.achievements.length} of {exp.achievements.length}
        </p>
        <Progress value={exp.achievements.length} max={exp.achievements.length} />
        <div className="mt-3 flex gap-2 flex-wrap">
          {exp.achievements.map((a) => (
            <AchievementIcon key={a.title} icon={a.icon} title={`${a.title}: ${a.text}`} />
          ))}
        </div>
      </div>
    </div>
  </Panel>
);

const RarestAchievements = () => {
  const rare = experiences.flatMap((e) => e.achievements.filter((a) => a.metric).map((a) => ({ ...a, game: e.game })));
  return (
    <Panel title="Rarest Achievements" right={`${rare.length} showcased`} index={2}>
      <ul className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 gap-4">
        {rare.map((a) => (
          <li key={`${a.game}-${a.title}`} className="bg-night/70 p-3 flex gap-3 items-center" title={a.text}>
            <AchievementIcon icon={a.icon} title={a.title} size={48} />
            <div className="min-w-0">
              <p className="text-sun text-[16px] leading-tight">{a.metric}</p>
              <p className="text-white-100 text-[14px] leading-tight mt-1">{a.title}</p>
              <p className="text-secondary text-[12px]">{a.game}</p>
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  );
};

const Workshop = () => (
  <Panel title="Workshop Showcase" right={`${projects.length} items`} index={3}>
    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4 scroll-mt-24" id="projects">
      {projects.map((p) => {
        const soon = p.status === 'coming-soon';
        return (
          <li key={p.name} className={`bg-night/70 p-4 flex flex-col gap-3 ${soon ? 'opacity-90' : ''}`}>
            <div className="flex items-center gap-3">
              <AchievementIcon icon={p.icon} title={p.name} size={52} />
              <div className="min-w-0">
                <p className="text-white-100 text-[19px] leading-tight">{p.name}</p>
                <p className="text-secondary text-[14px] leading-tight">{p.tagline}</p>
              </div>
              {soon && (
                <span className="ml-auto shrink-0 font-pixel text-[9px] text-night bg-sun px-2 py-1">
                  SOON
                </span>
              )}
            </div>
            <p className="text-wool text-[15px] leading-snug">{p.description}</p>
            {p.tags.length > 0 && (
              <ul className="flex flex-wrap gap-2">
                {p.tags.map((t) => (
                  <li key={t} className="text-[13px] text-grass-light">#{t}</li>
                ))}
              </ul>
            )}
            {p.links.length > 0 && (
              <div className="flex gap-3 mt-auto">
                {p.links.map((l) => (
                  <a
                    key={l.url}
                    href={l.url}
                    // In-page anchors (#subway) stay in this tab; anything else opens a new one.
                    {...(l.url.startsWith('#') ? {} : { target: '_blank', rel: 'noopener noreferrer' })}
                    className="bg-plum hover:bg-horizon text-white-100 text-[15px] px-3 py-1 pixel-frame"
                    style={{ '--px': '2px', '--frame': '#ffc666' }}
                  >
                    {l.label}
                  </a>
                ))}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  </Panel>
);

const FavoriteGroups = () => (
  <Panel title="Favorite Groups" index={4}>
    <ul className="flex flex-col gap-4">
      {profile.groups.map((g) => (
        <li key={g.name} className="flex gap-4 items-center">
          <span className="bg-night p-2 shrink-0 pixel-frame" style={{ '--px': '2px', '--frame': '#ab5860' }}>
            <PixelSprite name="school" size={56} />
          </span>
          <div className="min-w-0">
            <p className="text-white-100 text-[19px] leading-tight">{g.name}</p>
            <p className="text-wool text-[15px]">{g.detail}</p>
            <p className="text-secondary text-[14px]">{g.meta} · {g.place}</p>
          </div>
        </li>
      ))}
    </ul>
  </Panel>
);

/** One job in Recent Activity: capsule, hours, last played, achievements. */
const GameRow = ({ exp, hours }) => {
  const teams = [...new Set(exp.achievements.map((a) => a.team || ''))];
  return (
    <li className="bg-night/70 p-3">
      <div className="flex gap-4 items-start">
        <GameCapsule exp={exp} />
        <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:justify-between gap-1">
          <div>
            <p className="text-white-100 text-[18px] leading-tight">{exp.game}</p>
            <p className="text-secondary text-[14px]">{exp.title}</p>
          </div>
          <div className="sm:text-right text-[14px]">
            <p className="text-wool">{fmt(hours)} hrs on record</p>
            <p className={exp.end ? 'text-secondary' : 'text-grass-light'}>
              {exp.end ? `last played on ${monthLabel(exp.end)}` : 'Currently In-Game'}
            </p>
          </div>
        </div>
      </div>

      <details className="mt-3 bg-black-100/80 px-3 py-2 group">
        <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
          <span className="text-secondary text-[14px] shrink-0">
            Achievement Progress {exp.achievements.length} of {exp.achievements.length}
          </span>
          <span className="flex-1 min-w-[120px]" aria-hidden="true"><Progress value={exp.achievements.length} max={exp.achievements.length} /></span>
          <span className="text-sun text-[14px] shrink-0">
            <span className="group-open:hidden">View achievements <span aria-hidden="true">▸</span></span>
            <span className="hidden group-open:inline">Hide achievements <span aria-hidden="true">▾</span></span>
          </span>
        </summary>
        <div className="mt-3 flex flex-col gap-4">
          {teams.map((team) => (
            <div key={team || 'all'}>
              {team && <h4 className="text-secondary text-[14px] font-semibold uppercase tracking-wider mb-2">{team}</h4>}
              <ul className="flex flex-col gap-3">
                {exp.achievements.filter((a) => (a.team || '') === team).map((a) => (
                  <li key={a.title} className="flex gap-3 items-start">
                    <AchievementIcon icon={a.icon} title={a.title} />
                    <div className="min-w-0">
                      <p className="text-white-100 text-[16px] leading-tight">{a.title}</p>
                      <p className="text-wool text-[15px] leading-snug">{a.text}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </details>
    </li>
  );
};

const RecentActivity = ({ games, hours }) => {
  const current = games.find((e) => !e.end);
  return (
    <div id="recent-activity" className="scroll-mt-24">
      <Panel
        title="Recent Activity"
        right={current ? `${HOURS_PER_WEEK * 2} hours past 2 weeks` : undefined}
        index={5}
      >
        <ul className="flex flex-col gap-3">
          {games.map((exp) => (
            <GameRow key={exp.game} exp={exp} hours={hours.get(exp)} />
          ))}
        </ul>
        <p className="text-secondary text-[12px] mt-3">Hours on record are estimated at {HOURS_PER_WEEK} hrs/week.</p>
      </Panel>
    </div>
  );
};

/* ---------------------------------------------------------------- page -- */

const SteamProfile = () => {
  const { level, hours, games, current } = useMemo(() => {
    const now = new Date();
    const start = parseYM(profile.careerStart);
    const months = (now.getFullYear() - start.getFullYear()) * 12 + now.getMonth() - start.getMonth();
    const years = Math.floor(months / 12);
    const byNewest = [...experiences].reverse();
    return {
      level: Math.max(1, years),
      hours: new Map(experiences.map((e) => [e, hoursOnRecord(e, now)])),
      games: byNewest,
      current: byNewest.find((e) => !e.end),
    };
  }, []);

  return (
    <>
      <motion.div variants={textVariant()}>
        <p className={styles.sectionSubText}>What I have done so far</p>
        <h2 className={styles.sectionHeadText}>Work Experience.</h2>
      </motion.div>

      <div className="relative isolate mt-12 overflow-hidden">
        {/* Profile background: the LinkedIn banner, fading into the night sky */}
        <div className="absolute inset-x-0 top-0 h-[340px] -z-10" aria-hidden="true">
          <img src="/og-banner.jpg" alt="" loading="lazy" decoding="async" className="w-full h-full object-cover pixel-img" />
          <div className="absolute inset-0 bg-gradient-to-b from-night/40 via-night/75 to-night" />
        </div>

        <div className="px-4 sm:px-8 pt-8 pb-8 bg-gradient-to-b from-transparent to-black-200/60">
          <Header level={level} />

          <div className="mt-10 grid lg:grid-cols-[minmax(0,1fr)_300px] gap-6">
            {/* DOM order = phone order: showcases first, sidebar after (right column on lg) */}
            <div className="flex flex-col gap-6 min-w-0">
              {current && <FavoriteGame exp={current} hours={hours.get(current)} />}
              <RarestAchievements />
              <Workshop />
              <RecentActivity games={games} hours={hours} />
              <FavoriteGroups />
            </div>
            <Sidebar current={current} />
          </div>
        </div>
      </div>
    </>
  );
};

export default SectionWrapper(SteamProfile, "work");
