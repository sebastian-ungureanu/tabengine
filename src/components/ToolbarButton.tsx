import { createContext, useContext, useId, type ButtonHTMLAttributes, type MouseEventHandler, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

const SUPPORTS_INTEREST_TOOLTIPS =
  typeof window !== 'undefined' &&
  typeof HTMLButtonElement !== 'undefined' &&
  'interestForElement' in HTMLButtonElement.prototype &&
  typeof CSS !== 'undefined' &&
  typeof CSS.supports === 'function' &&
  CSS.supports('position-area', 'block-end');

const ToolbarTooltipPortalContext = createContext<HTMLElement | null>(null);

export function ToolbarTooltipPortalProvider({
  value,
  children
}: {
  value: HTMLElement | null;
  children: ReactNode;
}) {
  return (
    <ToolbarTooltipPortalContext.Provider value={value}>
      {children}
    </ToolbarTooltipPortalContext.Provider>
  );
}

const normalizeLabel = (value: string) => value.trim().replace(/\s+/g, ' ').toLowerCase();

const getPlainTextFromChildren = (children: ReactNode): string => {
  if (typeof children === 'string' || typeof children === 'number') {
    return String(children);
  }
  if (Array.isArray(children)) {
    return children.map(getPlainTextFromChildren).join(' ');
  }
  return '';
};

export interface ToolbarButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'title' | 'disabled'> {
  tooltip: string;
  isDisabled?: boolean;
}

export function ToolbarButton({
  tooltip,
  isDisabled = false,
  onClick,
  type = 'button',
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
  children,
  ...rest
}: ToolbarButtonProps) {
  const tooltipId = useId();
  const portalContainer = useContext(ToolbarTooltipPortalContext);

  const usePopoverHint = SUPPORTS_INTEREST_TOOLTIPS && Boolean(tooltip);
  const accessibleName = ariaLabel ?? getPlainTextFromChildren(children);
  const isTooltipRedundant =
    Boolean(accessibleName) && normalizeLabel(accessibleName) === normalizeLabel(tooltip);

  const describedBy = usePopoverHint
    ? ariaDescribedBy ?? (isTooltipRedundant ? undefined : tooltipId)
    : ariaDescribedBy;

  const handleClick: MouseEventHandler<HTMLButtonElement> = (event) => {
    if (isDisabled) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    onClick?.(event);
  };

  const interestProps = usePopoverHint
    ? ({ interestfor: tooltipId } as Record<string, string>)
    : undefined;

  const popoverProps = { popover: 'hint' } as Record<string, string>;

  return (
    <>
      <button
        {...rest}
        {...interestProps}
        type={type}
        aria-label={ariaLabel}
        aria-describedby={describedBy}
        aria-disabled={isDisabled ? 'true' : undefined}
        title={usePopoverHint ? undefined : tooltip}
        onClick={handleClick}
      >
        {children}
      </button>
      {usePopoverHint && portalContainer && createPortal(
        <div
          id={tooltipId}
          className="toolbar-tooltip"
          role={isTooltipRedundant ? undefined : 'tooltip'}
          {...popoverProps}
        >
          {tooltip}
        </div>,
        portalContainer
      )}
    </>
  );
}
