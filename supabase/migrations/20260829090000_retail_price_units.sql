-- ---------------------------------------------------------------------------
-- Price units for things that are not services
--
-- `price_unit` was written for services: per_plate, per_event, per_function,
-- per_day, package, on_request. Every value assumes somebody is booked for an
-- occasion.
--
-- The categories coming next are not all like that. A lehenga shop prices per
-- piece and rents half its stock; a jeweller prices per piece; a cake is priced
-- by weight; a mehendi artist and a bartender are often priced per guest.
-- Without these, every one of those listings falls back to "Price on request",
-- which does not just look vague — it removes the listing from the price filter
-- entirely, so the filter silently stops covering a third of the catalogue.
--
-- Alone in its own migration on purpose: Postgres will not let a new enum value
-- be *used* in the transaction that adds it, and the next migration seeds
-- `categories.allowed_price_units` with these.
-- ---------------------------------------------------------------------------

alter type public.price_unit add value if not exists 'per_person';
alter type public.price_unit add value if not exists 'per_piece';
alter type public.price_unit add value if not exists 'per_kg';
alter type public.price_unit add value if not exists 'rental';
