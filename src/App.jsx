import { About, Experience, Footer, Hero, Navbar, Tech } from './components';
const App = ()  => {
  return (
    <>
      {/* <OpenGraph/> */}
      <div className="relative z-0 bg-primary">
        <Navbar />
        <Hero />
        <main className="night-sky">
          <About />
          <Experience />
          <Tech />
        </main>
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
        <Footer />
      </div>
    </>
  )
}

export default App
