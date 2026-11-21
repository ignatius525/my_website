import { PixelSprite } from './PixelArt';

// The page ends back on the pasture: a strip of pixel grass with grazing sheep.
const Footer = () => (
  <footer className="relative mt-8" aria-label="Footer">
    <div className="grass-edge h-6" />
    <div className="bg-grass pb-8 pt-2">
      <div className="max-w-7xl mx-auto sm:px-16 px-6 flex items-end
      justify-between gap-6 flex-wrap">
        <div className="flex items-end gap-6">
          <PixelSprite name="sheep" size={72} />
          <PixelSprite name="sheep" size={56} className="-scale-x-100" />
          <PixelSprite name="sheep" size={64} className="hidden xs:block" />
        </div>
        <p className="text-wool-light text-[16px] pixel-shadow">
          &copy; {new Date().getFullYear()} Ignat Miagkov
        </p>
      </div>
    </div>
  </footer>
);

export default Footer;
