import { About, Footer, Hero, Navbar, SteamProfile, Tech } from './components';
const App = ()  => {
  return (
    <>
      <div className="relative z-0 bg-primary">
        <Navbar />
        <Hero />
        <main className="night-sky">
          <About />
          <SteamProfile />
          <Tech />
        </main>
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
