import { CMSPageLayout } from "@/components/layout/cms-page-layout"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Terms and Conditions — Digital Licensing",
  description: "Terms of service and digital licensing conditions for HiddenBooks readers.",
}

export const dynamic = "force-dynamic"

export default function TermsPage() {
  return (
    <CMSPageLayout
      slug="terms"
      fallbackTitle="Terms and Conditions"
      fallbackContent="<p>Welcome to HiddenBooks. By accessing our website, purchasing digital eBooks or audiobooks, or utilizing our reading software, you agree to comply with these terms.</p><h3>Digital Entitlements</h3><p>Purchasing an eBook grants a perpetual, non-exclusive, personal reading license. Titles can be accessed through your personal library in accordance with our terms of service.</p>"
    />
  )
}
