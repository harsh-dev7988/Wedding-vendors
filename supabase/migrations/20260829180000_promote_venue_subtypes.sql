-- ---------------------------------------------------------------------------
-- The venue subtypes go live, now that they have somewhere to go
--
-- They were held back for one reason: with no route of their own, promoting
-- them would have put nine links in the menu that all led to the same page.
-- `/venues/[city]/[type]` exists now, so each one has a page, a title and a
-- URL worth ranking — "banquet halls in Mumbai" is a search people actually
-- make, and it is a different intent from "farmhouses in Mumbai".
--
-- One consequence worth stating: `/venues/[city]` no longer filters on the
-- `venues` category, it filters on `kind = 'venue'`. Had it kept filtering by
-- category, the first banquet hall filed under `banquet-halls` would have
-- vanished from its own city's venue page.
-- ---------------------------------------------------------------------------

update public.categories
set is_active = true
where kind = 'venue' and parent_slug is not null;
