"use client";

import { LoaderCircle, Search } from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";

import type { MapsProvider, PlaceSuggestion } from "@/lib/maps/types";
import { cn } from "@/lib/utils";

/**
 * Address search with our own suggestion list.
 *
 * Google's `<Autocomplete>` renders its own dropdown, styled by Google and
 * unreachable by our CSS — the same problem the native `<select>` had, solved
 * the same way. Owning the list also makes the providers genuinely
 * interchangeable: a widget cannot be swapped, a data source can.
 *
 * Keyboard behaviour matches `SelectMenu`: arrows to move, Enter to choose,
 * Escape to dismiss.
 */

/** Long enough to avoid a request per keystroke, short enough to feel live. */
const DEBOUNCE_MS = 280;
const MIN_QUERY = 3;

export function PlaceCombobox({
  defaultValue,
  onSelect,
  provider,
}: {
  readonly defaultValue?: string;
  readonly onSelect: (place: PlaceSuggestion) => void;
  readonly provider: MapsProvider;
}) {
  const [query, setQuery] = useState(defaultValue ?? "");
  const [suggestions, setSuggestions] = useState<readonly PlaceSuggestion[]>(
    [],
  );
  const [activeIndex, setActiveIndex] = useState(0);
  // Dismissal is the state worth holding; whether the list is *open* follows
  // from having results for a long-enough query. Deriving it keeps the effect
  // below free of setState, which is both the lint rule and the right shape.
  const [dismissed, setDismissed] = useState(false);
  const [searching, setSearching] = useState(false);
  const [failed, setFailed] = useState(false);
  // Set once the visitor picks, so the effect below does not immediately
  // re-search for the text we just put in the field.
  const suppressRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    if (suppressRef.current) {
      suppressRef.current = false;
      return;
    }
    const trimmed = query.trim();
    if (trimmed.length < MIN_QUERY) return;

    const controller = new AbortController();
    const timer = setTimeout(() => {
      setSearching(true);
      setFailed(false);
      provider
        .suggest(trimmed, controller.signal)
        .then((results) => {
          setSuggestions(results);
          setActiveIndex(0);
          setDismissed(false);
        })
        .catch((error: unknown) => {
          // An aborted request is the expected outcome of typing another
          // character, not a failure worth reporting.
          if (error instanceof DOMException && error.name === "AbortError") {
            return;
          }
          setFailed(true);
          setSuggestions([]);
        })
        .finally(() => setSearching(false));
    }, DEBOUNCE_MS);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [provider, query]);

  const longEnough = query.trim().length >= MIN_QUERY;
  const open = !dismissed && suggestions.length > 0 && longEnough;
  // Distinguishable from "still typing" and from "search is down": the query
  // ran and matched nothing.
  const empty =
    !dismissed &&
    !searching &&
    !failed &&
    longEnough &&
    suggestions.length === 0;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setDismissed(true);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const choose = (place: PlaceSuggestion) => {
    suppressRef.current = true;
    setQuery(place.formattedAddress);
    setDismissed(true);
    setSuggestions([]);
    onSelect(place);
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (!open || suggestions.length === 0) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((current) =>
        Math.min(suggestions.length - 1, Math.max(0, current + step)),
      );
    } else if (event.key === "Enter") {
      event.preventDefault();
      const place = suggestions[activeIndex];
      if (place) choose(place);
    } else if (event.key === "Escape") {
      setDismissed(true);
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <div className="border-border focus-within:border-brand-text flex min-h-12 items-center gap-2 rounded-xl border bg-white px-3 transition">
        <Search
          aria-hidden="true"
          className="text-brand-text shrink-0"
          size={17}
        />
        <input
          aria-autocomplete="list"
          aria-controls={open ? listId : undefined}
          aria-expanded={open}
          aria-label="Search for your address"
          autoComplete="off"
          className="w-full bg-transparent py-2 font-medium outline-none"
          onChange={(event) => {
            setQuery(event.currentTarget.value);
            setDismissed(false);
          }}
          onKeyDown={onKeyDown}
          placeholder="Start typing your address or area…"
          role="combobox"
          type="text"
          value={query}
        />
        {searching && (
          <LoaderCircle
            aria-hidden="true"
            className="text-muted-foreground shrink-0 animate-spin"
            size={16}
          />
        )}
      </div>

      {empty && (
        <p className="text-muted-foreground mt-2 text-xs">
          No addresses match that. Try a nearby landmark, road or neighbourhood.
        </p>
      )}

      {failed && (
        <p className="text-muted-foreground mt-2 text-xs">
          Address search is unavailable right now. You can still submit — a
          moderator will set the location.
        </p>
      )}

      {open && (
        <ul
          className="border-border shadow-soft text-foreground absolute top-[calc(100%+0.5rem)] left-0 z-[1100] max-h-72 w-full overflow-y-auto rounded-2xl border bg-white p-1.5"
          id={listId}
          role="listbox"
        >
          {suggestions.map((place, index) => (
            <li key={place.id}>
              <button
                aria-selected={index === activeIndex}
                className={cn(
                  "flex w-full flex-col items-start gap-0.5 rounded-xl px-3 py-2 text-left transition",
                  index === activeIndex && "bg-muted",
                )}
                onClick={() => choose(place)}
                onPointerEnter={() => setActiveIndex(index)}
                role="option"
                type="button"
              >
                <span className="text-sm font-semibold">
                  {place.locality || place.label}
                </span>
                <span className="text-muted-foreground line-clamp-1 text-xs">
                  {place.formattedAddress}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
