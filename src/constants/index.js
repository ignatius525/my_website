import {
    typescript,
    reactjs,
    nodejs,
    docker,
    carrent,
    jobit,
    tripguide,
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
  
  const experiences = [
    {
      title: "Software Engineer Intern",
      company_name: "Knack Works Inc.",
      icon: knack,
      iconBg: "#FFFFFF",
      date: "May 2021 - August 2021",
      points: [
        "Created micro-service event driven architecture to automate data ETL and analysis",
        "Developed service layer application with automated task queue for search utilization",
        "Performed first-look on large (>500 GB/day) data sets to optimize search task definition",
        "Integrated service layer into project with Kafka, Redis to communicate with orchestrator",
      ],
    },
    {
      title: "Software Engineer Intern",
      company_name: "BNY Mellon",
      icon: bny,
      iconBg: "#E6DEDD",
      date: "May 2022 - August 2022",
      points: [
        "Worked in Agile Environment to build transaction optimization and accounting application responsible for 3 trillion dollars of assets",
        "Developed reactive broker enrichment micro-service to receive trades through Kafka and automate new broker registration within the transaction manager",
        "Completed pre-release checks and deploy production services using in-house app engine",
        "Automated logging for broker enrichment micro-service by posting sub-processes to Oracle Database",
      ],
    },
    {
      title: "Software Engineer",
      company_name: "Bloomberg LP",
      icon: bb,
      iconBg: "#000000",
      date: "February 2023 - June 2025",
      // Optional: bullets grouped by team (rendered with subheadings) instead of `points`.
      groups: [
        {
          name: "Fixed Income & Derivatives Core (FiD)",
          points: [
            "Designed and implemented new C++ infrastructure API for loading FI curve metadata using Redis, reducing median load by 40%",
            "Enhanced securities autocomplete framework for related curves fetching, reducing median latency by 25% for finding related curves for any equity in Bloomberg",
          ],
        },
        {
          name: "Fixed Income Electronic Trading (FIET)",
          points: [
            "Built automated ML forecasting pipeline via PyTorch for detecting anomalous trading activity, reducing median reaction time for undetected issues by 37%",
            "Created new C++ libraries for sellside dealer entitlement features, consolidating and reducing existing business logic by 60% across all FIET platforms",
            "Rewrote existing Python reference data pipeline for portfolio calculations using publish-subscribe paradigm, reducing median calculation time by 5 minutes (20%) and preventing future outages",
            "Built monitoring and stress testing tools using internal trace metrics and Grafana to identify and fix potential bottlenecks in transaction processing",
          ],
        },
      ],
    },
    {
      title: "Portfolio Management Engineer",
      company_name: "Nuveen · Brooklyn Investment Group",
      icon: nuveen,
      iconBg: "#08262c", // Nuveen brand teal (matches their favicon), not a theme token
      date: "October 2025 - Present",
      points: [
        "Oversee and maintain a sophisticated, automated portfolio management system managing $13 billion in AUM daily",
        "Engineered an automated tax-neutral deleveraging system that strategically transitions accounts from leveraged extensions (e.g., 200/100) to long-only or target-leverage profiles, optimizing for long-term tax alpha",
        "Optimized the operational pipeline by implementing automated edge-case detection and resolution tools, reducing manual labor and intervention time by over 15%",
        "Collaborate directly with Client Success teams to translate complex client requirements into scalable technical solutions, ensuring the automated system meets evolving institutional and retail needs",
      ],
    },
    // {
    //   title: "Full stack Developer",
    //   company_name: "Meta",
    //   icon: meta,
    //   iconBg: "#E6DEDD",
    //   date: "Jan 2023 - Present",
    //   points: [
    //     "Developing and maintaining web applications using React.js and other related technologies.",
    //     "Collaborating with cross-functional teams including designers, product managers, and other developers to create high-quality products.",
    //     "Implementing responsive design and ensuring cross-browser compatibility.",
    //     "Participating in code reviews and providing constructive feedback to other developers.",
    //   ],
    // },
  ];
  
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
  
  const projects = [
    {
      name: "Car Rent",
      description:
        "Web-based platform that allows users to search, book, and manage car rentals from various providers, providing a convenient and efficient solution for transportation needs.",
      tags: [
        {
          name: "react",
          color: "blue-text-gradient",
        },
        {
          name: "mongodb",
          color: "green-text-gradient",
        },
        {
          name: "tailwind",
          color: "pink-text-gradient",
        },
      ],
      image: carrent,
      source_code_link: "https://github.com/",
    },
    {
      name: "Job IT",
      description:
        "Web application that enables users to search for job openings, view estimated salary ranges for positions, and locate available jobs based on their current location.",
      tags: [
        {
          name: "react",
          color: "blue-text-gradient",
        },
        {
          name: "restapi",
          color: "green-text-gradient",
        },
        {
          name: "scss",
          color: "pink-text-gradient",
        },
      ],
      image: jobit,
      source_code_link: "https://github.com/",
    },
    {
      name: "Trip Guide",
      description:
        "A comprehensive travel booking platform that allows users to book flights, hotels, and rental cars, and offers curated recommendations for popular destinations.",
      tags: [
        {
          name: "nextjs",
          color: "blue-text-gradient",
        },
        {
          name: "supabase",
          color: "green-text-gradient",
        },
        {
          name: "css",
          color: "pink-text-gradient",
        },
      ],
      image: tripguide,
      source_code_link: "https://github.com/",
    },
  ];
  
  export { services, technologies, experiences, testimonials, projects };