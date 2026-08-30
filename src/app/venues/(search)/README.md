# Why `/venues` sits in a route group

The same reason `/vendors` does. This route is dynamic and queries the database,
so it wants a loading boundary. Its siblings — `/venues/[city]` and
`/venues/[city]/[type]` — are prerendered and resolve their slugs against the
database, calling `notFound()` for one that does not exist.

A `loading.tsx` placed directly under `venues/` would cover those too, and a
loading boundary streams a 200 shell before the page can discover the route is
invalid. The 404 then arrives after the response has already started, which is
a soft 404: a crawler sees a successful page for a city that does not exist.

The route group gives the boundary to this route alone. It changes nothing
about the URL.
