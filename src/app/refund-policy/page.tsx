import { CMSPageLayout } from "@/components/layout/cms-page-layout"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Refund and Cancellation Policy",
  description: "Transparent guidelines regarding digital product returns, technical defect refunds, and support.",
}

export const dynamic = "force-dynamic"

export default function RefundPolicyPage() {
  return (
    <CMSPageLayout
      slug="refund-policy"
      fallbackTitle="Refund and Cancellation Policy"
      fallbackContent="<p>Because HiddenBooks provides immediate digital access to eBooks, audiobooks, and downloadable files upon payment completion, purchases are generally final once reading or download access has commenced.</p><h3>Refund Eligibility</h3><p>If you experience verified technical impediments, defective files, or accidental duplicate charges, please contact our support desk within 7 days of purchase. Verified technical issues will be promptly refunded via your original payment method via Razorpay.</p>"
    />
  )
}
