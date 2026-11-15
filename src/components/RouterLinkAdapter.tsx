import React, { forwardRef } from 'react';
import { Link as RouterLink, type To } from 'react-router-dom';

export interface RouterLinkAdapterProps extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  href?: string;
  to?: To;
}

const EXTERNAL_SCHEME_REGEX = /^(https?:|mailto:|tel:)/i;

export const RouterLinkAdapter = forwardRef<HTMLAnchorElement, RouterLinkAdapterProps>(
  ({ href, to, target, rel, children, ...rest }, ref) => {
    const destination = typeof href === 'string' ? href : typeof to === 'string' ? to : undefined;
    const isExternal =
      target === '_blank' ||
      (destination !== undefined && EXTERNAL_SCHEME_REGEX.test(destination));

    if (isExternal && destination) {
      const safeRel =
        target === '_blank'
          ? [rel, 'noopener', 'noreferrer'].filter(Boolean).join(' ')
          : rel;
      return (
        <a ref={ref} href={destination} target={target} rel={safeRel} {...rest}>
          {children}
        </a>
      );
    }

    const routerTarget: To = to ?? href ?? '/';
    return (
      <RouterLink ref={ref} to={routerTarget} {...rest}>
        {children}
      </RouterLink>
    );
  }
);

RouterLinkAdapter.displayName = 'RouterLinkAdapter';
