/**
 * Renders a JSON-LD block.
 *
 * The payload is serialised and then has `<` escaped, so a vendor-supplied
 * name containing `</script>` cannot break out of the tag.
 *
 * Returns nothing when the builder declined to produce data — which is how
 * preview fixtures and unrated listings stay out of structured data entirely.
 */
export function JsonLd({ data }: { data: Record<string, unknown> | null }) {
  if (!data) return null;

  return (
    <script
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replaceAll("<", "\\u003c"),
      }}
      type="application/ld+json"
    />
  );
}
