"use client";

import { Check, ChevronDown } from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";

import { cn } from "@/lib/utils";

export type SelectOption = {
  readonly disabled?: boolean;
  readonly label: string;
  readonly value: string;
};

/**
 * A styled replacement for a native `<select>`.
 *
 * `appearance: none` restyles the closed control, but the list a native select
 * opens is drawn by the operating system and cannot be reached by CSS at all —
 * which is why every dropdown in the app still dropped an unstyled grey box on
 * top of the design. The only way to style that list is to stop using it.
 *
 * A hidden `<input>` carries the value, so this still submits inside the plain
 * GET forms it replaces, with the same `name`. It is a Client Component, but
 * only the control is: the forms and pages around it stay server-rendered.
 *
 * Keyboard behaviour follows the WAI-ARIA combobox pattern — Enter/Space/Down
 * to open, arrows and Home/End to move, Enter to choose, Escape to cancel,
 * and typing a letter jumps to the next option starting with it.
 */
export function SelectMenu({
  className,
  id,
  label,
  name,
  options,
  placeholder,
  value: initialValue = "",
}: {
  readonly className?: string;
  readonly id?: string;
  /** Accessible name. Rendered visually hidden when the field has no visible label. */
  readonly label: string;
  readonly name: string;
  readonly options: readonly SelectOption[];
  readonly placeholder?: string;
  readonly value?: string;
}) {
  const [value, setValue] = useState(initialValue);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  // These fields are driven by the URL. A soft navigation within the same
  // route keeps this component mounted, so without this the control would go
  // on showing the filter the visitor just removed. Adjusting state during
  // render is React's documented answer to a prop the state derives from —
  // an effect would paint the stale value first.
  const [lastProp, setLastProp] = useState(initialValue);
  if (initialValue !== lastProp) {
    setLastProp(initialValue);
    setValue(initialValue);
  }
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const generatedId = useId();
  const buttonId = id ?? generatedId;
  const listId = `${buttonId}-list`;

  const selected = options.find((option) => option.value === value);
  const displayText = selected?.label ?? placeholder ?? label;

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    // Keep the active option in view when arrowing through a long list.
    listRef.current
      ?.querySelectorAll("[role='option']")
      [activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  const openAt = (index: number) => {
    setActiveIndex(Math.max(0, index));
    setOpen(true);
  };

  const choose = (index: number) => {
    const option = options[index];
    if (!option || option.disabled) return;
    setValue(option.value);
    setOpen(false);
    buttonRef.current?.focus();
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    const selectedIndex = options.findIndex((o) => o.value === value);

    switch (event.key) {
      case "ArrowDown":
      case "ArrowUp": {
        event.preventDefault();
        if (!open) {
          openAt(selectedIndex < 0 ? 0 : selectedIndex);
          return;
        }
        const step = event.key === "ArrowDown" ? 1 : -1;
        setActiveIndex((current) =>
          Math.min(options.length - 1, Math.max(0, current + step)),
        );
        return;
      }
      case "Home":
        if (open) {
          event.preventDefault();
          setActiveIndex(0);
        }
        return;
      case "End":
        if (open) {
          event.preventDefault();
          setActiveIndex(options.length - 1);
        }
        return;
      case "Enter":
      case " ":
        event.preventDefault();
        if (open) choose(activeIndex);
        else openAt(selectedIndex < 0 ? 0 : selectedIndex);
        return;
      case "Escape":
        if (open) {
          event.preventDefault();
          setOpen(false);
          buttonRef.current?.focus();
        }
        return;
      case "Tab":
        setOpen(false);
        return;
      default: {
        // Type-ahead: a single printable character jumps to the next match.
        if (event.key.length !== 1 || event.metaKey || event.ctrlKey) return;
        const needle = event.key.toLowerCase();
        const from = open ? activeIndex + 1 : 0;
        const order = [...options.slice(from), ...options.slice(0, from)];
        const match = order.find(
          (option) =>
            !option.disabled && option.label.toLowerCase().startsWith(needle),
        );
        if (!match) return;
        const index = options.indexOf(match);
        if (open) setActiveIndex(index);
        else openAt(index);
      }
    }
  };

  return (
    <div className="relative min-w-0 flex-1" ref={containerRef}>
      {/* Without JavaScript the button below does nothing, and these are plain
          GET forms that are supposed to work regardless. A browser only parses
          `<noscript>` contents into the DOM when scripting is off, so exactly
          one control carries `name` at a time and the form never posts two. */}
      <noscript>
        <select
          aria-label={label}
          className={cn("select-field", className)}
          defaultValue={value}
          name={name}
        >
          {options.map((option) => (
            <option
              disabled={option.disabled}
              key={option.value || option.label}
              value={option.value}
            >
              {option.label}
            </option>
          ))}
        </select>
      </noscript>

      {/* The value the surrounding form actually posts. */}
      <input name={name} type="hidden" value={value} />

      <button
        aria-controls={open ? listId : undefined}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={label}
        className={cn(
          "flex w-full items-center justify-between gap-2 text-left",
          className,
        )}
        id={buttonId}
        onClick={() => (open ? setOpen(false) : openAt(0))}
        onKeyDown={onKeyDown}
        ref={buttonRef}
        type="button"
      >
        <span className={cn("truncate", !selected && "text-muted-foreground")}>
          {displayText}
        </span>
        <ChevronDown
          aria-hidden="true"
          className={cn(
            "text-brand-text shrink-0 transition-transform duration-200",
            open && "rotate-180",
          )}
          size={16}
        />
      </button>

      {open && (
        <ul
          aria-label={label}
          className="border-border shadow-soft text-foreground absolute top-[calc(100%+0.5rem)] left-0 z-50 max-h-72 w-full min-w-56 overflow-y-auto rounded-2xl border bg-white p-1.5"
          id={listId}
          onKeyDown={onKeyDown}
          ref={listRef}
          role="listbox"
          tabIndex={-1}
        >
          {options.map((option, index) => {
            const isSelected = option.value === value;
            return (
              <li key={option.value || `placeholder-${index}`}>
                <button
                  aria-selected={isSelected}
                  className={cn(
                    "flex min-h-10 w-full items-center justify-between gap-3 rounded-xl px-3 text-left text-sm font-semibold transition",
                    index === activeIndex && "bg-muted",
                    isSelected && "text-brand-text",
                    option.disabled && "cursor-not-allowed opacity-50",
                  )}
                  disabled={option.disabled}
                  onClick={() => choose(index)}
                  onPointerEnter={() => setActiveIndex(index)}
                  role="option"
                  type="button"
                >
                  <span className="truncate">{option.label}</span>
                  {isSelected && (
                    <Check aria-hidden="true" className="shrink-0" size={15} />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
