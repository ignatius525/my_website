import { motion } from 'framer-motion';

import { styles } from '../styles';
import { PastureCanvas } from './canvas';

const Hero = () => {
  return (
    <section className="relative w-full h-screen mx-auto overflow-hidden">
      <PastureCanvas />

      {/* pointer-events-none so the mouse reaches the canvas (parallax + click-to-herd) */}
      <div className={`${styles.paddingX} absolute inset-0 top-[120px]
      max-w-7xl mx-auto flex flex-row items-start gap-5 z-10
      pointer-events-none`}>
        <div className="flex flex-col justify-center items-center mt-3">
          <div className='w-5 h-5 bg-sun shadow-[0_0_0_4px_#ff964e]'/>
          <div className='w-1 sm:h-64 h-36 sun-gradient'/>
        </div>

        <div>
          <h1 className={`${styles.heroHeadText} pixel-shadow`}>
            Hi, I&apos;m <span className='text-sun'>Ignat</span>
          </h1>
          <p className={`${styles.heroSubText} mt-4 pixel-shadow`}>
            C++ Engineer
          </p>
        </div>
      </div>

      {/* the row is click-through so clicks on the near field reach the canvas */}
      <div className='absolute xs:bottom-10 bottom-32 w-full flex
      justify-center items-center z-10 pointer-events-none'>
        <a href="#about" aria-label="Scroll to About" className="pointer-events-auto">
          <div className='w-[32px] h-[60px] pixel-frame bg-night/60
          flex justify-center items-start p-2'>
            <motion.div
              animate={{ y: [0, 24, 0] }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                repeatType: 'loop',
                ease: 'linear',
              }}
              className="w-3 h-3 bg-sun mb-1"
            />
          </div>
        </a>
      </div>
    </section>
  )
}

export default Hero
