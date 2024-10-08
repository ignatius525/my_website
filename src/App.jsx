import { BrowserRouter } from 'react-router-dom';

import { About, Contact, Experience, Feedbacks,
Hero, Navbar, Tech, Works, StarsCanvas, OpenGraph} from './components';
const App = ()  => {
  return (
    <BrowserRouter>
      <OpenGraph/>
      <div className="relative z-0 bg-primary">
        <div className="bg-city-pattern bg-cover
        bg-no-repeat bg-center">
          <Navbar />
          <Hero />
        </div>
        <About />
        <Experience />
        <Tech />
        {/* <Works /> */}
        {/* <Feedbacks /> */}
        <div className="relative z-0">
          <Contact />
          <StarsCanvas />
        </div>
      </div>
    </BrowserRouter> 
  )
}

export default App
