import { VerticalTimeline, VerticalTimelineElement } from "react-vertical-timeline-component";
import { motion } from "framer-motion";
import 'react-vertical-timeline-component/style.min.css';

import { styles } from '../styles';
import { experiences } from '../constants';
import { SectionWrapper } from '../hoc';
import { textVariant } from "../utils/motion";

const Points = ({ points, className }) => (
  <ul className={`${className} list-[square] marker:text-sun ml-5 space-y-2`}>
    {points.map((point, index) => (
      <li
        key={`experience-point${index}`}
        className="text-wool text-[16px] pl-1 tracking-wide"
      >
        {point}
      </li>
    ))}
  </ul>
)

const ExperienceCard = ({ exp }) => (
  <VerticalTimelineElement
    contentStyle={{
      background: "#2c2547",
      color: "#f6eac6",
      borderRadius: 0,
      // pixel frame in wood (notched corners), see .pixel-frame in index.css
      boxShadow: "0 -4px 0 0 #966636, 0 4px 0 0 #966636, -4px 0 0 0 #966636, 4px 0 0 0 #966636",
    }}
    contentArrowStyle={{ borderRight: "10px solid #966636" }}
    date={exp.date}
    dateClassName="experience-date"
    iconStyle={{
      background: exp.iconBg,
      borderRadius: 0,
      boxShadow: "0 0 0 4px #966636, 0 0 0 8px #4e361e",
    }}
    icon={
      <div className="flex justify-center items-center w-full h-full">
        <img 
          src={exp.icon}
          alt={exp.company_name}
          className="w-[70%] h-[70%] object-contain"
        />
      </div>
    }
  >
    <div>
      <h3 className="text-white-100 font-pixel text-[15px] leading-[1.6]">{exp.title}</h3>
      <p className="text-sun text-[18px] font-semibold mt-2"
      style={{margin: 0}}>{exp.company_name}</p>
    </div>

    {/* Either a flat `points` list, or `groups` of points with a team subheading */}
    {exp.groups ? (
      exp.groups.map((group) => (
        <div key={group.name} className="mt-5">
          <h4 className="text-secondary text-[15px] font-semibold uppercase tracking-wider">
            {group.name}
          </h4>
          <Points points={group.points} className="mt-2" />
        </div>
      ))
    ) : (
      <Points points={exp.points} className="mt-5" />
    )}
  </VerticalTimelineElement>
)

const Experience = () => {
  return (
    <>
      <motion.div variants={textVariant()}>
        <p className={styles.sectionSubText}>What I have done so far</p>
        <h2 className={styles.sectionHeadText}>Work Experience.</h2>
      </motion.div>

      <div className="mt-20 flex flex-col">
        <VerticalTimeline>
          {experiences.map((exp, index) => (
            <ExperienceCard key={index} exp={exp} />
          ))}
        </VerticalTimeline>
      </div>
    </>
  )
}

export default SectionWrapper(Experience, "work")