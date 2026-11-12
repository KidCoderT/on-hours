import { motion } from "motion/react";
import type { ReactNode } from "react";

type Props = { children: ReactNode; delay?: number; className?: string; as?: "div" | "li" | "section" };

/** The one scroll reveal: a short rise out of a soft blur, once. */
export function Reveal({ children, delay = 0, className, as = "div" }: Props) {
  const Tag = motion[as];
  return (
    <Tag
      className={className}
      initial={{ opacity: 0, y: 18, filter: "blur(8px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "0px 0px -12% 0px" }}
      transition={{ duration: 0.7, delay, ease: [0.2, 0.7, 0.2, 1] }}
    >
      {children}
    </Tag>
  );
}
