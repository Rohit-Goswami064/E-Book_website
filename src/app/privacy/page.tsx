import { CMSPageLayout } from "@/components/layout/cms-page-layout"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Privacy Policy — Reader Data Protection",
  description: "Read how HiddenBooks protects reader privacy, transaction records, and account data.",
}

export const dynamic = "force-dynamic"

export default function PrivacyPage() {
  return (
    <CMSPageLayout
      slug="privacy"
      fallbackTitle="Privacy Policy"
      fallbackContent="<p>At HiddenBooks, we prioritize your personal data privacy and digital reading autonomy. We collect minimal information strictly necessary to process your transactions, manage your personal library, and save your reading progress.</p><h3>Data We Collect</h3><p>We store your account email, display name, order history, and reading bookmarks. We never sell your personal information or reading telemetry to third-party data brokers or advertisers.</p>"
    />
  )
}
