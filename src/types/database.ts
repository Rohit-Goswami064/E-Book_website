export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type UserRole = "customer" | "admin" | "super_admin"
export type OrderStatus = "pending" | "paid" | "failed" | "refunded" | "cancelled"
export type PaymentStatus = "pending" | "captured" | "failed" | "refunded"
export type BookFileType = "pdf" | "epub" | "audio"
export type PostStatus = "draft" | "published" | "scheduled"

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          phone: string | null
          avatar_url: string | null
          bio: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          phone?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          phone?: string | null
          avatar_url?: string | null
          bio?: string | null
          updated_at?: string
        }
      }
      user_roles: {
        Row: {
          id: string
          user_id: string
          role: UserRole
          assigned_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          role?: UserRole
          assigned_by?: string | null
          created_at?: string
        }
        Update: {
          role?: UserRole
          assigned_by?: string | null
        }
      }
      authors: {
        Row: {
          id: string
          name: string
          slug: string
          bio: string | null
          avatar_url: string | null
          website: string | null
          instagram: string | null
          twitter: string | null
          is_published: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          bio?: string | null
          avatar_url?: string | null
          website?: string | null
          instagram?: string | null
          twitter?: string | null
          is_published?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          slug?: string
          bio?: string | null
          avatar_url?: string | null
          website?: string | null
          instagram?: string | null
          twitter?: string | null
          is_published?: boolean
          updated_at?: string
        }
      }
      categories: {
        Row: {
          id: string
          name: string
          slug: string
          description: string | null
          icon: string | null
          color_code: string | null
          display_order: number
          is_published: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          description?: string | null
          icon?: string | null
          color_code?: string | null
          display_order?: number
          is_published?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          slug?: string
          description?: string | null
          icon?: string | null
          color_code?: string | null
          display_order?: number
          is_published?: boolean
          updated_at?: string
        }
      }
      books: {
        Row: {
          id: string
          title: string
          slug: string
          subtitle: string | null
          author_id: string | null
          price_cents: number
          original_price_cents: number | null
          currency: string
          is_free: boolean
          is_published: boolean
          is_featured: boolean
          is_bestseller: boolean
          cover_image_url: string | null
          short_description: string | null
          description: string | null
          format: string
          language: string
          pages: number | null
          isbn: string | null
          publisher: string | null
          publication_date: string | null
          audio_duration: string | null
          audio_sample_url: string | null
          table_of_contents: Json | null
          seo_title: string | null
          seo_description: string | null
          canonical_url: string | null
          view_count: number
          sales_count: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          slug: string
          subtitle?: string | null
          author_id?: string | null
          price_cents?: number
          original_price_cents?: number | null
          currency?: string
          is_free?: boolean
          is_published?: boolean
          is_featured?: boolean
          is_bestseller?: boolean
          cover_image_url?: string | null
          short_description?: string | null
          description?: string | null
          format?: string
          language?: string
          pages?: number | null
          isbn?: string | null
          publisher?: string | null
          publication_date?: string | null
          audio_duration?: string | null
          audio_sample_url?: string | null
          table_of_contents?: Json | null
          seo_title?: string | null
          seo_description?: string | null
          canonical_url?: string | null
          view_count?: number
          sales_count?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          title?: string
          slug?: string
          subtitle?: string | null
          author_id?: string | null
          price_cents?: number
          original_price_cents?: number | null
          currency?: string
          is_free?: boolean
          is_published?: boolean
          is_featured?: boolean
          is_bestseller?: boolean
          cover_image_url?: string | null
          short_description?: string | null
          description?: string | null
          format?: string
          language?: string
          pages?: number | null
          isbn?: string | null
          publisher?: string | null
          publication_date?: string | null
          audio_duration?: string | null
          audio_sample_url?: string | null
          table_of_contents?: Json | null
          seo_title?: string | null
          seo_description?: string | null
          canonical_url?: string | null
          view_count?: number
          sales_count?: number
          updated_at?: string
        }
      }
      book_categories: {
        Row: {
          book_id: string
          category_id: string
        }
        Insert: {
          book_id: string
          category_id: string
        }
        Update: {
          book_id?: string
          category_id?: string
        }
      }
      book_files: {
        Row: {
          id: string
          book_id: string
          file_type: BookFileType
          storage_path: string
          file_size_bytes: number | null
          mime_type: string | null
          is_downloadable: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          book_id: string
          file_type: BookFileType
          storage_path: string
          file_size_bytes?: number | null
          mime_type?: string | null
          is_downloadable?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          file_type?: BookFileType
          storage_path?: string
          file_size_bytes?: number | null
          mime_type?: string | null
          is_downloadable?: boolean
          updated_at?: string
        }
      }
      publication_assets: {
        Row: {
          id: string
          publication_id: string
          asset_type: "pdf" | "epub" | "audiobook" | "audio_chapter" | "video"
          storage_provider: string
          bucket_name: string
          object_key: string
          original_filename: string
          mime_type: string
          file_size: number
          upload_status: "pending" | "completed" | "failed" | "archived"
          is_downloadable: boolean
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          publication_id: string
          asset_type: "pdf" | "epub" | "audiobook" | "audio_chapter" | "video"
          storage_provider?: string
          bucket_name: string
          object_key: string
          original_filename: string
          mime_type: string
          file_size: number
          upload_status?: "pending" | "completed" | "failed" | "archived"
          is_downloadable?: boolean
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          asset_type?: "pdf" | "epub" | "audiobook" | "audio_chapter" | "video"
          storage_provider?: string
          bucket_name?: string
          object_key?: string
          original_filename?: string
          mime_type?: string
          file_size?: number
          upload_status?: "pending" | "completed" | "failed" | "archived"
          is_downloadable?: boolean
          metadata?: Json
          updated_at?: string
        }
      }
      book_previews: {
        Row: {
          id: string
          book_id: string
          preview_type: string
          preview_content: string | null
          storage_path: string | null
          created_at: string
        }
        Insert: {
          id?: string
          book_id: string
          preview_type?: string
          preview_content?: string | null
          storage_path?: string | null
          created_at?: string
        }
        Update: {
          preview_type?: string
          preview_content?: string | null
          storage_path?: string | null
        }
      }
      book_entitlements: {
        Row: {
          id: string
          user_id: string
          book_id: string
          order_id: string | null
          entitlement_type: string
          is_revoked: boolean
          granted_at: string
          expires_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          book_id: string
          order_id?: string | null
          entitlement_type?: string
          is_revoked?: boolean
          granted_at?: string
          expires_at?: string | null
        }
        Update: {
          is_revoked?: boolean
          expires_at?: string | null
        }
      }
      orders: {
        Row: {
          id: string
          order_number: string
          user_id: string
          status: OrderStatus
          subtotal_cents: number
          discount_cents: number
          total_cents: number
          currency: string
          coupon_id: string | null
          customer_email: string
          customer_name: string | null
          customer_phone: string | null
          metadata: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          order_number: string
          user_id: string
          status?: OrderStatus
          subtotal_cents?: number
          discount_cents?: number
          total_cents?: number
          currency?: string
          coupon_id?: string | null
          customer_email: string
          customer_name?: string | null
          customer_phone?: string | null
          metadata?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          status?: OrderStatus
          total_cents?: number
          metadata?: Json | null
          updated_at?: string
        }
      }
      order_items: {
        Row: {
          id: string
          order_id: string
          book_id: string
          book_title: string
          price_cents: number
          created_at: string
        }
        Insert: {
          id?: string
          order_id: string
          book_id: string
          book_title: string
          price_cents: number
          created_at?: string
        }
        Update: {
          price_cents?: number
        }
      }
      payments: {
        Row: {
          id: string
          order_id: string
          user_id: string
          provider: string
          razorpay_order_id: string
          razorpay_payment_id: string | null
          razorpay_signature: string | null
          status: PaymentStatus
          amount_cents: number
          currency: string
          error_code: string | null
          error_description: string | null
          raw_response: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          order_id: string
          user_id: string
          provider?: string
          razorpay_order_id: string
          razorpay_payment_id?: string | null
          razorpay_signature?: string | null
          status?: PaymentStatus
          amount_cents: number
          currency?: string
          error_code?: string | null
          error_description?: string | null
          raw_response?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          razorpay_payment_id?: string | null
          razorpay_signature?: string | null
          status?: PaymentStatus
          error_code?: string | null
          error_description?: string | null
          raw_response?: Json | null
          updated_at?: string
        }
      }
      refunds: {
        Row: {
          id: string
          payment_id: string
          order_id: string
          amount_cents: number
          currency: string
          razorpay_refund_id: string | null
          reason: string | null
          status: string
          initiated_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          payment_id: string
          order_id: string
          amount_cents: number
          currency?: string
          razorpay_refund_id?: string | null
          reason?: string | null
          status?: string
          initiated_by?: string | null
          created_at?: string
        }
        Update: {
          status?: string
        }
      }
      wishlists: {
        Row: {
          id: string
          user_id: string
          book_id: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          book_id: string
          created_at?: string
        }
        Update: {
          book_id?: string
        }
      }
      reading_progress: {
        Row: {
          id: string
          user_id: string
          book_id: string
          current_page: number
          total_pages: number
          progress_percentage: number
          last_cfi: string | null
          last_chapter: string | null
          last_read_at: string
        }
        Insert: {
          id?: string
          user_id: string
          book_id: string
          current_page?: number
          total_pages?: number
          progress_percentage?: number
          last_cfi?: string | null
          last_chapter?: string | null
          last_read_at?: string
        }
        Update: {
          current_page?: number
          total_pages?: number
          progress_percentage?: number
          last_cfi?: string | null
          last_chapter?: string | null
          last_read_at?: string
        }
      }
      bookmarks: {
        Row: {
          id: string
          user_id: string
          book_id: string
          page_number: number
          cfi: string | null
          note: string | null
          color: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          book_id: string
          page_number: number
          cfi?: string | null
          note?: string | null
          color?: string | null
          created_at?: string
        }
        Update: {
          page_number?: number
          cfi?: string | null
          note?: string | null
          color?: string | null
        }
      }
      reviews: {
        Row: {
          id: string
          user_id: string
          book_id: string
          rating: number
          title: string | null
          review_text: string
          is_verified_purchase: boolean
          is_approved: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          book_id: string
          rating: number
          title?: string | null
          review_text: string
          is_verified_purchase?: boolean
          is_approved?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          rating?: number
          title?: string | null
          review_text?: string
          is_approved?: boolean
          updated_at?: string
        }
      }
      blog_posts: {
        Row: {
          id: string
          title: string
          slug: string
          excerpt: string | null
          content: string
          cover_image_url: string | null
          featured_image: string | null
          custom_css: string | null
          og_image_url: string | null
          focus_keyword: string | null
          author_id: string | null
          status: PostStatus
          published_at: string | null
          reading_time_minutes: number | null
          seo_title: string | null
          seo_description: string | null
          canonical_url: string | null
          view_count: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          slug: string
          excerpt?: string | null
          content: string
          cover_image_url?: string | null
          featured_image?: string | null
          custom_css?: string | null
          og_image_url?: string | null
          focus_keyword?: string | null
          author_id?: string | null
          status?: PostStatus
          published_at?: string | null
          reading_time_minutes?: number | null
          seo_title?: string | null
          seo_description?: string | null
          canonical_url?: string | null
          view_count?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          title?: string
          slug?: string
          excerpt?: string | null
          content?: string
          cover_image_url?: string | null
          featured_image?: string | null
          custom_css?: string | null
          og_image_url?: string | null
          focus_keyword?: string | null
          author_id?: string | null
          status?: PostStatus
          published_at?: string | null
          reading_time_minutes?: number | null
          seo_title?: string | null
          seo_description?: string | null
          canonical_url?: string | null
          view_count?: number
          updated_at?: string
        }
      }
      blog_categories: {
        Row: {
          id: string
          name: string
          slug: string
          description: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          description?: string | null
          created_at?: string
        }
        Update: {
          name?: string
          slug?: string
          description?: string | null
        }
      }
      pages: {
        Row: {
          id: string
          title: string
          slug: string
          content_html: string
          is_published: boolean
          meta_title: string | null
          meta_description: string | null
          canonical_url: string | null
          updated_at: string
          created_at: string
        }
        Insert: {
          id?: string
          title: string
          slug: string
          content_html: string
          is_published?: boolean
          meta_title?: string | null
          meta_description?: string | null
          canonical_url?: string | null
          updated_at?: string
          created_at?: string
        }
        Update: {
          title?: string
          slug?: string
          content_html?: string
          is_published?: boolean
          meta_title?: string | null
          meta_description?: string | null
          canonical_url?: string | null
          updated_at?: string
        }
      }
      homepage_sections: {
        Row: {
          id: string
          section_key: string
          title: string
          subtitle: string | null
          is_enabled: boolean
          display_order: number
          config: Json | null
          updated_at: string
        }
        Insert: {
          id?: string
          section_key: string
          title: string
          subtitle?: string | null
          is_enabled?: boolean
          display_order?: number
          config?: Json | null
          updated_at?: string
        }
        Update: {
          title?: string
          subtitle?: string | null
          is_enabled?: boolean
          display_order?: number
          config?: Json | null
          updated_at?: string
        }
      }
      faqs: {
        Row: {
          id: string
          question: string
          answer: string
          category: string | null
          display_order: number
          is_published: boolean
          created_at: string
        }
        Insert: {
          id?: string
          question: string
          answer: string
          category?: string | null
          display_order?: number
          is_published?: boolean
          created_at?: string
        }
        Update: {
          question?: string
          answer?: string
          category?: string | null
          display_order?: number
          is_published?: boolean
        }
      }
      coupons: {
        Row: {
          id: string
          code: string
          discount_type: "percent" | "fixed"
          discount_value: number
          min_order_cents: number
          max_discount_cents: number | null
          max_redemptions: number | null
          current_redemptions: number
          expires_at: string | null
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          code: string
          discount_type?: "percent" | "fixed"
          discount_value: number
          min_order_cents?: number
          max_discount_cents?: number | null
          max_redemptions?: number | null
          current_redemptions?: number
          expires_at?: string | null
          is_active?: boolean
          created_at?: string
        }
        Update: {
          code?: string
          discount_type?: "percent" | "fixed"
          discount_value?: number
          min_order_cents?: number
          max_discount_cents?: number | null
          max_redemptions?: number | null
          current_redemptions?: number
          expires_at?: string | null
          is_active?: boolean
        }
      }
      newsletter_subscribers: {
        Row: {
          id: string
          email: string
          source: string | null
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          email: string
          source?: string | null
          is_active?: boolean
          created_at?: string
        }
        Update: {
          is_active?: boolean
        }
      }
      analytics_events: {
        Row: {
          id: string
          event_name: string
          user_id: string | null
          session_id: string | null
          page_url: string | null
          book_id: string | null
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          event_name: string
          user_id?: string | null
          session_id?: string | null
          page_url?: string | null
          book_id?: string | null
          metadata?: Json | null
          created_at?: string
        }
        Update: {
          event_name?: string
        }
      }
      site_settings: {
        Row: {
          key: string
          value: Json
          updated_at: string
        }
        Insert: {
          key: string
          value?: Json
          updated_at?: string
        }
        Update: {
          value?: Json
          updated_at?: string
        }
      }
      audit_logs: {
        Row: {
          id: string
          admin_user_id: string | null
          action: string
          resource_type: string
          resource_id: string | null
          details: Json | null
          ip_address: string | null
          created_at: string
        }
        Insert: {
          id?: string
          admin_user_id?: string | null
          action: string
          resource_type: string
          resource_id?: string | null
          details?: Json | null
          ip_address?: string | null
          created_at?: string
        }
        Update: {
          action?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      user_role_type: UserRole
      order_status_type: OrderStatus
      payment_status_type: PaymentStatus
      book_file_type: BookFileType
      post_status_type: PostStatus
      coupon_discount_type: "percent" | "fixed"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
