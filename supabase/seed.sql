-- ==============================================================================
-- HiddenBooks Initial Setup & System Defaults Seed
-- File: supabase/seed.sql
-- ==============================================================================

-- 1. Default Categories (Matching Brand Palettes & Reference Design)
INSERT INTO public.categories (name, slug, description, icon, color_code, display_order, is_published)
VALUES
  ('Hindi Books', 'hindi-books', 'Curated Hindi literature, classics, and philosophical treatises.', 'BookOpen', '#F5F5F5', 1, true),
  ('उपन्यास (Novels)', 'novels', 'Timeless Indian and world novels translated into evocative prose.', 'Bookmark', '#E8E0D6', 2, true),
  ('स्व-सहायता (Self-Help)', 'self-help', 'Actionable wisdom on mindset, calm thinking, focus, and purposeful living.', 'Heart', '#DDE8E2', 3, true),
  ('इतिहास (History & Heritage)', 'history', 'Rich chronicles of Indian heritage, civilizations, and historical milestones.', 'Clock', '#E2DFEB', 4, true),
  ('Audiobooks', 'audiobooks', 'Immersive narrations with chapter markers and adjustable playback speeds.', 'Headphones', '#DBE7FD', 5, true),
  ('Free Books', 'free-books', 'Open-access public domain classics and complimentary introductory editions.', 'Gift', '#FDE9D9', 6, true)
ON CONFLICT (slug) DO UPDATE SET 
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  color_code = EXCLUDED.color_code;

-- 2. Default Homepage Section Ordering & Visibility
INSERT INTO public.homepage_sections (section_key, title, subtitle, is_enabled, display_order, config)
VALUES
  ('hero', 'Hero Section', 'Editorial headline and primary call to action', true, 1, '{"headline": "Books that shape thought.", "subheadline": "A curated digital sanctuary for valuable eBooks and audiobooks in Hindi and English.", "ctaText": "Browse Catalogue", "ctaLink": "/books"}'::jsonb),
  ('featured_book', 'Curated Editorial Spotlight', 'Featured book of the month with in-depth excerpt', true, 2, '{}'::jsonb),
  ('bestsellers', 'Bestsellers', 'Most-read titles across our community', true, 3, '{}'::jsonb),
  ('new_releases', 'New Releases', 'Freshly published works and modern commentaries', true, 4, '{}'::jsonb),
  ('free_books', 'Free Books Collection', '100% free digital editions with no subscription', true, 5, '{}'::jsonb),
  ('categories', 'Browse by Category', 'Curated sections tailored for discerning readers', true, 6, '{}'::jsonb),
  ('why_hiddenbooks', 'Why HiddenBooks', 'Calm, ad-free reader, verified translations, direct author support', true, 7, '{}'::jsonb),
  ('latest_blog', 'From the Editorial Desk', 'Essays on literature, author interviews, and reading guides', true, 8, '{}'::jsonb),
  ('newsletter', 'Reader Dispatch Newsletter', 'Weekly reading recommendations directly in your inbox', true, 9, '{}'::jsonb),
  ('faqs', 'Frequently Asked Questions', 'Answers regarding formats, downloads, reader compatibility, and payments', true, 10, '{}'::jsonb)
ON CONFLICT (section_key) DO NOTHING;

-- 3. Default System Settings
INSERT INTO public.site_settings (key, value)
VALUES
  ('general', '{
    "siteName": "HiddenBooks",
    "siteTagline": "Curated Digital Destination for Valuable Books",
    "supportEmail": "support@hiddenbooks.com",
    "whatsappSupport": "+91 7383138396",
    "currency": "INR",
    "defaultLanguage": "Hindi",
    "enableDownloads": true,
    "enableAudiobooks": true
  }'::jsonb),
  ('seo', '{
    "metaTitle": "HiddenBooks — Premium Digital eBook & Audiobook Platform",
    "metaDescription": "Discover, purchase, and read valuable eBooks and audiobooks. A calm, intellectual, and curated reading experience with instant access across all devices.",
    "ogImage": "/og-cover.png",
    "twitterHandle": "@hiddenbooks"
  }'::jsonb),
  ('social', '{
    "instagram": "https://instagram.com/mindset_of_sn",
    "whatsapp": "https://wa.me/917383138396",
    "twitter": "https://twitter.com/hiddenbooks"
  }'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- 4. Default CMS Static Pages
INSERT INTO public.pages (title, slug, content_html, is_published, meta_title, meta_description)
VALUES
  ('About Us', 'about', '<h2>About HiddenBooks</h2><p>HiddenBooks is a quiet, intellectual digital sanctuary dedicated to the appreciation and dissemination of profound literature. Our mission is to preserve timeless philosophical insights, classic Hindi and world novels, and practical self-mastery treatises in high-quality digital formats.</p><p>We believe reading should be an unhurried, distraction-free pursuit. Our digital bookstore and built-in reader are engineered with precision typography, responsive reading ergonomics, and instant cross-device synchronization.</p>', true, 'About HiddenBooks | Philosophy & Mission', 'Learn about HiddenBooks, our dedication to curated literature and digital reading excellence.'),
  ('Privacy Policy', 'privacy', '<h2>Privacy Policy</h2><p>At HiddenBooks, we prioritize your personal data privacy and digital reading autonomy. We collect minimal information strictly necessary to process your transactions, manage your personal library, and save your reading progress.</p><h3>Data We Collect</h3><p>We store your account email, display name, order history, and reading bookmarks. We never sell your personal information or reading telemetry to third-party data brokers or advertisers.</p>', true, 'Privacy Policy | HiddenBooks', 'Read how HiddenBooks protects reader privacy, transaction records, and account data.'),
  ('Terms and Conditions', 'terms', '<h2>Terms and Conditions</h2><p>Welcome to HiddenBooks. By accessing our website, purchasing digital eBooks or audiobooks, or utilizing our reading software, you agree to comply with these terms.</p><h3>Digital Entitlements</h3><p>Purchasing an eBook grants a perpetual, non-exclusive, personal reading license. Titles can be accessed through your personal library in accordance with our terms of service.</p>', true, 'Terms and Conditions | HiddenBooks', 'Terms of service and digital licensing conditions for HiddenBooks readers.'),
  ('Refund and Cancellation Policy', 'refund-policy', '<h2>Refund and Cancellation Policy</h2><p>Because HiddenBooks provides immediate digital access to eBooks, audiobooks, and downloadable files upon payment completion, purchases are generally final once reading or download access has commenced.</p><h3>Refund Eligibility</h3><p>If you experience verified technical impediments, defective files, or accidental duplicate charges, please contact our support desk within 7 days of purchase. Verified technical issues will be promptly refunded via your original payment method via Razorpay.</p>', true, 'Refund & Cancellation Policy | HiddenBooks', 'Transparent guidelines regarding digital product returns, technical defect refunds, and support.'),
  ('Contact Us', 'contact', '<h2>Contact HiddenBooks Editorial</h2><p>Have an inquiry, author submission proposal, or reader assistance query? Our team is available to assist you.</p><p><strong>Email:</strong> support@hiddenbooks.com<br/><strong>WhatsApp Desk:</strong> +91 7383138396<br/><strong>Hours:</strong> Monday – Saturday, 10:00 AM – 7:00 PM IST</p>', true, 'Contact Us | HiddenBooks Reader Desk', 'Get in touch with the HiddenBooks editorial team, reader desk, and technical support.')
ON CONFLICT (slug) DO NOTHING;

-- 5. Default FAQs
INSERT INTO public.faqs (question, answer, category, display_order, is_published)
VALUES
  ('How do I access my purchased books?', 'Immediately following successful payment verification through Razorpay, your book is permanently added to your personal "My Library" tab. You can click "Read Now" to read directly in our distraction-free browser reader on desktop or mobile, or download the PDF if downloads are enabled.', 'Access & Library', 1, true),
  ('Can I read offline or download the PDF?', 'Yes. For books designated as downloadable, an authenticated "Download PDF" button is available in your account under "My Downloads" and "My Library". You can store the PDF on your computer, tablet, or phone.', 'Formats & Reading', 2, true),
  ('Are payment transactions secure?', 'All payments are handled securely through Razorpay using RBI-compliant payment gateways, UPI, RuPay, cards, and net banking with end-to-end 256-bit encryption. HiddenBooks never stores credit or debit card details.', 'Payments', 3, true),
  ('How does the in-browser reader work?', 'Our reader automatically saves your current page, reading progress percentage, and bookmarks. When you return to the book on any device, your session seamlessly resumes from where you left off.', 'Formats & Reading', 4, true),
  ('What are Free Books on HiddenBooks?', 'We provide a collection of 100% free digital books that can be read online or downloaded without any recurring subscriptions or hidden fees.', 'General', 5, true)
ON CONFLICT DO NOTHING;
