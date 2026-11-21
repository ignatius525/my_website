import Tilt from 'react-parallax-tilt';
import { motion } from 'framer-motion';

import { styles } from '../styles';
import { services } from '../constants';
import { fadeIn, textVariant } from '../utils/motion';
import { SectionWrapper } from '../hoc';
import { PixelSprite } from './PixelArt';

const ServiceCard = ({ index, title, sprite }) => {
  return (
    <Tilt
      className='xs:w-[250px] w-full'
      tiltMaxAngleX={12}
      tiltMaxAngleY={12}
      transitionSpeed={450}
    >
      <motion.div
        variants={fadeIn("right", "spring", 0.5 * index, 0.75)}
        className="w-full pixel-frame bg-tertiary shadow-card"
      >
        <div
          className='py-5 px-10 min-h-[260px] flex justify-evenly
          items-center flex-col gap-4'
        >
          <PixelSprite name={sprite} size={80} />
          <h3 className='text-white-100 text-[22px] font-semibold
          text-center leading-tight'>{title}</h3>
        </div>
      </motion.div>
    </Tilt>
  )
}

const About = () => {
  return (
    <>
      <motion.div variants={textVariant()}>
        <p className={styles.sectionSubText}>Introduction</p>
        <h2 className={styles.sectionHeadText}>Overview.</h2>
      </motion.div>

      <motion.p
        variants={fadeIn("", "", 0.1, 1)}
        className='mt-6 text-secondary text-[19px]
        max-w-3xl leading-[32px]'
      >
        I am currently an Investment Engineer at Nuveen, where I help run an automated
        portfolio management system managing $13 billion in assets every day. Before that, I spent
        over two years as a Software Engineer in Fixed Income at Bloomberg, building C++
        infrastructure, trading-platform features, and data pipelines. This website is
        currently still not quite finished but shows some cool things I learned.
      </motion.p>

      <div className='mt-20 flex flex-wrap gap-12'>
        {services.map((service, index) => (
          <ServiceCard key={service.title} index={index}
          {...service} />
        ))}
      </div>
    </>
  )
}

export default SectionWrapper(About, "about")
