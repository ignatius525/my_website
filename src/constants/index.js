import {
    typescript,
    reactjs,
    nodejs,
    docker,
    knack,
    bny,
    bb,
    nuveen,
    cpp,
    py,
    grafana,
    kafka,
    jenkins,
    splunk,
    redis,
    postgresql,
  } from "../assets";
  
  export const navLinks = [
    {
      id: "about",
      title: "About",
    },
    {
      id: "work",
      title: "Work",
    },
    // Contact section is disabled (see App.jsx); restore this when re-enabling it.
    // {
    //   id: "contact",
    //   title: "Contact",
    // },
  ];
  
  const services = [
    // sprite: a key of SPRITES in src/components/PixelArt.jsx
    {
      title: "Full Stack Developer",
      sprite: "monitor",
    },
    {
      title: "C++ Developer",
      sprite: "cpp",
    },
    {
      title: "Trading Systems",
      sprite: "candles",
    },
    {
      title: "Load Testing",
      sprite: "bolt",
    },
  ];
  
  // Mirrors the resume's skills. Each entry is its own WebGL canvas (BallCanvas),
  // so keep this to ~12: browsers cap live WebGL contexts at about 16 per page.
  const technologies = [
    {
      name: "C++",
      icon: cpp,
    },
    {
      name: "Python",
      icon: py,
    },
    {
      name: "TypeScript",
      icon: typescript,
    },
    {
      name: "React",
      icon: reactjs,
    },
    {
      name: "Node.js",
      icon: nodejs,
    },
    {
      name: "Kafka",
      icon: kafka,
    },
    {
      name: "Redis",
      icon: redis,
    },
    {
      name: "PostgreSQL",
      icon: postgresql,
    },
    {
      name: "Docker",
      icon: docker,
    },
    {
      name: "Jenkins",
      icon: jenkins,
    },
    {
      name: "Grafana",
      icon: grafana,
    },
    {
      name: "Splunk",
      icon: splunk,
    },
  ];
  
  // Work experience, rendered as a Steam-style profile (SteamProfile.jsx): each
  // job is a "game", each resume bullet an "achievement". Oldest first.
  // - start/end: "YYYY-MM" (end: null = current job). Hours on record are
  //   estimated from these at 40 hrs/week.
  // - iconBg: 6-digit hex (picks dark or cream text for the logo tile)
  // - achievement.icon: a SPRITES key in components/PixelArt.jsx
  // - achievement.metric: optional headline number -> "Rarest Achievements"
  // - achievement.team: optional subheading (Bloomberg's two teams)
  const experiences = [
    {
      game: "Knack Works",
      title: "Software Engineer Intern",
      company_name: "Knack Works Inc.",
      icon: knack,
      iconBg: "#FFFFFF",
      start: "2021-05",
      end: "2021-08",
      achievements: [
        { title: "Event-Driven Architect", icon: "gear", text: "Created micro-service event driven architecture to automate data ETL and analysis" },
        { title: "Queue Master", icon: "monitor", text: "Developed service layer application with automated task queue for search utilization" },
        { title: "Big Data Scout", icon: "magnifier", metric: ">500 GB/day", text: "Performed first-look on large (>500 GB/day) data sets to optimize search task definition" },
        { title: "Message Broker", icon: "bolt", text: "Integrated service layer into project with Kafka, Redis to communicate with orchestrator" },
      ],
    },
    {
      game: "BNY Mellon",
      title: "Software Engineer Intern",
      company_name: "BNY Mellon",
      icon: bny,
      iconBg: "#E6DEDD",
      start: "2022-05",
      end: "2022-08",
      achievements: [
        { title: "Trillion-Dollar Ledger", icon: "candles", metric: "$3 trillion", text: "Worked in Agile Environment to build transaction optimization and accounting application responsible for 3 trillion dollars of assets" },
        { title: "Broker Whisperer", icon: "bolt", text: "Developed reactive broker enrichment micro-service to receive trades through Kafka and automate new broker registration within the transaction manager" },
        { title: "Ship It", icon: "trophy", text: "Completed pre-release checks and deploy production services using in-house app engine" },
        { title: "Paper Trail", icon: "monitor", text: "Automated logging for broker enrichment micro-service by posting sub-processes to Oracle Database" },
      ],
    },
    {
      game: "Bloomberg",
      title: "Software Engineer",
      company_name: "Bloomberg LP",
      icon: bb,
      iconBg: "#000000",
      start: "2023-02",
      end: "2025-06",
      achievements: [
        { team: "Fixed Income & Derivatives Core (FiD)", title: "Curve Loader", icon: "cpp", metric: "40% faster loads", text: "Designed and implemented new C++ infrastructure API for loading FI curve metadata using Redis, reducing median load by 40%" },
        { team: "Fixed Income & Derivatives Core (FiD)", title: "Autocomplete Accelerator", icon: "magnifier", text: "Enhanced securities autocomplete framework for related curves fetching, reducing median latency by 25% for finding related curves for any equity in Bloomberg" },
        { team: "Fixed Income Electronic Trading (FIET)", title: "Anomaly Hunter", icon: "candles", metric: "37% faster reactions", text: "Built automated ML forecasting pipeline via PyTorch for detecting anomalous trading activity, reducing median reaction time for undetected issues by 37%" },
        { team: "Fixed Income Electronic Trading (FIET)", title: "Logic Consolidator", icon: "cpp", metric: "60% less logic", text: "Created new C++ libraries for sellside dealer entitlement features, consolidating and reducing existing business logic by 60% across all FIET platforms" },
        { team: "Fixed Income Electronic Trading (FIET)", title: "Pub-Sub Pipeline", icon: "gear", text: "Rewrote existing Python reference data pipeline for portfolio calculations using publish-subscribe paradigm, reducing median calculation time by 5 minutes (20%) and preventing future outages" },
        { team: "Fixed Income Electronic Trading (FIET)", title: "Stress Tester", icon: "bolt", text: "Built monitoring and stress testing tools using internal trace metrics and Grafana to identify and fix potential bottlenecks in transaction processing" },
      ],
    },
    {
      game: "Nuveen",
      title: "Portfolio Management Engineer",
      company_name: "Nuveen · Brooklyn Investment Group",
      icon: nuveen,
      iconBg: "#08262c", // Nuveen brand teal (matches their favicon), not a theme token
      start: "2025-10",
      end: null,
      achievements: [
        { title: "Shepherd of $13 Billion", icon: "sheep", metric: "$13 billion AUM", text: "Oversee and maintain a sophisticated, automated portfolio management system managing $13 billion in AUM daily" },
        { title: "Tax Alpha", icon: "candles", text: "Engineered an automated tax-neutral deleveraging system that strategically transitions accounts from leveraged extensions (e.g., 200/100) to long-only or target-leverage profiles, optimizing for long-term tax alpha" },
        { title: "Edge-Case Hunter", icon: "magnifier", text: "Optimized the operational pipeline by implementing automated edge-case detection and resolution tools, reducing manual labor and intervention time by over 15%" },
        { title: "Client Whisperer", icon: "trophy", text: "Collaborate directly with Client Success teams to translate complex client requirements into scalable technical solutions, ensuring the automated system meets evolving institutional and retail needs" },
      ],
    },
  ];

  // Steam-profile header, sidebar and "Favorite Groups" content.
  const profile = {
    name: "Ignat",
    realName: "Ignat Miagkov",
    location: "New York, NY",
    summary: "Portfolio Management Engineer at Nuveen. Part-time sheep herder.",
    careerStart: "2023-02", // first full-time job (Bloomberg); Level = full years since this month
    skills: [
      "C++", "Python", "TypeScript", "Unix Shell", "Flask", "Boost", "React", "Node.js",
      "Linux", "Kafka", "Postgres", "Redis", "Jenkins", "Grafana", "Docker", "Humio/Splunk",
      "GitHub Actions",
    ],
    groups: [
      { name: "College of William & Mary", detail: "BSc Double Major · Computer Science, Chemistry", meta: "Aug 2019 – Dec 2022 · GPA 3.73", place: "Williamsburg, VA" },
      { name: "University of St Andrews", detail: "Exchange Program · Computer Science, Chemistry", meta: "Jan 2021 – May 2021", place: "St Andrews, UK" },
    ],
    friends: [
      { name: "LinkedIn", glyph: "in", url: "https://www.linkedin.com/in/imiagkov" },
      { name: "GitHub", glyph: "gh", url: "https://github.com/ignatius525" },
    ],
  };

  const testimonials = [
    {
      testimonial:
        "I thought it was impossible to make a website as beautiful as our product, but Rick proved me wrong.",
      name: "Sara Lee",
      designation: "CFO",
      company: "Acme Co",
      image: "https://randomuser.me/api/portraits/women/4.jpg",
    },
    {
      testimonial:
        "I've never met a web developer who truly cares about their clients' success like Rick does.",
      name: "Chris Brown",
      designation: "COO",
      company: "DEF Corp",
      image: "https://randomuser.me/api/portraits/men/5.jpg",
    },
    {
      testimonial:
        "After Rick optimized our website, our traffic increased by 50%. We can't thank them enough!",
      name: "Lisa Wang",
      designation: "CTO",
      company: "456 Enterprises",
      image: "https://randomuser.me/api/portraits/women/6.jpg",
    },
  ];
  
  // Projects, shown as the profile's "Workshop" showcase.
  // status "released" shows links; "coming-soon" shows a placeholder card.
  const projects = [
    {
      name: "llms-gen",
      tagline: "Generate and monitor llms.txt files for any website",
      description: "Crawls a site, groups pages into sections, and writes an llms.txt file. Works as a CLI and an SDK, with Playwright for JS-heavy sites and change detection via HTTP headers.",
      tags: ["TypeScript", "Node.js", "Playwright"],
      icon: "monitor",
      status: "released",
      links: [
        { label: "GitHub", url: "https://github.com/ignatius525/llms-text-gen" },
        { label: "npm", url: "https://www.npmjs.com/package/@imiagkov/llms-gen" },
      ],
    },
    {
      name: "AI Crawler Blocker",
      tagline: "Keep AI scrapers off your site",
      description: "Coming soon. The repo link goes here once it's pushed.",
      tags: [],
      icon: "shield",
      status: "coming-soon",
      links: [],
    },
  ];

  export { services, technologies, experiences, profile, testimonials, projects };