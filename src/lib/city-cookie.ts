/**
 * The cookie the remembered city is mirrored into.
 *
 * Its own module, with no `"use client"`, because both sides need the name: the
 * client store writes it and the two dynamic search routes read it on the
 * server. Exporting it from the client store would turn a plain string into a
 * client reference, which a server component cannot use as a value.
 */
export const CITY_COOKIE = "wv_city";
