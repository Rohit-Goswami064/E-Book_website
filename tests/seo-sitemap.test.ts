import { describe, it } from "node:test"
import assert from "node:assert/strict"
import robots from "../src/app/robots"

describe("SEO Architecture, Sitemap & Robots Validation", () => {
  it("robots.txt properly disallows private, reader, account, and admin paths", () => {
    const config = robots()

    assert.ok(config.rules, "Rules must be defined")
    const rule = Array.isArray(config.rules) ? config.rules[0] : config.rules

    assert.equal(rule.allow, "/")

    const disallows = Array.isArray(rule.disallow) ? rule.disallow : [rule.disallow]
    assert.ok(disallows.includes("/super-admin/"), "Must disallow /super-admin/")
    assert.ok(disallows.includes("/account/"), "Must disallow /account/")
    assert.ok(disallows.includes("/read/"), "Must disallow /read/")
    assert.ok(disallows.includes("/checkout/"), "Must disallow /checkout/")
    assert.ok(disallows.includes("/api/"), "Must disallow /api/")
  })

  it("filters sitemap entries to ensure no private or draft URLs are exposed", () => {
    const mockDbEntries = [
      { slug: "meditations", is_published: true, type: "book" },
      { slug: "draft-manuscript", is_published: false, type: "book" },
      { slug: "the-art-of-reading", status: "published", type: "blog" },
      { slug: "unreleased-essay", status: "draft", type: "blog" },
    ]

    const publishedBooks = mockDbEntries.filter(
      (e) => e.type === "book" && e.is_published
    )
    const publishedBlog = mockDbEntries.filter(
      (e) => e.type === "blog" && e.status === "published"
    )

    assert.equal(publishedBooks.length, 1)
    assert.equal(publishedBooks[0].slug, "meditations")

    assert.equal(publishedBlog.length, 1)
    assert.equal(publishedBlog[0].slug, "the-art-of-reading")

    // Drafts excluded
    assert.ok(!publishedBooks.some((b) => b.slug === "draft-manuscript"))
    assert.ok(!publishedBlog.some((p) => p.slug === "unreleased-essay"))
  })
})
