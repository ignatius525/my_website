import { useState, useRef } from "react";
import { motion } from "framer-motion";
import emailjs from '@emailjs/browser';

import { styles } from "../styles";
import { EarthCanvas } from "./canvas";
import { SectionWrapper } from "../hoc";
import { slideIn } from "../utils/motion";

const LIMITS = { name: 100, email: 254, message: 5000 };
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SEND_COOLDOWN_MS = 60 * 1000;

const EMPTY_FORM = { name: "", email: "", message: "", hp_extra: "" };

const Contact = () => {
  const formRef = useRef();
  const [form, setForm] = useState(EMPTY_FORM);

  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { target } = e;
    const { name, value } = target;

    setForm({
      ...form,
      [name]: value,
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (loading) return;

    // Honeypot: the "hp_extra" field is invisible to people, so only bots fill it.
    // (Meaningless name on purpose, so browser autofill never fills it.)
    // Pretend it worked so the bot has no signal to adapt to.
    if (form.hp_extra) {
      setForm(EMPTY_FORM);
      return;
    }

    const name = form.name.trim();
    const email = form.email.trim();
    const message = form.message.trim();

    if (!name || !email || !message) {
      alert("Please fill in your name, email, and message.");
      return;
    }
    if (!EMAIL_PATTERN.test(email)) {
      alert("Please enter a valid email address.");
      return;
    }
    if (name.length > LIMITS.name || email.length > LIMITS.email
      || message.length > LIMITS.message) {
      alert("One of the fields is too long.");
      return;
    }

    const serviceId = import.meta.env.VITE_APP_EMAILJS_SERVICE_ID;
    const templateId = import.meta.env.VITE_APP_EMAILJS_TEMPLATE_ID;
    const publicKey = import.meta.env.VITE_APP_EMAILJS_PUBLIC_KEY;
    if (!serviceId || !templateId || !publicKey) {
      console.error("EmailJS environment variables are not set.");
      alert("The contact form is unavailable right now. Please try again later.");
      return;
    }

    setLoading(true);

    // The recipient address is set in the EmailJS template, not sent from here,
    // so the public key can't be used to send mail to arbitrary addresses.
    emailjs
      .send(
        serviceId,
        templateId,
        {
          from_name: name,
          from_email: email,
          reply_to: email,
          message,
        },
        {
          publicKey,
          // Refuse automated/headless browsers (e.g. Puppeteer spam bots).
          blockHeadless: true,
          // At most one message per minute from this browser.
          limitRate: { id: "contact-form", throttle: SEND_COOLDOWN_MS },
        }
      )
      .then(
        () => {
          setLoading(false);
          alert("Thank you. I will get back to you as soon as possible.");

          setForm(EMPTY_FORM);
        },
        (error) => {
          setLoading(false);
          console.error(error);

          if (error?.status === 429) {
            alert("Please wait a minute before trying again.");
          } else {
            alert("Ahh, something went wrong. Please try again.");
          }
        }
      );
  };

  return (
    <div className="xl:mt-12 xl:flex-row flex-col-reverse flex gap-10
    overflow-hidden">
      <motion.div
        variants={slideIn('left', 'tween', 0.2, 1)}
        className="flex[0.75] bg-black-100 p-8 rounded-2xl"
      >
        <p className={styles.sectionSubText}>Get in touch</p>
        <h3 className={styles.sectionHeadText}>Contact</h3>

        <form
          ref={formRef}
          onSubmit={handleSubmit}
          className="mt-12 flex flex-col gap-8"
        >
          <label className="flex flex-col">
            <span className="text-white font-medium
            mb-4">Your Name</span>
            <input
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              required
              maxLength={LIMITS.name}
              autoComplete="name"
              className="bg-tertiary py-4 px-6
              placeholder:text-secondary text-white
              rounded-lg outline-none border-none font-medium"
            />
          </label>
          <label className="flex flex-col">
            <span className="text-white font-medium
            mb-4">Your Email</span>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              required
              maxLength={LIMITS.email}
              autoComplete="email"
              className="bg-tertiary py-4 px-6
              placeholder:text-secondary text-white
              rounded-lg outline-none border-none font-medium"
            />
          </label>
          <label className="flex flex-col">
            <span className="text-white font-medium
            mb-4">Message</span>
            <textarea
              rows='7'
              name="message"
              value={form.message}
              onChange={handleChange}
              required
              maxLength={LIMITS.message}
              className="bg-tertiary py-4 px-6
              placeholder:text-secondary text-white
              rounded-lg outline-none border-none font-medium"
            />
          </label>
          {/* Honeypot for spam bots: positioned off-screen and hidden from
              screen readers and keyboard navigation. Do not remove. */}
          <label
            aria-hidden="true"
            className="absolute -left-[9999px] w-px h-px overflow-hidden"
          >
            Website
            <input
              type="text"
              name="hp_extra"
              value={form.hp_extra}
              onChange={handleChange}
              tabIndex={-1}
              autoComplete="off"
            />
          </label>
          <button
            type='submit'
            disabled={loading}
            className="bg-tertiary py-3 px-8 outline-none w-fit
            text-white font-bold shadow-md shadow-primary rounded-xl"
          >
            {loading ? 'Sending...' : 'Send'}
          </button>
        </form>
      </motion.div>

      <motion.div
        variants={slideIn('right', 'tween', 0.2, 1)}
        className="xl:flex-1 xl:h-auto md:h-[550px] h-[350px]"
      >
        <EarthCanvas />
      </motion.div>
    </div>
  )
}

export default SectionWrapper(Contact, "contact")