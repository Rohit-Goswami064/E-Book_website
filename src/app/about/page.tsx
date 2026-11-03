import { CMSPageLayout } from "@/components/layout/cms-page-layout"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "About Us — HiddenBooks Publishing",
  description: "Learn about HiddenBooks, our dedication to timeless literature, and our reader-first digital publishing philosophy.",
}

export const dynamic = "force-dynamic"

export default function AboutPage() {
  return (
    <CMSPageLayout
      slug="about"
      fallbackTitle="About HiddenBooks"
      fallbackContent="<p>HiddenBooks is a quiet, intellectual digital sanctuary dedicated to the appreciation and dissemination of profound literature. Our mission is to preserve timeless philosophical insights, classic Hindi and world novels, and practical self-mastery treatises in high-quality digital formats.</p><p>We believe reading should be an unhurried, distraction-free pursuit. Our digital bookstore and built-in reader are engineered with precision typography, responsive reading ergonomics, and instant cross-device synchronization.</p>"
    />
  )
}
