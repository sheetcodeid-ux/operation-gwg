import { SmoothScroll } from "@/components/hpp/motion";

/** R&D section: enable Lenis smooth scrolling for the HPP pages. */
export default function RndLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SmoothScroll />
      {children}
    </>
  );
}
