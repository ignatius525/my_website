import { motion } from "framer-motion";

import {styles} from "../styles";
import { staggerContainer } from "../utils/motion";

const SectionWrapper = (Component, idName) =>
function HOC() {
    return (
        <motion.section
            variants={staggerContainer()}
            initial="hidden"
            whileInView="show"
            // Trigger once the section's top is 15% into the viewport. (A fraction like
            // amount: 0.25 can never be met by sections taller than 4x the screen,
            // e.g. the Steam profile on phones, which then stay invisible.)
            viewport={{ once: true, amount: "some", margin: "0px 0px -15% 0px" }}
            className={`${styles.padding} max-w-7xl mx-auto
            relative z-0`}
        >
            <span className="hash-span" id={idName}>
                &nbsp;
            </span>
            <Component />
        </motion.section>
    )
}

export default SectionWrapper