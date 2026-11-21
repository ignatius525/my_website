import { About, Experience, Hero, Navbar, Tech } from './components';
const App = ()  => {
  return (
    <>
      {/* <OpenGraph/> */}
      <div className="relative z-0 bg-primary">
        <div className="bg-city-pattern bg-cover
        bg-no-repeat bg-center">
          <Navbar />
          <Hero />
        </div>
        <About />
        <Experience />
        {/* pb-16: bottom spacing while Contact is disabled (Tech has no SectionWrapper) */}
        <div className="pb-16">
          <Tech />
        </div>
        {/* <Works /> */}
        {/* <Feedbacks /> */}
        {/* Contact (EmailJS form) is disabled for now. Before re-enabling it:
            restore the "contact" entry in navLinks (src/constants/index.js) and
            add https://api.emailjs.com to connect-src in BOTH customHttp.yml and
            vite.config.js. */}
        {/* <div className="relative z-0">
          <Contact />
          <StarsCanvas />
        </div> */}
      </div>
    </>
  )
}

export default App
