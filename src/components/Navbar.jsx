import { useEffect, useState } from 'react'

import {styles} from '../styles';
import { navLinks } from '../constants';
import { menu, close } from '../assets';
import { PixelSprite } from './PixelArt';

const Navbar = () => {
  const [active, setActive] = useState('');
  const [toggle, setToggle] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Transparent over the hero sky; solid night bar once the page scrolls.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav
      className={`
        ${styles.paddingX} w-full flex
        items-center py-5 fixed top-0 z-20 transition-colors
        ${scrolled ? 'bg-night/95 shadow-[0_4px_0_0_#392854]' : 'bg-transparent'}`}
      >
      <div className='w-full flex justify-between
      items-center max-w-7xl mx-auto'>
        <a
          href="/"
          className='flex items-center gap-2'
          onClick={(e) => {
            e.preventDefault();
            setActive("");
            window.scrollTo(0,0);
          }}
        >
          <PixelSprite name="sheep" size={40} />
          <p className="text-white-100 text-[20px] pixel-shadow
          font-semibold cursor-pointer flex">Ignat Miagkov&nbsp;
          <span className='sm:block hidden text-secondary'>| Software Engineer
          </span></p>
        </a>
        <ul className='list-none hidden sm:flex
        flex-row gap-10'>
         {navLinks.map((link) => (
          <li
            key={link.id}
            className={`${
              active === link.title
                ? "text-sun"
                : "text-secondary"
            } hover:text-sun text-[20px]
            font-medium cursor-pointer`}
            onClick={() => setActive(link.title)}
          >
            <a href={`#${link.id}`}>{link.title}</a>
          </li>
         ))}
        </ul>

        <div className='sm:hidden flex flex-1
        justify-end items-center'>
          <img 
          src={toggle ? close : menu}
          alt="menu"
          className='w-[28px] h-[28px]
          object-contain cursor-pointer'
          onClick={() => setToggle(!toggle)}
          />
          <div className={`${!toggle ? 'hidden'
          : 'flex' } p-6 black-gradient pixel-frame absolute
          top-20 right-0 mx-4 my-2 min-w-[140px]
          z-10`}>
            <ul className='list-none flex 
            justify-end items-start flex-col gap-4'>
            {navLinks.map((link) => (
              <li
                key={link.id}
                className={`${
                  active === link.title
                    ? "text-sun"
                    : "text-secondary"
                } font-medium cursor-pointer
                text-[16px]`}
                onClick={() => { 
                  setToggle(!toggle);
                  setActive(link.title);
                }}
              >
                <a href={`#${link.id}`}>{link.title}</a>
              </li>
            ))}
            </ul>
          </div>
        </div>
      </div>
    </nav>
  )
}

export default Navbar