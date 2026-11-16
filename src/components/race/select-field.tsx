"use client";

import { Check, ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string;
  label: string;
}

/**
 * A listbox in the page's own voice, because a native <select> drops an operating-system menu
 * (white panel, blue highlight) into a near-black page. Follows the ARIA listbox pattern: arrows and
 * Home/End move, typing jumps to a label, Enter picks, Escape closes and returns focus to the button.
 */
export function SelectField({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  className?: string;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const typed = useRef({ text: "", at: 0 });

  const selected = Math.max(0, options.findIndex((o) => o.value === value));
  const current = options[selected];

  const openAt = (index: number) => {
    setActive(index);
    setOpen(true);
  };

  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) button.current?.focus();
  };

  const pick = (index: number) => {
    const option = options[index];
    if (option) onChange(option.value);
    close();
  };

  // Keep the highlighted option in view, and park focus on the list while it is open.
  useEffect(() => {
    if (!open) return;
    list.current?.focus();
    list.current?.children[active]?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!wrap.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  /** Typing "og" jumps to the first option starting with it, as a native select does. */
  const typeahead = (key: string) => {
    const now = Date.now();
    typed.current = { text: (now - typed.current.at < 700 ? typed.current.text : "") + key.toLowerCase(), at: now };
    const from = options.findIndex((o) => o.label.toLowerCase().startsWith(typed.current.text));
    if (from >= 0) setActive(from);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    const last = options.length - 1;
    switch (event.key) {
      case "ArrowDown":
      case "ArrowUp": {
        event.preventDefault();
        const step = event.key === "ArrowDown" ? 1 : -1;
        if (!open) openAt(selected);
        else setActive((i) => Math.min(last, Math.max(0, i + step)));
        break;
      }
      case "Home":
      case "End":
        event.preventDefault();
        if (open) setActive(event.key === "Home" ? 0 : last);
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        if (open) pick(active);
        else openAt(selected);
        break;
      case "Escape":
        if (open) {
          event.preventDefault();
          close();
        }
        break;
      case "Tab":
        if (open) setOpen(false);
        break;
      default:
        if (event.key.length === 1 && !event.metaKey && !event.ctrlKey) {
          if (!open) openAt(selected);
          typeahead(event.key);
        }
    }
  };

  return (
    <div ref={wrap} className={cn("relative", className)}>
      <span id={`${id}-label`} className="sr-only">
        {label}
      </span>
      <button
        ref={button}
        type="button"
        role="combobox"
        aria-controls={`${id}-list`}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-labelledby={`${id}-label ${id}-value`}
        onClick={() => (open ? close(false) : openAt(selected))}
        onKeyDown={onKeyDown}
        className={cn(
          "flex h-11 w-full items-center justify-between gap-2 rounded-[2px] border bg-asphalt-800 pr-3 pl-3 text-left text-base text-chalk transition-colors duration-150",
          open ? "border-chalk" : "border-kerb hover:border-chalk/40",
        )}
      >
        <span id={`${id}-value`} className="truncate">
          {current?.label ?? ""}
        </span>
        <ChevronDown className={cn("size-4 shrink-0 text-chalk-dim transition-transform duration-200 motion-reduce:transition-none", open && "rotate-180")} aria-hidden />
      </button>

      {open ? (
        <ul
          ref={list}
          id={`${id}-list`}
          role="listbox"
          tabIndex={-1}
          aria-labelledby={`${id}-label`}
          aria-activedescendant={`${id}-opt-${active}`}
          onKeyDown={onKeyDown}
          className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-[2px] border border-kerb bg-asphalt-800 py-1 shadow-[0_18px_40px_-12px_rgb(0_0_0/0.8)] outline-none"
        >
          {options.map((option, index) => {
            const isSelected = option.value === value;
            return (
              <li
                key={option.value}
                id={`${id}-opt-${index}`}
                role="option"
                aria-selected={isSelected}
                onPointerEnter={() => setActive(index)}
                onClick={() => pick(index)}
                className={cn(
                  "flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-base",
                  index === active ? "bg-asphalt-700 text-chalk" : "text-chalk-dim",
                  isSelected && "text-chalk",
                )}
              >
                <span className="truncate">{option.label}</span>
                {isSelected ? <Check className="size-4 shrink-0 text-gold" aria-hidden /> : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
