import { CMSPageLayout } from "@/components/layout/cms-page-layout"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Contact Reader Desk & Author Submissions",
  description: "Get in touch with the HiddenBooks editorial team, reader desk, and technical support.",
}

export const dynamic = "force-dynamic"

export default function ContactPage() {
  return (
    <CMSPageLayout
      slug="contact"
      fallbackTitle="Contact HiddenBooks Editorial"
      fallbackContent="<p>Have an inquiry, author submission proposal, or reader assistance query? Our team is available to assist you.</p><p><strong>Email:</strong> support@hiddenbooks.com<br/><strong>WhatsApp Desk:</strong> +91 7383138396<br/><strong>Hours:</strong> Monday – Saturday, 10:00 AM – 7:00 PM IST</p>"
    />
  )
}
