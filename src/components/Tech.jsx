import { motion } from 'framer-motion'

import { BallCanvas } from './canvas'
import { SectionWrapper } from '../hoc'
import { technologies } from '../constants'
import { styles } from '../styles'
import { textVariant } from '../utils/motion'

const Tech = () => {
  return (
    <>
      <motion.div variants={textVariant()}>
        <p className={styles.sectionSubText}>The flock I tend</p>
        <h2 className={styles.sectionHeadText}>Tech Stack.</h2>
      </motion.div>

      <div className='mt-16 flex flex-row flex-wrap justify-center gap-10'>
        {technologies.map((tech) => (
          <div className='w-28 h-28' key={tech.name} title={tech.name}>
            <BallCanvas icon={tech.icon} />
          </div>
        ))}
      </div>
    </>
  )
}

export default SectionWrapper(Tech, "tech")
