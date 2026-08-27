Route group, so the URL is still `/vendors`.

`loading.tsx` applies to its own segment _and everything nested under it_. Left
at `app/vendors/`, it covered `/vendors/[city]` and `/vendors/[city]/[category]`
as well — and a loading boundary streams a 200 shell before the page can
discover that a slug is not a real city, which turns a genuine 404 into a soft
one that crawlers index.

Those two routes need `dynamicParams = true` so a city added in Supabase works
without a deploy, and that only returns a real 404 if nothing streams first.
Grouping the search page keeps its skeleton without imposing it on its
siblings.
