import { useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from "react";
import {
  Badge as KonstaBadge,
  Block,
  BlockFooter,
  BlockTitle,
  Button as KonstaButton,
  Chip as KonstaChip,
  List,
  ListInput,
  ListItem,
  Navbar as KonstaNavbar,
  Preloader,
  Searchbar as KonstaSearchbar,
  Segmented,
  SegmentedButton,
  Tabbar as KonstaTabbar,
  TabbarLink,
} from "konsta/react";
import { Drawer } from "vaul";
import { Link } from "wouter";
import { motion } from "framer-motion";

export interface NavBarProps {
  title: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  subtitle?: ReactNode;
  large?: boolean;
  scrollEl?: HTMLElement | null;
  className?: string;
}

export function NavBar({ title, leading, trailing, subtitle, large = false, scrollEl, className = "" }: NavBarProps) {
  return (
    <KonstaNavbar
      className={`lf-konsta-navbar sticky top-0 z-30 md:hidden ${className}`}
      title={title}
      subtitle={subtitle}
      left={leading}
      right={trailing}
      large={large}
      scrollEl={scrollEl ?? undefined}
      centerTitle
      colors={{
        bgIos: "bg-background/90 dark:bg-background/90",
        textIos: "text-foreground",
      }}
    />
  );
}

export interface TabBarItem {
  id: string;
  label: string;
  icon?: ReactNode;
  href?: string;
  onSelect?: () => void;
  badge?: string | number;
  disabled?: boolean;
}

export interface TabBarProps {
  items: TabBarItem[];
  value: string;
  onValueChange?: (value: string) => void;
  label?: string;
  className?: string;
}

export function TabBar({ items, value, onValueChange, label = "Primary navigation", className = "" }: TabBarProps) {
  return (
    <motion.div initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.22 }}>
      <KonstaTabbar
        labels
        icons
        className={`lf-konsta-tabbar fixed inset-x-0 bottom-0 z-40 md:hidden ${className}`}
        aria-label={label}
      >
        {items.map((item) => {
          const content = item.badge !== undefined
            ? <span className="relative inline-flex items-center">{item.icon}<KonstaBadge className="absolute -right-3 -top-2">{item.badge}</KonstaBadge></span>
            : item.icon;
          const handleClick = () => {
            if (item.disabled) return;
            onValueChange?.(item.id);
            item.onSelect?.();
          };
          return (
            <TabbarLink
              key={item.id}
              component={item.href ? Link : "button"}
              linkProps={item.href ? { href: item.href } : undefined}
              icon={content}
              label={item.label}
              active={item.id === value}
              className={item.disabled ? "pointer-events-none opacity-40" : undefined}
              aria-disabled={item.disabled || undefined}
              onClick={(event) => { if (item.disabled) event.preventDefault(); else handleClick(); }}
              aria-current={item.id === value ? "page" : undefined}
            />
          );
        })}
      </KonstaTabbar>
    </motion.div>
  );
}

export interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  dismissible?: boolean;
  size?: "medium" | "large";
  onConfirm?: () => void;
  confirmLabel?: string;
  confirmDisabled?: boolean;
}

export function Sheet({
  open, onOpenChange, title, description, children, footer, className = "",
  dismissible = true, size = "large", onConfirm, confirmLabel = "Done", confirmDisabled = false,
}: SheetProps) {
  const snapPoints = size === "medium" ? [0.56, 0.94] : [0.88, 1];
  const [snapPoint, setSnapPoint] = useState<number | string | null>(snapPoints[0]);
  return (
    <Drawer.Root
      open={open}
      onOpenChange={onOpenChange}
      dismissible={dismissible}
      snapPoints={snapPoints}
      activeSnapPoint={snapPoint}
      setActiveSnapPoint={setSnapPoint}
      shouldScaleBackground={false}
    >
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-[80] bg-black/45" />
        <Drawer.Content
          className={`lf-konsta-sheet fixed inset-x-0 bottom-0 z-[81] mx-auto flex max-h-[96dvh] w-full max-w-2xl flex-col rounded-t-[12px] bg-card text-foreground outline-none ${className}`}
        >
          <Drawer.Handle className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-muted-foreground/40" />
          <header className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 py-3">
            <Drawer.Close asChild><KonstaButton clear className="justify-self-start" disabled={!dismissible}>Cancel</KonstaButton></Drawer.Close>
            <div className="text-center">
              <Drawer.Title className="text-lg font-semibold">{title}</Drawer.Title>
              {description && <Drawer.Description className="text-xs text-muted-foreground">{description}</Drawer.Description>}
            </div>
            {onConfirm ? (
              <KonstaButton clear className="justify-self-end" onClick={onConfirm} disabled={confirmDisabled}>{confirmLabel}</KonstaButton>
            ) : <Drawer.Close asChild><KonstaButton clear className="justify-self-end" aria-label="Close sheet">Done</KonstaButton></Drawer.Close>}
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">{children}</div>
          {footer && <footer className="border-t border-border px-4 py-3">{footer}</footer>}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

export interface GroupedListProps {
  children: ReactNode;
  title?: ReactNode;
  footer?: ReactNode;
  className?: string;
  label?: string;
}

export function GroupedList({ children, title, footer, className = "", label }: GroupedListProps) {
  return (
    <section aria-label={label} className={className}>
      {title && <BlockTitle>{title}</BlockTitle>}
      <List
        inset
        strongIos
        dividersIos
        outlineIos
        aria-label={label}
        colors={{
          strongBgIos: "bg-card dark:bg-card",
          outlineIos: "border-border dark:border-border",
        }}
      >{children}</List>
      {footer && <BlockFooter inset>{footer}</BlockFooter>}
    </section>
  );
}

export interface GroupedRowProps {
  title: ReactNode;
  subtitle?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  onClick?: () => void;
  href?: string;
  selected?: boolean;
  disabled?: boolean;
  accessory?: boolean;
  className?: string;
  testId?: string;
}

export function GroupedRow({
  title, subtitle, leading, trailing, onClick, href, selected, disabled, accessory = !!(onClick || href), className = "", testId,
}: GroupedRowProps) {
  return (
    <ListItem
      title={title}
      text={subtitle}
      media={leading}
      after={trailing}
      link={accessory}
      component={href ? Link : onClick ? "button" : "li"}
      linkProps={href ? { href } : undefined}
      onClick={disabled ? undefined : onClick}
      className={className}
      data-testid={testId}
      aria-selected={selected}
      colors={{
        primaryTextIos: "text-foreground dark:text-foreground",
        secondaryTextIos: "text-muted-foreground dark:text-muted-foreground",
      }}
      aria-disabled={disabled || undefined}
    />
  );
}

export interface SegmentedOption {
  value: string;
  label: ReactNode;
  disabled?: boolean;
}

export function SegmentedControl({ options, value, onValueChange, label, className = "" }: {
  options: SegmentedOption[]; value: string; onValueChange: (value: string) => void; label: string; className?: string;
}) {
  return (
    <Segmented strongIos roundedIos className={className} aria-label={label}>
      {options.map((option) => (
        <SegmentedButton key={option.value} active={option.value === value} disabled={option.disabled} onClick={() => onValueChange(option.value)}>
          {option.label}
        </SegmentedButton>
      ))}
    </Segmented>
  );
}

export function MobileButton({ children, className = "", size = "large", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { size?: "standard" | "large" }) {
  return <KonstaButton large={size === "large"} rounded className={className} {...props}>{children}</KonstaButton>;
}

export function MobileField({ label, className = "", ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <List className={className}>
      <ListInput label={label} outlineIos input={<input {...props} />} />
    </List>
  );
}

export function MobileSearchbar({ value, onValueChange, placeholder, inputId, className = "", testId }: {
  value: string;
  onValueChange: (value: string) => void;
  placeholder: string;
  inputId?: string;
  className?: string;
  testId?: string;
}) {
  return (
    <KonstaSearchbar
      className={className}
      value={value}
      placeholder={placeholder}
      inputId={inputId}
      clearButton
      onInput={(event: React.FormEvent<HTMLInputElement>) => onValueChange(event.currentTarget.value)}
      onClear={() => onValueChange("")}
      data-testid={testId}
    />
  );
}

export function MobileChip({ children }: { children: ReactNode }) {
  return <KonstaChip>{children}</KonstaChip>;
}

export function MobileLoading({ label = "Loading" }: { label?: string }) {
  return <Block className="flex items-center justify-center gap-2"><Preloader /><span className="text-sm text-muted-foreground">{label}</span></Block>;
}
