import {
    mobile,
    backend,
    creator,
    web,
    javascript,
    typescript,
    html,
    css,
    reactjs,
    redux,
    tailwind,
    nodejs,
    mongodb,
    git,
    docker,
    meta,
    starbucks,
    tesla,
    shopify,
    carrent,
    jobit,
    tripguide,
    threejs,
    knack,
    bny,
    bb,
    cpp,
    py,
    spring,
    grafana,
    kafka,
    jenkins,
    splunk
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
    {
      id: "contact",
      title: "Contact",
    },
  ];
  
  const services = [
    {
      title: "Full Stack Developer",
      icon: web,
    },
    {
      title: "C++ Developer",
      icon: mobile,
    },
    {
      title: "Trading Systems",
      icon: backend,
    },
    {
      title: "Load Testing",
      icon: creator,
    },
  ];
  
  const technologies = [
    {
      name: "CPP",
      icon: cpp,
    },
    {
      name: "PY",
      icon: py,
    },
    {
      name: "Spring",
      icon: spring,
    },
    {
      name: "docker",
      icon: docker,
    },
    {
      name: "JavaScript",
      icon: javascript,
    },
    {
      name: "TypeScript",
      icon: typescript,
    },
    {
      name: "React JS",
      icon: reactjs,
    },
    {
      name: "git",
      icon: git,
    },
    {
      name: "Grafana",
      icon: grafana,
    },
    {
      name: "Kafka",
      icon: kafka,
    },
    {
      name: "Jenkins",
      icon: jenkins,
    },
    {
      name: "splunk",
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
        "Performed first-look on large ($>$500 GB/day) data sets to optimize search task definition",
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
      date: "February 2023 - Present",
      points: [
        "Developing full-stack applications for bids/offers list trading (BOLT) platform, executing over \$20 billion in traded assets every day",
        "Creating new feature for municipal bonds trading workflow for client to easily manage receiving dealers for quotes",
        "Creating new APIs to enable user entitlement features across all fixed income platforms",
        "Conducting integration, load testing of individual services using Docker, Locust to identify potential bottlenecks",
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