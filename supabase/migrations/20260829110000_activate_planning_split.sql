-- ---------------------------------------------------------------------------
-- The two halves of Planning & Decor go live
--
-- `planners-decorators` was an active category. Splitting it into
-- `wedding-planners` and `decorators` and leaving both inactive did not split
-- it — it deleted it, and the site quietly lost twelve directory pages and a
-- whole section of the menu.
--
-- Everything else stays inactive on purpose: a category is activated when
-- there are vendors in it, and a menu offering thirty categories where
-- twenty-eight are empty makes a working site look abandoned. These two are
-- the exception because they are not new. They are what an existing category
-- became, and the site should be no smaller after a rename than before it.
-- ---------------------------------------------------------------------------

update public.categories
set is_active = true
where slug in ('wedding-planners', 'decorators');
